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
