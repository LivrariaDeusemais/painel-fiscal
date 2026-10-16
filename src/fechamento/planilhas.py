"""Leitura de relatórios locais do Bling; não executa fórmulas ou macros."""
import sys, json, os

def clean(v):
    if v is None: return ''
    if isinstance(v, (int, float, str, bool)): return v
    return str(v)

def read(path):
    if os.path.getsize(path) > 16 * 1024 * 1024: raise ValueError('Planilha excede 15 MB.')
    if path.lower().endswith('.xlsx'):
        from openpyxl import load_workbook
        import zipfile
        with zipfile.ZipFile(path) as z:
            if sum(i.file_size for i in z.infolist()) > 80 * 1024 * 1024: raise ValueError('Planilha descompactada muito grande.')
        w = load_workbook(path, read_only=True, data_only=True)
        sheets = []
        for s in w.worksheets[:8]:
            rows=[]
            for row in s.iter_rows(values_only=True):
                if len(rows) >= 30000: raise ValueError('Limite de 30 mil linhas por aba.')
                if len(row) > 150: raise ValueError('Limite de 150 colunas.')
                rows.append([clean(v) for v in row])
            sheets.append({'name': s.title, 'rows': rows})
        w.close()
        return sheets
    import xlrd
    w=xlrd.open_workbook(path, on_demand=True)
    sheets=[]
    for s in w.sheets()[:8]:
        if s.nrows > 30000 or s.ncols > 150: raise ValueError('Planilha excede limite de linhas/colunas.')
        sheets.append({'name':s.name,'rows':[[clean(v) for v in s.row_values(i)] for i in range(s.nrows)]})
    w.release_resources()
    return sheets

if __name__ == '__main__':
    try: print(json.dumps(read(sys.argv[1]),ensure_ascii=False))
    except Exception as e:
        print(str(e),file=sys.stderr);sys.exit(1)
