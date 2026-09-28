# Backup automático no OneDrive

O sistema gera um backup completo todo domingo, entre 02:00 e 02:59 no horário de
Brasília, envia o ZIP ao OneDrive e mantém os quatro backups completos mais recentes.
Um backup antigo só é excluído depois que o novo arquivo foi enviado e seu tamanho foi
validado pela Microsoft.

## Aplicativo Microsoft

1. No Microsoft Entra, crie um registro de aplicativo que aceite contas organizacionais
   e contas pessoais Microsoft.
2. Cadastre como URI de redirecionamento Web:
   `https://app.plennatecsistemas.com.br/backup/onedrive/callback`
3. Crie um segredo do cliente.
4. Em permissões delegadas do Microsoft Graph, habilite `User.Read` e
   `Files.ReadWrite`. O fluxo também solicita `offline_access` durante a conexão.

## Variáveis no Render

- `ONEDRIVE_CLIENT_ID`: ID do aplicativo Microsoft.
- `ONEDRIVE_CLIENT_SECRET`: segredo do aplicativo Microsoft.
- `ONEDRIVE_REDIRECT_URI`: URL de redirecionamento cadastrada acima.
- `ONEDRIVE_TOKEN_ENCRYPTION_KEY`: segredo aleatório longo usado exclusivamente para
  criptografar a autorização persistida no PostgreSQL.
- `ONEDRIVE_BACKUP_FOLDER`: opcional; padrão `Backups PlennaTec`.
- `ONEDRIVE_BACKUP_RETENTION`: opcional; padrão `4`.

Depois do deploy, entre em `/backup`, clique em **Conectar OneDrive** e autorize a conta.
Use **Enviar backup agora** para validar a primeira execução antes de depender do
agendamento semanal.

## Recuperação e segurança

- O upload usa sessões retomáveis em blocos de 10 MiB.
- A autorização do OneDrive é criptografada no banco; a senha Microsoft não é salva.
- A rotina impede execuções simultâneas com trava no PostgreSQL.
- Falhas mantêm os backups antigos e ficam registradas na página administrativa.
- A retenção exclui permanentemente apenas arquivos com o padrão
  `plennatec-backup-completo-*.zip` dentro da pasta gerenciada.
