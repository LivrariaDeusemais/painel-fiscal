import sys
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "codificador"))
from codificador import construir_indices, criar_excel_orcamento, extrair_penkal_orcamento_por_coordenadas, Produto
from openpyxl import load_workbook


class OrcamentoPenkalTest(unittest.TestCase):
    def extrair(self, deslocamento=0):
        words = []
        dados = [("34466", "5,0000", "39,9000", "69,9200", "12,0000", "60,00"),
                 ("33616", "5,0000", "64,9000", "64,5600", "23,0000", "115,00"),
                 ("33472", "20,0000", "59,9000", "74,9600", "15,0000", "300,00"),
                 ("31165", "10,0000", "29,9000", "69,9000", "9,0000", "90,00")]
        skus = ["J2006", "L1246", "L1226", "L1236"]
        produtos = [Produto("Penkal", row[0], "", sku, "", "") for row, sku in zip(dados, skus)]
        for i, row in enumerate(dados):
            for text, x in zip((row[0], "UN", *row[1:]), (226, 262, 281, 330, 382, 425, 478)):
                words.append({"text": text, "x0": x + (deslocamento if x > 262 else 0),
                              "top": 274 + i * 24, "bottom": 282 + i * 24})
        return extrair_penkal_orcamento_por_coordenadas(
            [{"words": words, "page": 1, "height": 842}], construir_indices(produtos))

    def test_colunas_liquidas_em_layouts_distintos(self):
        for deslocamento in (0, 40):
            itens = self.extrair(deslocamento)
            self.assertEqual([i.quantidade for i in itens], list(map(Decimal, [5, 5, 20, 10])))
            self.assertEqual([i.valor_unitario for i in itens], list(map(Decimal, [12, 23, 15, 9])))
            self.assertEqual(sum(i.valor_total for i in itens), Decimal(565))
            self.assertEqual([i.sku for i in itens], ["J2006", "L1246", "L1226", "L1236"])

    def test_excel_com_formulas_e_exportacao_padrao_preservada(self):
        with tempfile.TemporaryDirectory() as pasta:
            path = Path(pasta) / "orcamento.xlsx"
            for formulas in (True, False):
                criar_excel_orcamento(path, self.extrair(), formulas=formulas)
                wb = load_workbook(path)
                ws = wb.active
                self.assertEqual([ws.cell(r, 3).value for r in range(2, 6)], [5, 5, 20, 10])
                self.assertEqual(ws["E2"].value, "=D2*C2" if formulas else 60)
                self.assertEqual(ws["E6"].value, "=SUM(E2:E5)" if formulas else 565)
                wb.close()


if __name__ == "__main__":
    unittest.main()
