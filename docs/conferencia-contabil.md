# Conferência contábil

Nova tela Contábil → Conferência contábil (`/contabil/conferencia`). Não publicada nesta etapa.

- Períodos mensal, trimestral, anual e personalizado com datas inicial/final.
- Relatórios textuais de Débora para o CNPJ 18.862.388/0001-03. PDF original até 15 MB/100 páginas. Imagens sem texto precisam de outro fluxo; não usa OCR silencioso.
- Original, hash, autor, data e extração preservados por envio. A versão mais recente de cada tipo/período participa da comparação.
- Cobertura exige períodos inteiros e contíguos. Um PDF trimestral não fornece valores mensais. Não soma PDFs sobrepostos.
- DRE agrega fluxos por conta; balancete mantém o primeiro saldo anterior e último saldo atual, somando apenas débitos/créditos da mesma conta. Contas sintéticas não são somadas às analíticas.
- D/C: devedor positivo, credor negativo. Parser valida a equação dos movimentos de todas as contas.
- DRE: receita, deduções e CMV vêm dos fechamentos fechados, somente com todos os meses completos disponíveis. Receita líquida = receita − deduções. Sem fontes suficientes não apresenta zero como apuração.
- Demais contas: vínculo manual, persistente, de conta para uma ou várias categorias. Consulta comprovantes por data_despesa no intervalo. Categorias-pai não expandem automaticamente; marcar as categorias que recebem lançamentos. Não presumir que todas as saídas sejam despesas (empréstimos, consórcio etc.).
- No balancete a comparação dos comprovantes é com o movimento líquido (débito − crédito), não com o saldo patrimonial. Sem fonte comparável permanece sinalizado.
- Revisão por conjunto de versões/conta: A conferir, Conferido, Questionar contadora, Resolvido e observação. Reimportar documento não herda aprovação de uma versão anterior. Relatório CSV de questionamentos, sem envio automático.
- ADMIN opera. CONTADOR consulta/baixa apenas mediante concessões explícitas da nova capacidade; demais perfis permanecem bloqueados para faturamento/resultados. Nenhuma função existente recebe autorização nova. Downloads não são implícitos na gestão.

Limites: não é escrituração contábil nem cálculo de impostos. Não reconstrói saldos iniciais/patrimoniais ausentes. Documentos de outros modelos devem ser validados antes de uso. Vínculos exigem confirmação humana. Nenhum documento ou dado de produção foi importado no desenvolvimento.
