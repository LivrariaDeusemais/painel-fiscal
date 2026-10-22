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

## Central de promoções: integração na própria tabela

Em `Preços → Promoção Mercado Livre`, filtre a decisão Participar, marque as caixas junto do SKU e clique **Integrar decisões dos selecionados**. Esse botão inicia a publicação dos itens selecionados visíveis, sem uma segunda tela de prévia. Salvar decisões continua sendo apenas uma alteração local. As prévias descritas abaixo permanecem no fluxo legado e no envio de brutos.

O servidor consulta cada anúncio individualmente e, quando necessário, busca a oferta pelo filtro `item_id` da campanha. Uma página global incompleta não bloqueia o lote. Antes de escrever, confere os dados analisados, margem/decisão, preço, benefício, elegibilidade, propriedade do anúncio e estoque. Um erro em um item não interrompe os demais. Tipos sem contrato de publicação validado e ofertas com boost continuam bloqueados individualmente.

A coluna Participação tem filtro e guarda a confirmação por conta/campanha/anúncio: **Participando** inclui participação ativa ou programada; **Não participando** representa ausência confirmada; **Pendente de confirmação** representa leitura indisponível ou resposta de escrita incerta. Os motivos e a data aparecem no ícone de informação. O ícone ↻ do título consulta os itens visíveis sem publicar. A tabela acompanha o processamento sem recarregar e permite retomar a consulta após atualizar a página.

Participações já confirmadas não recebem nova admissão. Campanhas próprias flexíveis podem atualizar um preço quando permitido pela API. A escolha Não participar não remove uma oferta existente. Uma escrita ambígua nunca é repetida automaticamente: fica persistida antes do envio, exige nova consulta e uma espera mínima de dois minutos antes de uma nova tentativa manual quando a API ainda indicar ausência. O relatório preserva os resultados por item.

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

## Nomes e períodos das ofertas

A central mostra PRICE_MATCHING como **Para ganhar competitividade** e UNHEALTHY_STOCK como **Acelere suas vendas de estoque Full**, mantendo o identificador e nome original da API para conferência. Não altera decisões nem preços por renomear a apresentação.

A coluna **Período da oferta** usa `start_date` e `end_date` (ou `finish_date`) do item, em Brasília. Datas sem fuso são datas locais do calendário e não são deslocadas pelo fuso do servidor. A lista e o cabeçalho resumem esses períodos; prazos diferentes são indicados como variáveis por item. Datas não fornecidas ficam explicitamente não informadas, sem substituir pelo período geral do cadastro. A vigência geral da campanha fica recolhida em **Cadastro da campanha na API**, pois não equivale ao prazo específico de adesão/oferta. Nenhum prazo é deduzido do print ou de uma duração padrão.

## Análise por produto

A entrada principal da Central abre `/central-promocoes/por-produto`. A visão anterior continua em `/central-promocoes?visao=campanhas`, com os mesmos identificadores, decisões, bônus conferidos e cálculos. A nova tela apenas reorganiza os dados: agrupa por SKU + MLB e mantém uma linha por campanha/oferta, inclusive prazos distintos. Informações comuns do anúncio ocupam células agrupadas; o SKU permanece fixo na rolagem horizontal.

Filtros de SKU/anúncio/produto, campanha, estoque, decisão e participação consultam toda a base importada. A paginação mostra 25, 50 ou 100 anúncios; as caixas de seleção em grupo abrangem **somente as ofertas exibidas na página**, com decisão Participar, e excluem campanhas próprias. Estas exigem seleção individual. É possível selecionar várias campanhas para o mesmo anúncio. Duas ofertas diferentes do mesmo anúncio dentro da mesma campanha exigem escolha individual de uma delas para evitar ambiguidade.

O salvamento usa as chaves existentes seller/campanha/anúncio/oferta; não publica nada. A integração cria uma operação única e executa cada campanha com as mesmas conferências individuais já usadas na visão anterior: cadastro, estoque, bruto, preço, bônus, margem, restrições e confirmação pela API. Uma falha não interrompe o processamento das outras campanhas. Participações confirmadas não são admitidas novamente. Envios sem confirmação ficam pendentes e não são reenviados automaticamente. A coluna de participação, o histórico desta visão e o relatório identificam o resultado por campanha/oferta. A atualização visual é vinculada à identidade da oferta, não à posição da linha.

A atualização manual e a consulta automática das 03h permanecem disponíveis. A consulta de preços/condições não envia decisões. O filtro de participação pode ser reaplicado depois de integrar para localizar ofertas ainda não participantes. Enquanto houver alterações de preço, bônus ou decisões sem salvar, a navegação solicita atenção para evitar perda dessas edições.

### Ajuste de condições das promoções (22/10/2026)

As campanhas Meli usam a sugestão da API dentro de min_discounted_price/max_discounted_price; a regra líquido menos dez centavos foi removida nas duas visões. Campanhas próprias continuam usando o líquido calculado. Ofertas relâmpago preenchem a reserva com stock.min, validada contra stock.max e estoque disponível, em vez de reservar todo o estoque. Ausência de limites de reserva exige revisão, sem inventar uma quantidade. A mudança da política invalida a base dos rascunhos anteriores para recalcular preços e decisões.

Integrar na visão por campanha serializa e valida somente as linhas selecionadas; uma reserva inválida em outra linha não bloqueia o lote. A validação de preço, margem e estoque continua no servidor e na conferência da API antes de cada envio. Salvar decisões mantém seu escopo na análise completa.
