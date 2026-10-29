# Shopee Full: XMLs da série 5 — etapa 1

Tela: `/integracoes/shopee-nfe` (Integrações → Shopee Full / NF-e).

Escopo: XML autorizado original, modelo 55, emitente Deus é Mais
`18862388000103`, série 5, entrada (`tpNF=0`) e saída (`tpNF=1`).
O retorno simbólico é emitido pela própria Deus é Mais; não selecionar apenas
notas cujo destinatário seja a empresa. A primeira competência desejada é outubro/2026;
o mês corrente é consultado até o dia atual de São Paulo.

## Configuração e autorização

No servidor, sem colocar segredos no Git ou no chat:

- `SHOPEE_PARTNER_ID`: aplicativo existente, ambiente produção.
- `SHOPEE_PARTNER_KEY`: segredo do aplicativo.
- `SHOPEE_TOKEN_ENCRYPTION_KEY`: segredo aleatório de pelo menos 32 caracteres.
- `APP_BASE_URL`: origem HTTPS do Plennatec.
- `SHOPEE_XML_DOWNLOAD_HOSTS`: caso necessário, lista separada por vírgulas de
  **hosts exatos oficiais** dos links temporários retornados pela Shopee. Não aceitar
  curingas ou domínios fornecidos por usuários comuns. A tela informa o host bloqueado.

Cadastrar como retorno no aplicativo:
`https://app.plennatecsistemas.com.br/integracoes/shopee-nfe/callback`.
O retorno leva um estado aleatório pela query de `redirect`, validado na sessão do
mesmo administrador, com validade de 10 minutos e uso único. É necessário confirmar
esse redirecionamento e os escopos FBS no teste real do aplicativo cadastrado.

Somente ADMIN conecta/reconecta a loja. Tokens AES-256-GCM no banco; renovação
serializada por bloqueio da conexão. A senha da loja não passa pelo Plennatec.
Novas funções não recebem acesso automaticamente. Ver, Baixar e Gerenciar são
separados; Baixar/Gerenciar também exigem Ver. Gerenciar não concede download.

## Fluxo

1. Autorizar loja pelo aplicativo cadastrado.
2. Escolher competência e iniciar busca.
3. `generate_fbs_invoices`: `document_type=7`, `file_type=1`,
   `document_status=1` (autorizados). Não se trata de emissão de NF-e.
4. Persistir IDs das tarefas; consultar `get_fbs_invoices_result` até `READY`.
5. `download_fbs_invoices`, baixar link HTTPS sem tokens da API nos headers.
6. Conferir emitente/série/modelo/período/protocolo/tipo, preservar bytes originais,
   arquivar privadamente e deduplicar por loja/chave. Conteúdo diferente para uma
   chave já arquivada gera pendência; o original não é sobrescrito.
7. Baixar pacotes separados de entradas e saídas; extrair os ZIPs e selecionar os
   XMLs originais na tela apropriada do Bling.

Consultas serializadas por advisory lock; IDs e etapas persistem. Em reinício ou
expiração do tempo de espera, usar **Retomar consulta**. Não cria outra tarefa se
o ID já foi salvo. Uma carga com arquivos rejeitados fica parcial e lista motivos;
nova consulta da competência pode buscar um lote corrigido. Nenhum aviso de sucesso
de importação no Bling é exibido: o envio não faz parte desta etapa.

Pacotes parciais/falhos são identificados no LEIA-ME, inclusive quando há XMLs
aproveitáveis. Os pacotes incluem os XMLs vinculados àquela consulta, inclusive os
já arquivados anteriormente, uma única vez. Não significam “ausentes no Bling”.

## Limites e conferências

- Acesso real às APIs fiscais FBS depende do aplicativo e da loja. Contrato precisa
  ser validado com autorização real; falha ou formato inesperado ficam visíveis.
- Não concilia cancelamentos posteriores, lacunas na numeração ou a existência no
  Bling. “Consulta concluída” significa processamento do lote retornado pela Shopee,
  não garantia de completude fiscal. Conferir lista no Seller Center na homologação.
- XML com protocolo e assinatura presentes não equivale a validação criptográfica
  ou consulta de situação na SEFAZ.
- Não cria notas por JSON, não reemite notas e não lança estoque/contas.
- ZIP até 100 MB; até 10.000 entradas; XML até 5 MB; descompactação limitada a
  250 MB. Nomes do ZIP nunca determinam caminhos no disco. DTD/entidades rejeitados.
- Armazenamento em `UPLOADS_DIR/.shopee-nfe`, bloqueado nas rotas estáticas;
  downloads autenticados conferem SHA-256 antes de gerar o pacote.
- Não adicionar novo alerta automático nesta etapa. Origem fiscal futura deverá
  usar `src/painel/automatic.js` e ter responsável e resolução definidos.

## Referências para homologação

- Shopee Open Platform: `v2.order.generate_fbs_invoices`,
  `v2.order.get_fbs_invoices_result`, `v2.order.download_fbs_invoices`.
  Portal oficial: https://open.shopee.com/ (documentação detalhada exige acesso).
- Conferência de parâmetros de transporte, sujeita ao teste real:
  https://github.com/Naputt1/shopee-v2-go/blob/main/order.type.gen.go
  e https://github.com/congminh1254/shopee-sdk/blob/main/src/managers/order.manager.ts
- Referência oficial Bling: https://developer.bling.com.br/referencia .
  `POST /nfe` cria nota por JSON; não foi identificada rota pública de importação do
  XML autorizado original. Não substituir a importação por criação/reemissão.
- Importação manual de entradas:
  https://ajuda.bling.com.br/hc/pt-br/articles/360036460513-Como-importar-o-XML-de-nota-de-entrada

## Teste em produção antes de considerar a etapa homologada

Configurar as variáveis e o callback, conectar a loja, consultar outubro/2026,
conferir uma entrada de retorno simbólico e uma saída no Seller Center, comparar
quantidades por tipo e chaves; baixar/extrair ambos os pacotes, conferir prévia no
Bling e suas duplicidades. Repetir a consulta e confirmar que não duplica XMLs.
Não confirmar lançamento de estoque nem contas ao importar somente para arquivo.
