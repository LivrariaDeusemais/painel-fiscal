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
