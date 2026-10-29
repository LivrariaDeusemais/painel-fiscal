# Gestão de estoque e pedidos de compra

Tela: **Compras e Estoque → Estoque e pedidos**, `/compras/reposicao`.
Não modifica preços, pedidos, notas fiscais ou estoques no Bling. Dados reais de cadastro,
custo do fornecedor padrão e depósitos são lidos da integração existente. A categoria é
atualizada na próxima sincronização de cadastro Bling; falhas preservam o nome anterior.

## Acesso

Capacidade `estoque-pedidos`, sem concessão automática às funções existentes.
Ver: consultar planejamento/pedidos. Gerenciar: importar, editar, criar, confirmar,
cancelar e registrar recebimentos. Baixar: exportar Excel e abrir impressão/PDF.
Gerenciar não concede download; ambos pressupõem Ver. Validação também no router,
inclusive para perfis legados sem função. ADMIN tem acesso. Escritas usam token de sessão
e versão otimista global para impedir sobrescrita silenciosa entre usuários/abas.

## Fontes e importações

* Giro: XLS/XLSX de **Notas fiscais por produto**, somente **Venda de mercadorias**,
  sem notas pendentes. Importador soma quantidade por SKU/CFOP. Usuário declara período
  real e confirma relatório completo. Nova carga substitui a anterior inteira, sem acumular.
  O relatório não permite verificar automaticamente o filtro de natureza nem datas individuais.
  Ausência de produto significa zero no relatório completo; produtos ainda Novo sem ocorrência
  ficam sem histórico para sugestão. Não existe ainda coleta automática de giro via API.
* Full ML: SKU, EAN, quantidade e número do frete; soma deve conferir com o total de unidades.
* Full Shopee: SKU vendedor e quantidade aprovada por ASN; total repetido nas páginas é controle,
  nunca item. As tabelas podem trazer vários SKUs em uma célula; correspondência é validada.
* Orçamento: Excel do Codificador, primeira aba, colunas Código do fornecedor, SKU Deus é Mais,
  Quantidade orçada, Valor unitário e Valor total. Destino é um pedido específico em rascunho.
  Ausentes são NT; extras e duplicatas de SKU bloqueiam a carga. Uma nova conferência completa
  substitui a anterior enquanto o pedido for rascunho.

Todos passam por prévia, escolha do SKU de destino e confirmação. EAN/código de fornecedor
não único não é resolvido silenciosamente. SKU original fica visível na prévia. Upload até
15 MB, planilhas até 20 mil linhas/100 colunas e PDF até 100 páginas. Leitor Python isolado
em pasta temporária removida ao terminar, timeout de 90s, sem execução de macros/fórmulas.
Prévia expira em 30 minutos e tem versão da base. Reimportação de mesmo frete/ASN/hash é
bloqueada, inclusive se realizado; somente envio Cancelado permite substituição.

## Sugestão e decisão

Padrão editável por editora: prazo 5 dias desde início do orçamento à entrega, cobertura 30 dias.
Demanda-alvo = teto(giro / dias reais do relatório × (cobertura + prazo)).
Compra sugerida = máximo entre zero, demanda-alvo menos os três estoques físicos e compras
confirmadas a receber, e envios Full pendentes menos Matriz e compras confirmadas a receber.
Esse máximo garante separação Full sem somar novamente suas unidades à demanda global.
Matriz = Santo André. Faltando saldo/custo/giro, exponha ausência; não fabrique zero de estoque.
Saldo físico não desconta reservas comerciais. Revisão pelo usuário é necessária.
Recebimentos e envios realizados posteriores ao saldo Bling suspendem a sugestão daquele SKU
até nova atualização de estoque. Quantidade manual zero é preservada.

Compras em rascunho não são suprimento confirmado. Confirmadas descontam quantidade confirmada
menos recebida. Recebimento é acumulado, permite parcial, não pode diminuir ou ultrapassar o
confirmado e não movimenta Bling. Cancelamento com recebimento é bloqueado. Linhas com
quantidade zero/NT não são suprimento. Pedido recebido deixa de ser pendente.

## Pedidos e editoras

Selecionar produtos, definir quantidade/preço, salvar, gerar: um pedido por editora/fornecedor.
Pedidos congelam nome, SKU, códigos, custo de referência, preço solicitado, quantidade e prazos.
Marca é agrupamento inicial; usuário pode definir fornecedor/editora na tabela quando necessário.
Geração limpa apenas a quantidade manual das linhas incluídas, sem alterar outros produtos.
Revisões de orçamento guardam evento, autor e data. Diferenças de preço são contra o custo
congelado; diferenças de quantidade são contra o pedido solicitado. Status independentes:
Aumentou preço / Abaixou preço / Manteve preço / Sem preço informado;
Orçou parcial / Quantidade atendida / Orçou a mais / NT.

Valores unitários preservam quatro casas decimais; cada total de linha arredonda em centavos,
e o total do pedido soma as linhas arredondadas. Pedido impresso tem identificação Deus é Mais,
CNPJ, número, editora, data, prazo, quantidade, SKU, código fornecedor/EAN, descrição e valores.
Logotipo Deus é Mais não estava no repositório: cadastrar PNG/JPEG no botão da aba Pedidos;
fica persistido no planejamento. Sem imagem, impressão usa a identificação textual da empresa.
Imprimir abre documento HTML com impressão nativa / salvar PDF; exportar gera XLSX completo.

Persistência: `estoque_planejamento` (dados/version) e `estoque_pedidos` (dados/version/data).
Nenhum novo alerta automático foi adicionado nesta etapa. Não houve publicação nem migração
da base de produção durante desenvolvimento.
