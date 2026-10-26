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

- Administrador vê e atua nas tarefas de sua equipe. Outros perfis veem a própria rotina e as tarefas que criaram; participação anterior em delegação não mantém acesso.
- Apenas responsável atual e administrador da equipe concluem, reabrem ou delegam. Somente criador e administrador da equipe pausam uma programação.
- Usuários comuns só abrem tarefas de outra pessoa se forem os criadores dessas tarefas; avisos contábeis de outra pessoa não são liberados. Atalhos e favoritos são validados contra as telas disponíveis ao perfil; as rotas de destino continuam aplicando suas próprias permissões.
- Todos os POST usam o token individual de sessão (`X-Painel-Token`). Respostas de dados não usam cache. Nenhum e-mail ou mensagem externa é enviado.

## Avisos da Central de downloads

O adaptador lê os mesmos grupos, arquivos, liberações, tipos personalizados, linhas ocultas e campos de Data Download usados pela Central. Só há pendência quando o grupo está liberado, tem arquivos e não possui a data de download. Texto “Baixado” sem data não oculta a pendência.

O histórico atual da Central é compartilhado por competência e tipo, sem identificação individual de contador. Por isso o aviso é dirigido aos perfis CONTADOR usando essa mesma baixa compartilhada. Não são inventadas confirmações individuais nem alterados registros anteriores. O administrador vê esses avisos apenas dentro dos blocos dos contadores; usuários operacionais não recebem o aviso contábil em destaque.

## Favoritos

`painel_favoritos` guarda somente as URLs escolhidas por usuário. No painel os atalhos ficam no submenu, com estrela e lápis junto ao título. Nas outras páginas executivas ficam no menu à direita, aberto por hover, teclado ou clique. Nenhuma seleção inicial é imposta aos usuários. O layout antigo continua disponível.

## Verificação

`test/painel.test.js` cobre calendários, recorrência, acesso, andamento, favoritos e origem dos avisos. A implementação também foi verificada com PostgreSQL isolado (PGlite instalado fora do repositório) para geração idempotente, transações, delegações sucessivas, conflito de versão, auditoria, pausa, isolamento dos favoritos e CSRF, além de navegação local com dados fictícios.

## Painel e tarefas por pessoa (26/10/2026)

- O painel principal mostra resumos de tarefas pendentes, progresso individual, downloads liberados e pendências de preços (Sem Vínculo, Novo, Novo custo, Reajustar e Revisar). Preços usam a mesma classificação da Tabela por Marketplace, com acesso ao filtro correspondente. Esses indicadores não geram nem publicam alterações automaticamente.
- A agenda tem pessoas à esquerda e tarefas da pessoa selecionada à direita. ADMIN acompanha sua equipe, definida em Administração → Equipes dos administradores. O administrador principal distribui as pessoas; os demais ADMs apenas consultam sua equipe.
- Usuário comum vê todas as tarefas de sua responsabilidade e, em outras pessoas, somente tarefas que ele criou. Participação anterior em uma delegação não concede mais leitura após sair da responsabilidade; isso substitui a regra anterior documentada acima. A mesma restrição vale para URLs e consultas no servidor.
- Somente o criador edita ou exclui uma tarefa, inclusive quando o solicitante é ADMIN. A edição modifica apenas a execução selecionada. Exclusão é lógica (`excluido_em`), preservando auditoria e a identidade da ocorrência; próximas ocorrências de uma rotina continuam programadas.
- Responsável atual e ADMIN registram observações. Criador, responsável atual e ADMIN podem responder na conversa da tarefa. Textos têm limite de 4.000 caracteres e são escapados na exibição. Alterações e mensagens exigem versão atual, token de sessão e bloqueio transacional.
- Respostas, observações e conclusão por outra pessoa geram aviso interno ao criador (respostas do criador são dirigidas ao responsável). `painel_notificacoes` guarda destinatário e chave única por tarefa/versão/ação. Conclusão já realizada não gera novo aviso; reabrir e concluir novamente cria um novo evento legítimo.
- Mensagens e avisos atualizam a cada 30 segundos enquanto a página está visível, sem recarregar formulários em edição. Marcar como lida exige o próprio destinatário. Avisos de tarefas excluídas ou sem acesso atual não são exibidos. Nenhuma comunicação é enviada por WhatsApp, e-mail ou serviços externos.

## Configuração de equipes

- `painel_equipe_config` fixa o administrador principal na primeira inicialização (primeiro ADMIN existente por ID). Não depende da ordem de login nem muda automaticamente a cada consulta.
- `painel_equipe_membros` vincula cada usuário/contador a um único ADM. Cada administrador pertence implicitamente à própria equipe. Na implantação e na criação posterior de usuários sem equipe, o vínculo inicial é com o administrador principal, que pode redistribuí-los.
- `/painel/equipes` oferece a configuração com responsável atual, escolha de ADM e histórico de transferências em `painel_equipe_historico`. Somente o principal pode alterar; alteração concorrente do vínculo é recusada.
- Criação e delegação exigem destinatário da equipe atual. Consultas e mutações recarregam os vínculos no servidor. O ADM principal também fica limitado à própria equipe na leitura de tarefas; a autoridade de configuração não dá leitura global das conversas.
- O criador mantém acesso ao que criou após uma transferência, preservando acompanhamento e autoria. Essa exceção não dá acesso às demais tarefas da pessoa transferida.
- O isolamento aqui se aplica ao Painel/Agenda/Tarefas. Permissões dos outros módulos, catálogo de preços compartilhado e baixa compartilhada de downloads continuam seguindo suas regras existentes.
