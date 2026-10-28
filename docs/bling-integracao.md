# Integração com o Bling

Acesse `/ferramentas-ia/tabela-precos/bling` como administrador.

1. Crie um aplicativo privado no Bling, Central de Extensões → Área do Integrador.
2. Use o callback `https://app.plennatecsistemas.com.br/ferramentas-ia/tabela-precos/bling/callback`.
3. Habilite consultas (GET) de Produtos, Estoques e Depósitos. O aplicativo não escreve preços, estoque ou documentos no Bling.
4. Configure no Render `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET` e `BLING_TOKEN_ENCRYPTION_KEY` (segredo aleatório >=32 caracteres, gerado por `openssl rand -hex 32`). A chave cifra tokens persistidos e deve permanecer estável. Não compartilhe tokens/segredos em prints.
5. Salve e publique, entre na página e clique em Conectar Bling. Autorize sua conta no Bling.
6. Consulte depósitos, selecione a Matriz e o Full correspondente a cada marketplace. Escolha Sem Full para os canais sem depósito específico.
7. Salve e clique Atualizar cadastro e estoques. A execução continua em segundo plano e registra progresso no banco; não depende de manter a página aberta. Após reinício do servidor, execuções antigas passam a Interrompida e podem ser reiniciadas. Pode haver atualização parcial; cada produto preserva o último saldo conhecido quando a resposta é incompleta.

## Dados e fontes

- SKU + ID Bling identificam o produto. Divergências não são conciliadas arbitrariamente.
- Cadastro, peso líquido/bruto, preço geral cadastrado no Bling e saldo físico por depósito são consultados pela API v3. Produtos ausentes da consulta não são apagados. Custo atual é preservado.
- Matriz é comum às linhas; Full é específico do marketplace da linha, inclusive no filtro Todos. Um canal configurado sem Full usa 0. Saldo não consultado usa Não atualizado, sem simular 0.
- Arquivo de vínculos continua atualizando o bruto do canal cadastrado no Bling. CSV de carga de preços brutos continua saindo da tabela para importação manual no Bling. A sincronização não envia preços ao Bling nem aos marketplaces.
- O líquido informado na calculadora fica separado da carga Bling e é preservado nas importações. A interface indica origem e data. Promocional do Bling e estimativa pela regra não são apresentados como consulta confirmada ao marketplace.

## Pendências de ativação e custo

É necessário cadastrar o aplicativo e autorizar a conta; sem credenciais não há sincronização real validada.

A especificação pública consultada não oferece GET de lançamentos de estoque; GET NF-e oferece valor unitário, sem o campo custo completo da entrada mostrado na tela. Não usar preço de fornecedor ou valor unitário da nota como equivalente automático. O custo da última entrada exige uma fonte adicional validada (por exemplo relatório de entradas com esse campo, ou recurso oficial disponibilizado pelo Bling). Até essa validação, custos permanecem preservados e a página informa a pendência.

A leitura dos preços efetivamente praticados e a análise/exportação de campanhas do Mercado Livre constituem a etapa seguinte, com autorização própria do marketplace e validação dos modelos oficiais de cada campanha.

## Referências oficiais

- https://developer.bling.com.br/referencia
- https://developer.bling.com.br/aplicativos
- https://developer.bling.com.br/migracao-jwt
- https://developer.bling.com.br/limites

### Preservação de produtos novos
Produtos com status Novo permanecem Novo nas próximas sincronizações de cadastro, custo e estoque, até a validação manual. O valor do custo é atualizado em qualquer status. Somente o status Validado passa para Novo custo quando o custo muda; Novo e Novo custo permanecem como estão até mudança manual. Sem mudança de custo, o status é preservado. A correção não restaura automaticamente status antigos, para não desfazer validações manuais realizadas entre sincronizações.

Publicação pendente a pedido do usuário: não enviar estas alterações à produção enquanto ele estiver utilizando o sistema. Aguardar sua autorização para publicar.

### Ajuste local pendente — seleção na base de produtos

