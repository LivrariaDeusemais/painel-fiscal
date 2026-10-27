# Catálogo de alertas do painel

## Ativos

| Menu | Alerta | Entrada | Resolução | Destinatário |
|---|---|---|---|---|
| Painel | Mensagens não lidas | Resposta/observação/conclusão recebida | Leitura efetiva ou baixa manual | Destinatário da mensagem |
| Painel | Tarefas a concluir/atrasadas | Tarefa aberta no período, incluindo atrasadas anteriores | Concluir, excluir ou delegar | Responsável e acompanhamento mapeado |
| Preços | Sem vínculo, Novo, Novo custo, Reajustar, Revisar | Mesma classificação da tabela | Correção refletida na tabela | Acesso à tabela e bloco de preços |
| Financeiro | Documentos para lançar | Documento disponível na fila Arquivo; PDF/XML pareados contam como um documento | Documento sai da fila disponível após uso/tratativa | Quem gerencia Arquivo e superior mapeado |
| Contábil | Arquivos liberados sem download | Tipo liberado, com arquivos e sem data de download | Baixa registrada na Central | Contadora e superior mapeado |
| Contábil | Nova liberação de arquivos | Transição para Liberado para baixar por competência/tipo | Mensagem lida; pendência operacional continua até download | Mensagem e e-mail à contadora com acesso atual |
| Sistema | Falha de aviso por e-mail | Envio falhou ou ficou interrompido | Tratativa do SMTP/destinatário e reenvio | ADM |

A liberação mantém contador de gerações. Salvar novamente o mesmo status não duplica mensagem/e-mail; sair de Liberado e liberar outra vez constitui novo evento. Não são enviados e-mails retroativos na implantação. A fila tenta três vezes, com dez minutos entre falhas. Envio interrompido fica visível ao ADM sem reenvio cego. O transporte usa SMTP já configurado no sistema; teste de integração usa envio simulado.

## Propostos para definir em seguida — ainda não ativados

| Prioridade | Menu | Alerta sugerido | Critério proposto | Falta definir |
|---|---|---|---|---|
| Alta | Financeiro | Contas vencidas / vencendo hoje | Vencimento até hoje, ignorando Pago, Não tem e desconto em operação | Responsável por grupo/categoria e antecedência de aviso |
| Alta | Contábil | Movimentações sem conciliação | Lançamento importado sem vínculo/revisão na conciliação | Prazo de tolerância e responsável por conta bancária |
| Alta | Integrações | Falha de consulta/publicação | Operação encerrada com erro ou pendência de confirmação | Responsável por integração e prazo máximo de confirmação |
| Alta | Compras e Estoque | NF aguardando revisão | Nota importada sem revisão necessária para concluir entrada | Quais divergências bloqueiam a entrada e responsável |
| Média | Compras e Estoque | Entrega pendente | Pedido/nota com entrega ainda não confirmada | Qual registro será fonte do prazo previsto |
| Média | Contábil | Competência aguardando fechamento | Competência anterior aberta/incompleta | Dia limite do mês e quem prepara/aprova |
| Média | Preços | Preço abaixo da margem mínima | Regra vigente reprova margem do produto | Se é alerta separado ou apenas o filtro Revisar existente |
| Média | Integrações | Credencial/certificado perto do vencimento | Data real de validade do certificado ou conexão expirada | Quantos dias antes; responsável técnico |
| Baixa | Compras e Estoque | Estoque baixo | Saldo abaixo do mínimo por SKU/local | Cadastro do mínimo; considerar Matriz/Full separados |

Para aprovar cada regra: definir a fonte, quem executa, quando aparece, quando desaparece, prazo, se envia e-mail e como evitar duplicação. Alertas refletem o estado de origem: não geram tarefas manuais duplicadas a cada acesso.

## Funções e layout

Administração → Funções e acessos (`/funcoes`) organiza menu → tela → ações/blocos (Ver/Gerenciar). O catálogo central fica em `src/access/catalog.js`. Novas permissões ausentes na função são negadas. Os controles de perfil administrativo e conteúdo financeiro continuam sendo limites superiores. Usuários sem função mantêm as regras anteriores; a função Gestor é vinculada uma única vez ao Filipe existente, conforme solicitado. Um ADM pode alterar/remover o vínculo sem que um reinício o refaça.

