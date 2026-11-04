"""Extrai os relatórios textuais da contabilidade, sem estimar períodos."""
import sys,json,re
from decimal import Decimal
import pdfplumber

def money(s):
    neg='(' in s or s.endswith('C')
    n=int(Decimal(re.sub(r'[^0-9,]','',s).replace(',','.'))*100)
    return -n if neg else n

def parse(file):
    with pdfplumber.open(file) as pdf:
        if len(pdf.pages)>100: raise ValueError('PDF excede 100 páginas.')
        text='\n'.join(p.extract_text() or '' for p in pdf.pages)
        match=re.search(r'Per[ií]odo:\s*(\d{2})/(\d{2})/(\d{4})\s*-\s*(\d{2})/(\d{2})/(\d{4})',text)
        if not match: raise ValueError('Período não identificado no PDF.')
        a,b,c,d,e,f=match.groups(); start=f'{c}-{b}-{a}';end=f'{f}-{e}-{d}'
        kind='balancete' if 'BALANCETE' in text.upper() else 'dre'
        if kind=='dre' and 'DEMONSTRAÇÃO DO RESULTADO' not in text.upper(): raise ValueError('Modelo de relatório não reconhecido.')
        if '18.862.388/0001-03' not in text: raise ValueError('O CNPJ do relatório não corresponde à Deus é Mais.')
        lines=[]
        for page_no,p in enumerate(pdf.pages,1):
            if kind=='dre':
                for line in (p.extract_text() or '').splitlines():
                    m=re.match(r'^(.+?)\s+(\(?[\d.]+,\d{2}\)?)$',line)
                    if m:
                        top={'RECEITA BRUTA','DEDUÇÕES DA RECEITA BRUTA','RECEITA LÍQUIDA','CUSTOS','LUCRO BRUTO','DESPESAS OPERACIONAIS','RECEITAS FINANCEIRAS','RESULTADO OPERACIONAL','RESULTADO ANTES DO IR E CSL','LUCRO LÍQUIDO DO EXERCÍCIO'}
                        lines.append(dict(code=str(len(lines)+1),label=m[1],value=money(m[2]),page=page_no,bold=m[1] in top,level=0 if m[1] in top else 1))
            else:
                # A camada regular de acessibilidade repete títulos em outra posição.
                # Usar a linha tipográfica dos valores evita misturar essas camadas.
                anchors=[]
                seen=set()
                for c in p.chars:
                    key=round(c['top'],1)
                    if 510<=c['x0']<580 and c['text'].isdigit() and key not in seen:
                        seen.add(key);anchors.append(c)
                for anchor in anchors:
                    y=anchor['top'];chars=[c for c in p.chars if abs(c['top']-y)<.2]
                    def segment(lo,hi): return ''.join(c['text'] for c in sorted(chars,key=lambda c:c['x0']) if lo<=c['x0']<hi).strip()
                    code=segment(6,30);label=segment(30,305)
                    nums=[segment(305,357),segment(357,429),segment(429,505),segment(505,580)]
                    if not code.isdigit() or not label: continue
                    if not all(re.fullmatch(r'[\d.]+,\d{2}[DC]?',n) for n in nums): continue
                    values=list(map(money,nums))
                    lines.append(dict(code=code,label=label,previous=values[0],debit=abs(values[1]),credit=abs(values[2]),value=values[3],page=page_no,bold='Bold' in anchor['fontname']))
        if not lines: raise ValueError('Nenhuma conta reconhecida. Use o PDF original com texto.')
        if kind=='balancete' and any(abs(x['previous']+x['debit']-x['credit']-x['value'])>1 for x in lines): raise ValueError('Os movimentos não conciliam com os saldos do PDF. Confira o modelo.')
        return dict(kind=kind,start=start,end=end,lines=lines)
if __name__=='__main__':
    try: print(json.dumps(parse(sys.argv[1]),ensure_ascii=False))
    except Exception as e: print(str(e),file=sys.stderr);sys.exit(1)
