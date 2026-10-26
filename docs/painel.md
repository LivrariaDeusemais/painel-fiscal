# Painel de trabalho

`/visao-geral` agora mostra o painel operacional. Os indicadores financeiros continuam em `/financeiro`. Não são migrados ou redefinidos status de contas, preços, fechamentos ou downloads.

## Tarefas e recorrência

- `painel_rotinas` guarda a programação; `painel_tarefas` guarda cada execução. A combinação rotina/data original da ocorrência é única, mesmo quando o prazo é editado. A geração é transacional, bloqueia a programação e usa um marcador de datas já geradas.
- As ocorrências são materializadas ao abrir o painel/agenda até o fim do período consultado, ou até hoje se posterior. Não dependem de cron e não desaparecem quando vencem. Consultas futuras são limitadas a um ano.
- Repetições: única, diária, semanal, mensal, trimestral e anual. Meses curtos preservam o dia original: 31/jan, 28/fev, 31/mar. Dias úteis ignora ocorrências em sábado/domingo, sem deslocar prazos ou considerar feriados.
- O andamento reúne tarefas abertas com prazo no período e tarefas efetivamente concluídas no período, pela data de São Paulo. Pendências anteriores são mostradas à parte. Não é uma medição de tempo trabalhado.
- Conclusão, reabertura e delegação exigem versão atual e bloqueio da execução. Delegar modifica somente aquela ocorrência, exige motivo, preserva o criador e adiciona o novo responsável aos participantes. O histórico é mantido em `painel_eventos`.
- Pausar uma rotina impede novas execuções e cancela somente ocorrências futuras ainda abertas; preserva as pendências de hoje/anteriores e todas as conclusões. Não exclui registros.

## Acesso

- Todo usuário vê suas próprias tarefas e as que criou para outras pessoas. Qualquer pessoa pode criar ou delegar (quando autorizada a executar a tarefa) para qualquer usuário ativo dos perfis suportados.
- Um ADM configura os usuários cujas tarefas cada pessoa pode acompanhar, independentemente do perfil dessa pessoa. O vínculo é direto, sem herdar as equipes dos acompanhados. Acompanhamento por usuário comum concede leitura, sem ações de execução ou autoria.
- Apenas responsável atual e ADM com acesso mapeado concluem, reabrem ou delegam. Editar/excluir permanece exclusivo do criador. Antigos responsáveis não mantêm acesso apenas por participação passada.
- Todos os POST usam token individual de sessão (`X-Painel-Token`). URLs e consultas são autorizadas no servidor. Nenhum e-mail ou mensagem externa é enviado.

## Avisos da Central de downloads

O adaptador lê os mesmos grupos, arquivos, liberações, tipos personalizados, linhas ocultas e campos de Data Download usados pela Central. Só há pendência quando o grupo está liberado, tem arquivos e não possui a data de download. Texto “Baixado” sem data não oculta a pendência.

O histórico atual da Central é compartilhado por competência e tipo, sem identificação individual de contador. Por isso o aviso é dirigido aos perfis CONTADOR usando essa mesma baixa compartilhada. Não são inventadas confirmações individuais nem alterados registros anteriores. O administrador vê esses avisos apenas dentro dos blocos dos contadores; usuários operacionais não recebem o aviso contábil em destaque.

## Favoritos

`painel_favoritos` guarda somente as URLs escolhidas por usuário. No painel os atalhos ficam no submenu, com estrela e lápis junto ao título. Nas outras páginas executivas ficam no menu à direita, aberto por hover, teclado ou clique. Nenhuma seleção inicial é imposta aos usuários. O layout antigo continua disponível.

## Verificação

`test/painel.test.js` cobre calendários, recorrência, acesso, andamento, favoritos e origem dos avisos. A implementação também foi verificada com PostgreSQL isolado (PGlite instalado fora do repositório) para geração idempotente, transações, delegações sucessivas, conflito de versão, auditoria, pausa, isolamento dos favoritos e CSRF, além de navegação local com dados fictícios.