O painel usa até quatro colunas independentes, reduzindo em telas menores. O primeiro módulo contém Mensagens, Minhas Tarefas e Tarefas da Equipe; Preços, Financeiro e Contábil são módulos separados. Os blocos seguintes ocupam a coluna mais curta. Atrasadas têm amarelo suave; concluídas têm azul suave; o espaço do lápis fica reservado para alinhar Concluir/Reabrir.

## Permissões de funções: consulta, download e gestão
Cada tela possui Ver; quando aplicável, Baixar arquivos (incluindo Excel, CSV, ZIP, PDF e XML) e Gerenciar (criar/editar/excluir). Download e gestão são independentes e pressupõem Ver. Gerenciar sozinho não autoriza baixar. As rotas de arquivos, inclusive PDF aberto em aba e relatórios, validam download no servidor. Um arquivo entregue ao navegador pode ser salvo: por isso a consulta de seu conteúdo original também exige Baixar arquivos. Consultas HTML permanecem em Ver.
O topo do módulo oferece seleção completa e seleção por coluna, com estado parcial. As restrições administrativas e de conteúdo financeiro do perfil continuam válidas.
Na migração, somente funções que já podiam baixar por meio de Gerenciar preservam esse acesso; funções com apenas Ver continuam sem download. Novas funções e novas telas não recebem permissões automaticamente.

## Indicadores do Financeiro e fechamento de despesas (26/10/2026)
- Contas a vencer hoje: primeiro indicador financeiro, somente rotinas ativas e ainda não pagas do mês/dia atual de São Paulo; exclui Pago, DOP e Não tem. Soma o valor previsto da rotina (edição mensal, cadastro ou histórico dos três meses anteriores, na mesma prioridade de Contas a pagar); informa quantas contas não possuem valor. Dias 29–31 são limitados ao último dia do mês. Não inclui vencimentos anteriores e não segue o mês de edição global. Origem/resolução: rotinas e status mensal de pagamento. Aparece também nos alertas da pessoa e de seu superior quando ambos têm acesso ao bloco. Nova permissão `vencimentos-hoje` desmarcada em funções existentes; ADM mantém acesso.
- Arquivos para lançar: segundo indicador financeiro, inclusive quando zero, usando a mesma conciliação PDF/XML da fila usada para Filipe. Resolve ao consumir/remover o documento da fila disponível.
- Fechamento de despesas: pendências por tipo e competência da Central de Downloads desde agosto/2026, até o mês anterior ao atual de São Paulo. Competências não visitadas possuem status padrão Aguardar. Inclui tipos fixos e personalizados ativos/globais ou daquele mês; ignora itens ocultos daquele mês, conforme a Central. Inclui itens sem anexo. Só resolve com status Liberado para baixar; Aguardar e Em andamento permanecem até a liberação, sem expirar com o filtro de período do painel. Se o status voltar a Aguardar/Em andamento, volta ao painel. Ao virar novembro, outubro entra automaticamente. Não depende do status de download da contadora.
- Responsáveis: ADMs e função Gestor do Filipe conforme autorização pontual desta solicitação. Nova permissão `fechamento-despesas` negada para outras funções e configurável na tela de funções; exige acesso à gestão da Central. A liberação pontual é feita uma única vez, não desfaz revogação posterior. Conteúdo automático é filtrado pelo acesso do observador também no endpoint JSON.
- Os mesmos alertas aparecem na visão de tarefas do responsável/superior mapeado. Atualização a cada 30 segundos e ao retornar à aba; indicadores comuns não se duplicam no painel do superior. Consultas indisponíveis geram aviso visível, sem ocultar pendências como se estivessem resolvidas. Não há envio adicional de e-mail nestes indicadores.

## Harmonização do painel e contas em atraso (27/10/2026)
- Cabeçalhos dos blocos em verde suave; títulos verde escuro; textos e responsáveis grafite; valores em verde sóbrio. Avisos preservam amarelo/azul suaves e vermelho para atraso.
- Contas a vencer: tabela compacta com quantidade, valor estimado e status. No prazo contém somente contas de hoje; Atraso agrega vencimentos anteriores ainda não pagos da competência atual. Não inventa pendências de competências antigas sem lançamento/status confiável. Mostra a segunda linha apenas se a quantidade for maior que zero, com texto vermelho. O rodapé informa o recorte do mês atual.
- Ambos os grupos usam os mesmos critérios de ativo, pagamento e estimativa da rotina. Contas sem estimativa entram na quantidade e são informadas separadamente. Links de cada grupo abrem seu intervalo de vencimento no mês atual.
