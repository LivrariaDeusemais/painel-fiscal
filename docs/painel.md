# Painel de trabalho

`/visao-geral` agora mostra o painel operacional. Os indicadores financeiros continuam em `/financeiro`. Não são migrados ou redefinidos status de contas, preços, fechamentos ou downloads.

## Tarefas e recorrência

- `painel_rotinas` guarda a programação; `painel_tarefas` guarda cada execução. A combinação rotina/prazo é única. A geração é transacional, bloqueia a programação e usa um marcador de datas já geradas.
- As ocorrências são materializadas ao abrir o painel/agenda até o fim do período consultado, ou até hoje se posterior. Não dependem de cron e não desaparecem quando vencem. Consultas futuras são limitadas a um ano.
- Repetições: única, diária, semanal, mensal, trimestral e anual. Meses curtos preservam o dia original: 31/jan, 28/fev, 31/mar. Dias úteis ignora ocorrências em sábado/domingo, sem deslocar prazos ou considerar feriados.
- O andamento reúne tarefas abertas com prazo no período e tarefas efetivamente concluídas no período, pela data de São Paulo. Pendências anteriores são mostradas à parte. Não é uma medição de tempo trabalhado.
- Conclusão, reabertura e delegação exigem versão atual e bloqueio da execução. Delegar modifica somente aquela ocorrência, exige motivo, preserva o criador e adiciona o novo responsável aos participantes. O histórico é mantido em `painel_eventos`.
- Pausar uma rotina impede novas execuções e cancela somente ocorrências futuras ainda abertas; preserva as pendências de hoje/anteriores e todas as conclusões. Não exclui registros.

## Acesso

- Administrador vê os blocos de todos os usuários e pode atuar nas tarefas. Outros perfis veem a própria rotina e as tarefas que criaram ou das quais participaram.
- Apenas responsável atual e administrador concluem, reabrem ou delegam. Somente criador e administrador pausam uma programação.
- Usuários comuns não podem abrir o painel ou os avisos de outro usuário por URL. Atalhos e favoritos são validados contra as telas disponíveis ao perfil; as rotas de destino continuam aplicando suas próprias permissões.
- Todos os POST usam o token individual de sessão (`X-Painel-Token`). Respostas de dados não usam cache. Nenhum e-mail ou mensagem externa é enviado.

## Avisos da Central de downloads

O adaptador lê os mesmos grupos, arquivos, liberações, tipos personalizados, linhas ocultas e campos de Data Download usados pela Central. Só há pendência quando o grupo está liberado, tem arquivos e não possui a data de download. Texto “Baixado” sem data não oculta a pendência.

O histórico atual da Central é compartilhado por competência e tipo, sem identificação individual de contador. Por isso o aviso é dirigido aos perfis CONTADOR usando essa mesma baixa compartilhada. Não são inventadas confirmações individuais nem alterados registros anteriores. O administrador vê esses avisos apenas dentro dos blocos dos contadores; usuários operacionais não recebem o aviso contábil em destaque.

## Favoritos

`painel_favoritos` guarda somente as URLs escolhidas por usuário. No painel os atalhos ficam no submenu, com estrela e lápis junto ao título. Nas outras páginas executivas ficam no menu à direita, aberto por hover, teclado ou clique. Nenhuma seleção inicial é imposta aos usuários. O layout antigo continua disponível.

## Verificação

`test/painel.test.js` cobre calendários, recorrência, acesso, andamento, favoritos e origem dos avisos. A implementação também foi verificada com PostgreSQL isolado (PGlite instalado fora do repositório) para geração idempotente, transações, delegações sucessivas, conflito de versão, auditoria, pausa, isolamento dos favoritos e CSRF, além de navegação local com dados fictícios.
