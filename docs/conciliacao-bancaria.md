# Conciliação bancária

Acesso em `/conciliacao-bancaria`, pelo botão laranja no Dashboard ou pelo menu lateral.

## Operação

1. Selecionar banco e mês do pagamento.
2. Importar Conta Corrente: Excel da Caixa ou CSV do Inter. OFX também é aceito e pode complementar os dados da conta e os identificadores.
3. Importar o PIX separadamente, quando disponível. Pode ser enviado antes ou depois da Conta Corrente. O PIX enriquece as linhas, sem criar uma segunda despesa.
4. Usar **Conciliar pagamentos** para cruzar os lançamentos e ler os PDFs locais que contêm texto.
5. Clicar no status da linha para revisar campos, pesquisar comprovantes (inclusive de outros meses), ver o PDF e salvar o vínculo. Observações na tabela são salvas ao sair do campo.
   A janela de comprovantes permanece fixa; a lista rola internamente e mostra Nome, Valor, Data, Subcategoria e Vínculo. Os já vinculados aparecem identificados e não podem ser escolhidos para outra movimentação. A busca funciona ao digitar, pelo botão Buscar ou por Enter.
6. Conferir diferenças e pendências. Exportar gera Excel com as mesmas linhas filtradas na tela. **Limpar filtros** permite exportar o período inteiro.
7. **Dados da conta** permite informar agência e conta quando esses dados não estiverem no arquivo original. O sistema rejeita uma conta diferente da já importada.

## Regras

- Entradas sempre recebem `Não somar Cliente`.
- Saídas concluídas com tipo DOP recebem `Somar Conta Cliente`. Demais saídas identificadas recebem `Não somar Cliente`.
- Saídas sem identificação permanecem pendentes. Valores iguais sozinhos não confirmam vínculos.
- Nomes, documentos completos/parciais compatíveis, valor, data e identificadores PIX são comparados. Um ID PIX também pode ser encontrado no texto do PDF. Vínculos ambíguos ou valores divergentes vão para revisão.
- CPFs mascarados só são completados quando os dígitos disponíveis são compatíveis com uma fonte completa. O dado original permanece no JSON da movimentação e no arquivo original; a tabela e o Excel mostram a versão conciliada.
- AIBR → AliExpress; HUB → Magazine Luiza; Amazon → Amazon; Pipo → TikTok; Maree → Shopee; Mercado Pago → Mercado Livre. As marcações antigas de Conta Cliente no Excel de agosto não são usadas para decidir a regra.
- Movimentações de Genivaldo Sestari recebem `Retirada Sócios - Distribuição` nas saídas e `Inserção de Capital pelo Sócio` nas entradas, na coluna Origem / Finalidade. A regra também aparece nos períodos já importados, sem exigir reimportação; a regra DOP para Conta Cliente permanece a mesma.
- Para o titular próprio, os identificadores PIX observados nos exemplos de agosto distinguem recebimentos do Inter e do Mercado Pago. O cruzamento com movimentação oposta da outra conta ajuda a confirmar transferências; somente nome/CNPJ próprio não basta.
- Linhas `SALDO` são excluídas; a coluna Saldo é mantida. OFX sem saldo por linha deixa esse campo vazio até receber um Excel/CSV complementar.
- Na Caixa, Data Movimento define o período do pagamento. Data Lançamento é preservada e também comparada ao OFX para evitar duplicação de lançamentos em fins de semana/feriados.
- Lançamentos existentes têm `data_despesa`, sem data separada de pagamento. A data bancária governa a conciliação; a data da despesa auxilia a busca inicial. A revisão pode selecionar um lançamento de outro mês sem alterar sua data original.

## Persistência e implantação

- Tabela PostgreSQL `conciliacoes_bancarias`, criada de forma idempotente no primeiro uso das APIs; chave por banco e mês, com dados JSONB. A conta da aplicação precisa de permissão para criar a tabela.
- Originais são arquivados em `UPLOADS_DIR/.conciliacoes/<sha256>.bin`, protegidos pelo comportamento padrão de dotfiles do servidor estático. Download só pela rota autenticada, verificando a associação ao banco/mês.
- O módulo usa os lançamentos, categorias e anexos existentes. Importar/conferir não modifica os lançamentos originais.
- Vínculos entre bancos e meses são verificados sob bloqueio transacional. Observações e revisões têm histórico com usuário/data e valores anteriores.
- Os PDFs permanecem no disco persistente existente. Leitura de PDFs não faz upload para serviços externos; não há OCR de documentos escaneados nem modelo de IA externo nesta implementação. A conciliação automática usa critérios explicáveis; o que faltar precisa de revisão.
- Login e token de sessão são necessários para alterações. Perfil CONTADOR pode consultar/exportar, sem importar ou alterar dados.
- Nenhuma variável de ambiente ou dependência nova é necessária.
- Testes: `npm test` (o teste HTTP abre uma porta apenas em 127.0.0.1 e usa banco simulado).

## Validação com setembro de 2026

Os arquivos fornecidos foram lidos localmente, sem gravação no banco real: Caixa com 114 movimentações e 95 PIX associados; Inter com 23 movimentações. Excel/CSV + OFX complementar mantêm essas contagens. O aviso de divergência de saldo do Inter é preservado, sem inventar ajuste.

## NFs de compras de estoque

Gestão de Compras (`/ferramentas-ia/gestao-compras`) arquiva PDF e XML em pares, deduplicados pela chave NF-e. O XML fornece fornecedor, CNPJ, número, emissão, total, itens e duplicatas. Os originais são privados e só podem ser obtidos por rotas autenticadas.

O plano fecha em centavos: total NF = abatimento + partes de pagamento. Cada parte admite PIX, boleto ou cartão, datas/valores de parcelas e banco/cartão. Caixa VISA, Caixa ELO e Inter são os cartões permitidos. Crédito de troca/devolução não cria saída bancária.

A conciliação automática exige fornecedor/documento compatível e saldo exato de uma única parcela PIX/boleto; parcelas de notas de outros meses também participam. Vínculo manual aceita pagamentos parciais até o saldo disponível. Vínculos de despesas e de NFs são mutuamente exclusivos. Pagamentos de cartão são exibidos para conferência da fatura, sem vincular automaticamente a saída integral da fatura a uma NF. A coluna Saldo no extrato mostra o valor ainda não associado a movimentações bancárias, incluindo as partes em cartão.

Planos com pagamentos vinculados não podem remover ou reduzir suas parcelas abaixo do pago. O status da NF é calculado pelos vínculos de todos os bancos/meses e pelo abatimento. Compras não são inseridas em `lancamentos` nem nos totais de despesas. O Codificador pode reutilizar o PDF arquivado sem remover o original.

`Revisado` é uma decisão manual finalizada, não soma Pendências e sobrevive a nova conciliação. A regra DOP permanece. A tela e o Excel contêm uma única coluna CPF/CNPJ com documento atualizado pelo cadastro.
