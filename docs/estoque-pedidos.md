# Gestão de estoque, análises e compras

Implementação em 30/10/2026. Pedido PDF conforme modelo e logotipo fornecidos pelo usuário.

## Navegação e acesso

- Gestão de Estoque → Gestão de estoque: `/compras/reposicao`, histórico e início de análises.
- Gestão de Estoque → Compras: `/compras/reposicao/compras`, escolha da análise e pedidos.
- Dentro da análise: `?analise=NUMERO`. Consultar adiciona `consulta=1` (interface de leitura).
- `estoque-pedidos`: consultar/editar análise e baixar seu Excel.
- Nova capacidade `pedidos-compra`: consultar Compras, gerenciar pedidos/retornos e baixar
  arquivos, separadamente. A área usa também o acesso à análise de estoque.
- A capacidade nova não é concedida automaticamente às funções existentes. ADMIN conserva acesso.
- Gerenciar não concede download; ambos pressupõem Ver, com validação no servidor.
- Arquivos de orçamento podem ser gerados no Codificador existente; o link não concede
  acesso ao Codificador. Seu Excel é importado em um pedido específico.

## Análises numeradas e preservação

`estoque_analises` guarda número sequencial, versão, produtos/saldos/custos de referência,
quantidades manuais, prazos, importações, situação, criação/finalização e histórico de reaberturas.
`estoque_planejamento` mantém os padrões globais de prazos/cobertura e logotipo.
`estoque_pedidos` preserva os pedidos e passa a registrar `analysisId`.

Na primeira consulta ao histórico, uma transação com bloqueio do planejamento cria uma
análise identificada como Planejamento anterior, preservando os dados existentes e associando
os pedidos antigos. A marca `analysesMigrated` impede repetir a conversão. Não se apagam
planejamentos nem pedidos anteriores. Produção não foi migrada durante o desenvolvimento.

Iniciar análise congela imediatamente a última base local de cadastro, custos e estoques.
Não dispara consulta à API nem acompanha sincronizações em andamento. Os botões ficam
liberados imediatamente. Nenhum pedido é enviado ao Bling.

Cada análise nova começa sem giro, sem demandas Full e sem quantidades manuais. Importações
são locais à análise e não alteram as anteriores. Botões pendentes: amarelo suave e Atualizar
em vermelho; após aplicar com sucesso: branco e Atualizado. Prazos/cobertura continuam salvos
para as próximas análises. A sugestão permanece indisponível enquanto faltarem fontes.
Compras confirmadas a receber são congeladas junto aos saldos para a sugestão dessa análise.

Finalizar registra data/evento e bloqueia escritas no servidor. Reabrir exige revisão atual,
registra autor/data e permite continuar. As quantidades não somem ao gerar pedidos.

## Salvamento e concorrência

Quantidade é digitada item a item; sugestão é apenas referência. Enter ou saída do campo
inicia gravação. Uma fila sequencial usa revisão otimista por análise; só confirma Salvo ✓
depois da resposta do servidor. Falhas mantêm o valor digitado, avisam e permitem nova tentativa.
Conflitos de revisão exigem recarregar; não sobrescrevem alterações de outra pessoa.
A navegação avisa se restam dados não salvos. Filtros/posição da tabela são lembrados por
análise e por área na sessão do navegador. Não há os antigos botões de salvar, aplicar
sugestão ou atualizar dados. Cabeçalho/SKU e filtros de coluna conservam o padrão aprovado.

## Fontes

- Giro: XLS/XLSX de Notas fiscais por produto do Bling; somente Venda de mercadorias,
  sem notas pendentes. Soma quantidades por SKU/CFOP, período declarado pelo usuário.
  Importa diretamente quando todos os SKUs correspondem. Substitui o giro completo da análise.
  Ausentes no relatório completo têm zero; produtos Novo sem ocorrência não fundamentam sugestão.
  O arquivo não permite verificar automaticamente os filtros de natureza/datas individuais.
