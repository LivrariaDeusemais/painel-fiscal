import argparse
import csv
import json
import os
from pathlib import Path


def clean(value):
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).replace("\t", "").strip()


def number(value):
    text = clean(value)
    if not text:
        return None
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def spreadsheet_rows(path):
    suffix = path.suffix.lower()
    if suffix == ".xls":
        import xlrd

        with open(os.devnull, "w", encoding="utf-8") as logfile:
            book = xlrd.open_workbook(
                path,
                logfile=logfile,
                ignore_workbook_corruption=True,
            )
        sheet = book.sheet_by_index(0)
        for row_index in range(sheet.nrows):
            yield [sheet.cell_value(row_index, col) for col in range(sheet.ncols)]
        return

    if suffix == ".xlsx":
        import openpyxl

        book = openpyxl.load_workbook(path, read_only=True, data_only=True)
        for row in book.active.iter_rows(values_only=True):
            yield list(row)
        return

    raise ValueError("A base de produtos deve estar no formato XLS ou XLSX.")


def parse_products(path):
    rows = iter(spreadsheet_rows(path))
    try:
        headers = [clean(value) for value in next(rows)]
    except StopIteration as error:
        raise ValueError("A planilha está vazia.") from error

    required = ["ID", "Código", "Descrição", "Preço", "Estoque", "Preço de custo", "Peso líquido (Kg)"]
    missing = [header for header in required if header not in headers]
    if missing:
        raise ValueError("Colunas obrigatórias ausentes: " + ", ".join(missing))

    positions = {header: index for index, header in enumerate(headers)}
    products = []
    issues = []
    seen = set()
    for row_number, row in enumerate(rows, start=2):
        sku = clean(row[positions["Código"]] if positions["Código"] < len(row) else "")
        name_index = positions["Descrição"]
        name = clean(row[name_index] if name_index < len(row) else "")
        if not sku:
            if any(clean(cell) for cell in row):
                issues.append({
                    "row": row_number,
                    "sku": "",
                    "name": name,
                    "reason": "Código/SKU não informado.",
                })
            continue
        if sku in seen:
            issues.append({
                "row": row_number,
                "sku": sku,
                "name": name,
                "reason": "SKU duplicado no cadastro geral; esta linha não foi importada.",
            })
            continue
        seen.add(sku)

        def value(header):
            index = positions.get(header)
            return row[index] if index is not None and index < len(row) else None

        cost = number(value("Preço de custo"))
        weight = number(value("Peso líquido (Kg)"))
        reasons = []
        if cost is None or cost <= 0:
            reasons.append("Preço de custo ausente ou igual a zero")
        if weight is None or weight <= 0:
            reasons.append("Peso líquido ausente ou igual a zero")
        if reasons:
            issues.append({
                "row": row_number,
                "sku": sku,
                "name": name,
                "reason": "; ".join(reasons) + ".",
            })

        products.append({
            "sku": sku,
            "bling_id": clean(value("ID")),
            "name": name,
            "brand": clean(value("Marca")),
            "status": clean(value("Situação")),
            "stock": number(value("Estoque")),
            "cost": cost,
            "purchase_price": number(value("Preço de Compra")),
            "weight": weight,
            "gross_weight": number(value("Peso bruto (Kg)")),
            "bling_price": number(value("Preço")),
            "ean": clean(value("GTIN/EAN")),
        })
    if not products:
        raise ValueError("Nenhum produto com Código foi encontrado.")
    return {"products": products, "count": len(products), "issues": issues}


def parse_links(path):
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(8192)
        handle.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=";,\t,")
        reader = csv.DictReader(handle, dialect=dialect)
        headers = [clean(item) for item in (reader.fieldnames or [])]
        required = ["IdProduto", "ID na Loja", "Nome", "Código", "Preco", "Preco Promocional"]
        missing = [header for header in required if header not in headers]
        if missing:
            raise ValueError("Colunas obrigatórias ausentes: " + ", ".join(missing))
        links = []
        for source in reader:
            row = {clean(key): clean(value) for key, value in source.items() if key is not None}
            sku = row.get("Código", "")
            if not sku:
                continue
            links.append({
                "product_id": row.get("IdProduto", ""),
                "store_id": row.get("ID na Loja", ""),
                "name": row.get("Nome", ""),
                "sku": sku,
                "current_price": number(row.get("Preco")),
                "promotional_price": number(row.get("Preco Promocional")),
                "raw": row,
            })
    if not links:
        raise ValueError("Nenhum vínculo com Código foi encontrado.")
    return {"headers": headers, "links": links, "count": len(links)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["products", "links"])
    parser.add_argument("--file", required=True)
    args = parser.parse_args()
    path = Path(args.file)
    if not path.exists():
        raise ValueError("Arquivo não encontrado.")
    result = parse_products(path) if args.command == "products" else parse_links(path)
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        raise SystemExit(1)
