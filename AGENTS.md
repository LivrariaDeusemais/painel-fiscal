# Preferências de interface do Plennatec

Quando o usuário solicitar filtro ou escolha no título de uma coluna, use o padrão da Tabela por Marketplace: título com pequena seta verde ao lado e menu branco flutuante com opções, realce verde suave na opção escolhida e marca de seleção. Não use select nativo embaixo do título. Preserve os demais filtros e feche o menu ao clicar fora ou pressionar Escape.

# Funções e alertas automáticos

Toda nova tela ou bloco com acesso configurável deve entrar em `src/access/catalog.js`, com a permissão aplicada também no servidor. Não conceda a opção nova automaticamente a funções existentes. Preserve os bloqueios de faturamento/lucro e administração dos perfis sem autorização.

Alertas automáticos devem usar o padrão de `src/painel/automatic.js`, com origem, responsável, critério de entrada e critério de resolução documentados. Mostre-os no módulo de origem e na visão de tarefas do responsável/superior mapeado. Avisos por e-mail precisam de deduplicação por evento e falha visível; testes usam remetente simulado.
