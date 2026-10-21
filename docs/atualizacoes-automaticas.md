# Atualizações automáticas das integrações

O servidor verifica a agenda persistida no PostgreSQL a cada 30 segundos. Todos os dias, às 03:00 em America/Sao_Paulo (Brasília), executa em sequência:

1. Bling: cadastro dos produtos ativos, custo do fornecedor padrão, códigos, pesos, estoques, vínculos e preços brutos de todas as lojas já configuradas. Reutiliza a atualização completa existente; líquidos manuais permanecem preservados. Produtos confirmados inativos/excluídos seguem a limpeza já existente.
2. Mercado Livre: campanhas, convites e ofertas por anúncio, como no botão Atualizar campanhas e itens. Nenhuma decisão, adesão ou preço é enviado ao marketplace pela agenda.

A primeira instalação agenda a próxima ocorrência das 03h, sem executar uma carga imediatamente. Não depende de navegador aberto. O serviço web precisa estar em execução: em indisponibilidade, retoma após voltar, sem repetir todos os dias perdidos. Uma trava PostgreSQL impede duplicação entre processos. Reinícios retomam etapas incompletas; etapas concluídas são preservadas. Falhas recebem até três tentativas, com intervalo de 15 minutos. Resultado parcial é registrado e será consultado novamente na execução do dia seguinte. Cada integração pode terminar mesmo quando a outra falha.

Agenda e resultado aparecem nas duas integrações e na lista de campanhas. O histórico das consultas automáticas do Mercado Livre é compartilhado com os operadores, identificado como `automatico-03h`. Os relatórios específicos de cada serviço continuam disponíveis. A atualização manual continua funcionando e as travas de cada integração impedem sobreposição com operações em andamento.

Acesso operacional concedido ao usuário existente Filipe (ID 3, perfil USUARIO), além dos administradores, pela política central em `src/integracoes/access.js`. Não muda seu perfil nem libera outros usuários. Pode consultar dados, atualizar produtos/vínculos, analisar e integrar decisões pelos fluxos existentes. Conectar/reconectar contas e alterar depósitos/lojas permanecem exclusivos do administrador, inclusive por acesso direto às rotas. Cadastro de novas pessoas autorizadas exige alteração explícita da política. O nome e ID são conferidos juntos para evitar liberar outra conta homônima.