Não publicar sem autorização do usuário. A seleção acumula SKUs entre pesquisas,
filtros e páginas da listagem, com contador de itens inclusive ocultos. A alteração
em lote confirma quantidade e status antes de enviar todos os SKUs. Cancelar ou
falhar preserva a seleção; sucesso, Limpar ou saída da tela encerra a seleção.
Limpar retorna à listagem sem filtros. Ao voltar pelo histórico após sair, os
filtros antigos também são descartados. A exclusão usa a mesma seleção e mantém
confirmação explícita com os SKUs. A autorização ADMIN e a validação de sessão
continuam no servidor, inclusive na alteração de status em lote.

### Carga Bling do Mercado Livre — modelo de edição massiva

Alteração local pendente de publicação: o botão da Tabela por Marketplace para
Mercado Livre gera XLSX, aba `ag-grid`, com as seis colunas do modelo fornecido
`edicao-massiva (1).xlsx`, na ordem e com os títulos originais. Exporta o título do
anúncio, loja `Mercado Livre`, ID MLB, SKU textual, preço bruto calculado numérico
com até quatro casas e modalidade real (Clássico/Premium). Preserva os filtros da
rota e as verificações de custo/peso. Não usa IDs internos do Bling como ID MLB.
A modalidade vem da consulta do anúncio gravada na sincronização; quando ausente,
faz consulta de leitura à API do Mercado Livre, validando a conta proprietária.
Falhas ou modalidade desconhecida interrompem a exportação com aviso, sem gerar
arquivo parcial ou assumir Clássico. As cargas dos demais marketplaces continuam
no CSV anterior. Não altera preços remotamente: o usuário importa o XLSX no Bling.
A permissão de download da rota continua obrigatória e separada de gerenciar.

### Desempenho da leitura de anúncios Mercado Livre

A consulta de vínculos reutiliza registros completos e válidos da listagem atual
(identificação do produto, anúncio e preço bruto), sem usar cache de preços antigo.
Detalhes incompletos são buscados em grupos de até três consultas concorrentes;
o cliente serializa o início de cada requisição com o intervalo existente de
400 ms, inclusive nas tentativas seguintes. Repetições do mesmo ID Bling usam uma
única consulta de detalhes na execução, mas permanecem na verificação de vínculos
duplicados. A tela informa anúncios processados/total a cada grupo. Falha de um
anúncio gera pendência individual e não descarta os anúncios válidos do canal.
Validações de produto ativo, seleção de SKUs, duplicidade e propriedade dos
vínculos na gravação continuam aplicadas. Não há escrita na API do Bling.
A redução real do tempo depende da latência e da completude da listagem do Bling;
não foi medida em produção durante uma sincronização do usuário.

### Cobertura Mercado Livre e ausência de anúncio

A consulta passou a incluir situações 1 (Publicado), 2 (Rascunho), 3 (Com
problema) e 4 (Pausado). Em atualização de SKUs selecionados, cada listagem usa
`idProduto` do Bling: não percorre os demais anúncios da loja. A listagem filtrada
permite relacionar o produto e o preço publicado numérico sem consultar detalhes
quando todos os campos necessários estão válidos. Havendo produto explícito
divergente na resposta, o vínculo não é gravado. A API é somente consultada.
Todo canal consultado aparece no diagnóstico, inclusive quando retornar zero.
Para Mercado Livre, cada produto do escopo sem anúncio retornado gera pendência
com SKU, ID Bling e orientação para revisar a loja/associação. Não significa que
o Mercado Livre recusou o anúncio: pode haver ausência de associação no Bling.
Referência oficial: https://developer.bling.com.br/referencia (GET /anuncios,
filtros idProduto e situacao; preço numérico na listagem e objeto no detalhe).
A execução 49 fornecida pelo usuário registrou apenas erro de preço/identificação
na Amazon; não permite determinar a situação remota de L1397. Não foi possível
reproduzir a consulta autenticada localmente por ausência da chave de tokens no
ambiente local. Nenhum preço ou vínculo foi alterado manualmente em produção.
