# Piloto multiempresa do Plennatec

A Deus é Mais continua usando `/login` e seus dados atuais. As contas convidadas usam `/clientes/login`. Os cadastros, despesas, comprovantes e logomarcas do piloto ficam em tabelas próprias, vinculados ao identificador da empresa atribuído pelo servidor. Os dados da Deus é Mais permanecem nas tabelas atuais. A conta de cliente não entra nas rotas internas.

## Preparar o ambiente de piloto

- Configure `PLENNATEC_CLIENTES_URL` com a origem HTTPS do ambiente que executa esta versão do Plennatec. É essa origem que será usada no link do convite.
- O envio usa a configuração existente `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` e `ALERTAS_EMAIL_FROM` (ou o usuário SMTP como remetente).
- Use um `SESSION_SECRET` próprio no ambiente. A aplicação atual usa sessões em memória, portanto mantenha uma instância no piloto. Antes de operar com várias instâncias, configure um armazenamento compartilhado para as sessões.
- As tabelas `cliente_*` são criadas quando o portal ou a administração precisa do banco pela primeira vez. Use a mesma origem para ativar a conta e entrar no portal.

## Ativar uma empresa

Em **Administração → Empresas clientes**, informe a empresa e o e-mail do responsável. Marque os módulos disponíveis e selecione **Ver**, **Baixar** e **Gerenciar** para o responsável, conforme aplicável. A primeira versão gerencia uma conta de responsável por empresa. As mudanças salvas passam a valer na próxima requisição.

Um convite expira em 48 horas. O painel sinaliza erro de envio e permite reenviar ou revogar. O reenvio gera outro link e invalida o anterior. A ativação confirma o e-mail, define a senha e configura os dados cadastrais. No portal, cadastre uma categoria e um fornecedor para fazer o primeiro lançamento. A listagem e a exportação Excel usam o mês selecionado.

## Testes

`npm test` executa os testes unitários. A integração em `test/empresas-clientes.test.js` usa um PostgreSQL descartável por socket local com `PLENNATEC_TEST_PG_SOCKET`, porta 55444, usuário `plennatec` e banco `postgres`. Use um diretório temporário `/tmp/plennatec-pg.*`. O teste usa dados fictícios e um remetente simulado.
