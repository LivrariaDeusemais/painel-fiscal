# Integração Mercado Livre — configuração e validação

Na página `/ferramentas-ia/tabela-precos/mercado-livre`, apenas administradores podem conectar a conta, consultar preços ou confirmar envios.

## Aplicativo

Crie o aplicativo Plennatec com a conta brasileira da loja em https://developers.mercadolivre.com.br/devcenter.

Redirecionamento de produção:

`https://app.plennatecsistemas.com.br/ferramentas-ia/tabela-precos/mercado-livre/callback`

Habilite PKCE e os acessos de leitura, escrita e renovação (offline access). Configure no Render:

- `ML_CLIENT_ID`: APP ID.
- `ML_CLIENT_SECRET`: Secret Key, apenas no ambiente do servidor.
- `ML_TOKEN_ENCRYPTION_KEY`: segredo aleatório com pelo menos 32 caracteres. Pode gerar com `openssl rand -hex 32`. Preserve a chave; alterá-la exige reconectar.
- `APP_BASE_URL`: opcional; a URL padrão é a produção acima. Para outro ambiente, cadastre o callback correspondente no aplicativo.

Os tokens ficam cifrados com AES-256-GCM no PostgreSQL. A renovação usa bloqueio de linha para não reutilizar o refresh token em chamadas concorrentes. A troca de conta invalida os preços consultados da conta anterior, preservando os dados importados e manuais.

## Primeira validação

1. Conecte a conta e confira o vendedor exibido.
2. Consulte os preços. Compare alguns MLBs com o portal, incluindo um item sem promoção e outro com promoção. `/sale_price?context=channel_marketplace` fornece o preço ao comprador; `/prices` fornece o preço `standard` do canal. Preços por quantidade, Mshops e referência riscada não são usados como bruto padrão.
3. Compare a origem e data na tabela. Líquido ao comprador não é o valor a receber depois de taxas.
4. Prepare uma prévia para um único anúncio. Observe bruto atual, novo bruto e líquido alvo antes de confirmar.
5. Confira o anúncio no portal após o envio e baixe o relatório. Só então valide um lote maior.
6. Analise uma campanha disponível e valide uma participação antes do lote. Lucro, margem e bonificação são estimativas pelas regras configuradas; a API valida as condições reais.
7. Para campanhas próprias, valide o líquido calculado, estoque, bruto publicado e desconto de cada item. O mínimo de 5% é uma regra do Plennatec; não garante que qualquer campanha aceite o preço. A API pode impor critérios adicionais de credibilidade e elegibilidade.

A carga por Excel e o botão de exportação para o Bling continuam disponíveis. Uma nova importação não invalida automaticamente a última observação direta do Mercado Livre; consulte novamente para atualizar esse preço.

## Envios e interrupções

Nenhuma publicação ocorre na consulta ou preparação da prévia. As prévias expiram 20 minutos depois de preparadas, pertencem ao administrador e à conta que as criou e são consumidas uma única vez. Antes do envio, o sistema verifica propriedade, preço remoto, estoque e cálculo. Brutos são enviados somente ao canal Mercado Livre; anúncios com promoção ativa/programada ou automatização são bloqueados nesse fluxo.

Operações longas trabalham em segundo plano, com bloqueio exclusivo entre instâncias e resultados persistidos por item. Escritas não têm repetição automática. A auditoria registra o início do envio e sua confirmação. Se o processo for interrompido entre esses eventos, confira o anúncio/campanha no portal antes de repetir. Operações interrompidas ficam sinalizadas; não são retomadas automaticamente.

Tipos com publicação habilitada: MARKETPLACE_CAMPAIGN, SMART, PRICE_MATCHING, PRE_NEGOTIATED, UNHEALTHY_STOCK, DEAL com preço sugerido e SELLER_CAMPAIGN flexível. Outros tipos são apresentados para consulta. Ofertas com `boosted_offer` ficam pendentes, pois o benefício adicional exige validação própria.

Campanhas próprias usam FLEXIBLE_PERCENTAGE, até 14 dias, e são criadas somente após confirmação. O identificador retornado é registrado antes da inclusão de itens. Itens recusados permanecem no relatório, sem excluir automaticamente a campanha criada.

## Referências oficiais

- https://developers.mercadolivre.com.br/pt_br/mensagens-post-venda/autenticacao-e-autorizacao
- https://developers.mercadolivre.com.br/devcenter/api-de-precos
- https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/gerenciar-ofertas
- https://developers.mercadolivre.com.br/pt_br/campanhas-do-vendedor
- https://developers.mercadolivre.com.br/pt_br/convivencia-me1-me2/campanha-com-co-participacao
- https://developers.mercadolivre.com.br/pt_br/categorizacao-de-produtos/campanhas-smart-price-matching
- https://developers.mercadolivre.com.br/pt_br/guia-para-produtos/automatizacoes-de-precos