## Painel e tarefas por pessoa (26/10/2026)

- Painel principal mostra resumos de tarefas próprias e da equipe mapeada, progresso individual, downloads liberados e pendências de preços (Sem Vínculo, Novo, Novo custo, Reajustar e Revisar). As tarefas criadas para pessoas fora da equipe ficam na agenda, sem somar as demais tarefas privadas do destinatário. Indicadores de preços usam a classificação da Tabela por Marketplace e não publicam alterações automaticamente.
- Agenda tem pessoas à esquerda e tarefas/conversas à direita. Mostra pessoas mapeadas, o próprio usuário e pessoas para quem criou tarefas. Cada lista usa apenas tarefas autorizadas; criar uma tarefa para superior não revela as outras dele.
- Filtro Situação: Todas inclui pendências anteriores ainda abertas; A concluir usa prazos dentro do período escolhido; Concluídas usa a data de conclusão em São Paulo dentro do período. Período/situação são preservados na navegação por pessoa e edição.
- Botão de retorno fica na barra de ações superior. Lápis ao lado de Concluir/Reabrir aparece apenas ao criador e abre o formulário de edição. Edição altera a execução selecionada, sem alterar próximas ocorrências. Exclusão é lógica, preservando auditoria e identidade da ocorrência.
- Responsável atual e ADM mapeado podem registrar observações; criador e executores autorizados podem responder. Textos têm limite de 4.000 caracteres e são escapados. Alterações exigem versão atual, token e bloqueio transacional.
- Respostas, observações e conclusão por outra pessoa geram aviso ao criador; respostas do criador vão ao responsável. Mensagens novas incluem texto da resposta. Avisos antigos preservam seu conteúdo original.
- Ícone de conversa por pessoa mostra mensagens/avisos não lidos do próprio usuário, agrupados pelo responsável da tarefa. Clique no nome ou ícone abre as mensagens dessa pessoa; abrir a tarefa não baixa os avisos. Somente eventos efetivamente visíveis em aba ativa marcam os IDs renderizados como lidos; respostas novas não exibidas permanecem pendentes. A rota de leitura recusa solicitações sem a lista de IDs e restringe destinatário/tarefa. Também há baixa manual. Contagens não dependem do filtro de situação/período, para não ocultar mensagens antigas ainda não lidas.
- O bloco Mensagens não lidas fica no topo do painel, com contador e acesso às conversas. Atualização a cada 5 segundos enquanto a página está visível e ao recuperar foco, sem recarregar formulários. Não há comunicação por WhatsApp/e-mail.

## Configuração de equipes e acompanhamento

- Administração → Equipes e acompanhamento (`/painel/equipes`) permite a qualquer ADM mapear, para cada usuário, uma ou mais pessoas cujas tarefas ele pode visualizar. Uma pessoa pode ser acompanhada por mais de um usuário.
- `painel_equipe_acessos(gestor,usuario)` guarda os vínculos diretos; `painel_equipe_acessos_historico` registra antes/depois, autor e data. A gravação compara a seleção anterior e bloqueia a configuração, recusando alterações concorrentes.
- Migração copia uma única vez os vínculos anteriores de `painel_equipe_membros`, preservando acesso existente. Flag `mapeamento_migrado` impede recriar vínculos revogados em reinícios. Usuários novos começam com acesso às próprias tarefas, até serem mapeados por ADM. As tabelas anteriores permanecem para histórico.
- Criação para qualquer destinatário não modifica vínculos de visualização. Contexto é recarregado no servidor a cada consulta/mutação; revogação é imediata. Autoria conserva acesso à tarefa criada.
- O isolamento aplica-se ao Painel/Agenda/Tarefas. Demais módulos e catálogo compartilhado seguem suas permissões existentes.
