# Layout Executivo e fechamento mensal

## Escopo e retorno

O layout Executivo reorganiza os acessos sem trocar endpoints, formulários ou regras dos módulos existentes. A preferência individual é mantida na sessão e em cookie HttpOnly por um ano. Há seleção de layout no cabeçalho e no modelo anterior. `/dashboard?layout=antigo` continua abrindo o painel anterior. Nenhuma tabela anterior é removida ou renomeada. A troca visual não restaura backups nem altera lançamentos.

Navegação: Visão Geral; Financeiro; Compras e Estoque; Preços; Contábil; Integrações; Administração. Conciliação fica no Contábil, com atalho no Financeiro. CONTADOR mantém consulta/exportação da conciliação, sem importação ou edição. Os links não substituem as validações das rotas.

## Inventário preservado

- Contas a pagar `/rotina-despesas`: status por competência, estimativas históricas, filtros, colunas, criação/edição e controles existentes.
- Comprovantes `/lancamentos`, `/novo`, `/editar/:id`: PDF/XML, tipos, pagamentos, categorias, filtros e relatórios Excel mensal/anual.
- Arquivo `/arquivo`: fila, análise, vínculo com lançamentos, renomeação e integrações fiscais existentes.
- Conciliação `/conciliacao-bancaria`: Conta Corrente/PIX/OFX, revisões, pré-cadastros, regras de sócios, transferências, comprovantes, compras e exportação formatada por banco.
- Compras `/ferramentas-ia/gestao-compras`: pares XML/PDF, parcelas, cartões, abatimentos, conciliação, busca, filtros e totais.
- Codificador `/ferramentas-ia/codificador`: fornecedores atuais, SKU/EAN/código de fornecedor, upload manual e busca de NF arquivada, resultados PDF/Excel.
- Preços `/ferramentas-ia/tabela-precos/*`: base, produtos, custos, status, vínculos, regras/tarifas, fretes, tabelas, promoções e exportações existentes.
- Contador `/espaco-contador`: a Central de downloads usa **a mesma página e os mesmos handlers**, sem recriar lista fixa de anexos. Preserva XML/PDF automáticos, CTEs, CMV, extratos, lista de despesas, tipos customizados, anexos extras, status de liberação, downloads individuais/em grupo, limpeza administrativa e data/hora de download.
- Integrações Bling, Mercado Livre, SEFAZ, NF Paulistana e NFS-e: as mesmas telas e serviços.
- Administração: usuários/perfis, categorias, alertas, backup banco/arquivos/completo e OneDrive.

## Novas informações

`/contabil/fechamento`: ADMIN e USUARIO importam Excel DRE e estoques de Matriz, Full Mercado Livre e Full Shopee. XLS (xlrd) e XLSX (openpyxl), arquivos de até 15 MB. A competência escolhe a coluna exata mês/ano do DRE; o operador confirma mês completo e estoques na data de encerramento, a preço de custo e filtros iguais. Não é uma sincronização diária via API. O arquivo de estoque ainda deve ser validado contra uma exportação real do usuário; colunas reconhecidas: Produto/Descrição, Quantidade, Valor total. Conferência de soma contra totais do relatório.

Valores monetários em centavos. Original arquivado imutavelmente; correções no formulário não alteram o arquivo. Reimportação não salva o fechamento automaticamente e pede confirmação para substituir os campos da revisão. Cada arquivo tem hash, autor e data/hora. Salvamento usa versão otimista e transação, registrando antes/depois e motivo. Rascunhos não entram nos painéis nem são expostos à contadora. O fechamento pode ser corrigido, com nova versão.

Receita líquida = faturamento bruto − deduções. Resultado líquido **gerencial** = receita líquida − CMV − despesas revisadas do Plennatec. Margem = resultado / receita líquida. Compras para estoque são apresentadas separadamente, sem nova dedução depois do CMV. O resultado original do DRE fica preservado e visível para conferência. Validar classificação e abrangência com a contadora.

Indicadores na ordem combinada: faturamento bruto, faturamento líquido, CMV, total das despesas, resultado líquido em reais, margem líquida. Financeiro, Visão Geral e Contábil leem o mesmo fechamento. Ano soma apenas meses fechados e utiliza estoque do último fechamento, sem somar estoques mensais. Meses ausentes são identificados.

`/contabil/historico`: competências, situação, autor, atualização e resumo. Exportação anual Excel com abas Fechamentos/Editoras/Estoques. Os novos originais são servidos apenas em rota autenticada, com checagem de liberação e evento de download; não são expostos por `/uploads/fechamentos`.

## Validação e implantação

- Testes de parser com DRE real fornecido, seleção de competência, dinheiro brasileiro e editoras.
- Testes de soma/precisão de estoque, rejeição de totais incoerentes, anual e controle de versão.
- Testes HTTP de autenticação, perfis, CSRF, importação/revisão/salvamento, arquivos e auditoria.
- Regressão da suíte existente; inspeção visual das telas reais com o layout anterior e Executivo.
- Backup completo confirmado pelo usuário antes de iniciar. Restauração do banco não é necessária para trocar layouts.