- Full ML: SKU/EAN, quantidade e número do frete, conferência do total.
- Full Shopee: SKU vendedor e quantidade aprovada por ASN, conferência do total.
- Vários PDFs podem compor uma fonte; mesmo envio/hash é bloqueado dentro da análise.
  Não existe mais uma etapa separada de realizar envios para alimentar esta análise.
- Orçamento: Excel do Codificador, SKU, quantidade e valor unitário. Requer pedido em rascunho.
  Ausentes são NT; SKU fora do pedido ou repetido bloqueia a aplicação. Nova conferência
  completa substitui a anterior em rascunho. O pedido enviado permanece congelado.

Prévia de Full/orçamento permite corrigir vínculos. SKU/EAN ambíguo não é resolvido
silenciosamente. Prévia expira em 30 minutos e inclui análise e versão; não pode ser aplicada
em outra análise. Upload até 15 MB; leitor Python isolado, pasta temporária removida,
timeout 90s, planilhas até 20 mil linhas/100 colunas, PDFs até 100 páginas.

## Sugestão

Prazo padrão 5 dias, cobertura 30, configuráveis por editora.
Demanda-alvo = teto(giro / dias reais × (cobertura + prazo)).
Sugestão = máximo(0, demanda-alvo − estoques físicos − compras confirmadas a receber,
demanda Full − estoque S.André − compras confirmadas a receber).
Não duplica a demanda Full na demanda global. Matriz é Santo André. Saldo físico não
é saldo disponível após reservas comerciais. Falta de fonte/saldo não equivale a zero.

## Compras e retorno

Tabela compacta: somente quantidade a comprar >0; SKU, descrição, editora, código,
quantidade, custo, total e comparação do retorno (quantidade/valor/diferenças/status).
Filtros em todos os títulos. Sem seleção manual, gerar usa os itens filtrados quando
há apenas uma editora. Com seleção, agrupa por editora. Impede gerar novamente itens de
pedido não cancelado na mesma análise. Pedidos congelam nome, SKU, códigos, custo,
preço solicitado, quantidade e prazos. Cancelar é necessário antes de nova geração.

Diferença de quantidade compara com solicitado. Diferença de preço compara com custo
congelado, em R$ e % (custo zero não produz percentual). Status independentes:
Quantidade atendida / Orçou parcial / Orçou a mais / NT;
Manteve preço / Aumentou preço / Abaixou preço / Sem preço informado.

Confirmação/recebimento anteriores continuam disponíveis. Recebimento é acumulado e parcial,
não pode diminuir nem exceder confirmado. Cancelamento após recebimento é bloqueado.
Não movimentam estoque no Bling. Valores unitários preservam 4 casas; totais de linha e
pedido usam centavos. Logo PNG/JPEG até 800 KB. Exportação Excel existente é preservada.
Nenhum novo alerta automático ou envio de mensagem foi incluído nesta etapa.

Pedido PDF: download real em /pedidos/:id/relatorio, protegido por download tanto da gestão quanto de Compras. Modelo A4 com logo Deus é Mais, dados cadastrais e sete colunas do modelo aprovado (código, fornecedor, descrição, marca, quantidade, custo unitário e total). Cabeçalhos repetidos por página, solicitação original preservada após orçamento e totais arredondados por linha em centavos.

Atualização de saldos: iniciar análise usa exclusivamente a última base local do Bling e libera imediatamente as importações. Não dispara nem acompanha sincronização da API. Para saldos mais recentes, sincronizar no menu Integrações antes de iniciar. Análises antigas ainda aguardando sincronização recebem a última base local ao abrir.

A tela exibe a data/hora mais recente de estoque_bling_em entre os produtos congelados, no fuso America/Sao_Paulo. Ausência de data aparece como não disponível; a abertura da análise não é tratada como atualização do estoque.

Giro é importado em uma única requisição transacional, sem prévia de sessão. SKUs desconhecidos ou versão concorrente rejeitam a operação sem alterar o giro. Full e orçamento mantêm a conferência com prévia salva antes da resposta.
