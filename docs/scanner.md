# Escâner do aplicativo Plennatec

Acesso pelo botão Escanear, antes de Compartilhar, no aplicativo da calculadora.
O diálogo preserva o formulário da calculadora; fechar com páginas pendentes
pede confirmação. Em telas estreitas o botão mostra apenas o ícone.

## Permissões

Capacidade nova `scanner`, Financeiro → Escâner de documentos (aplicativo),
registrada em `src/access/catalog.js`, sem concessão às funções existentes.
ADM tem acesso. Demais usuários precisam de Ver + Gerenciar nessa capacidade
e em Arquivos de comprovantes. Gerenciar não concede download. Não há uma
rota nova de download: a visualização do PDF segue `/arquivo/ver/:id` e sua
permissão de download existente. A gravação valida sessão e CSRF antes do upload.

## Captura e revisão

Câmera ao vivo via getUserMedia com preferência pela câmera traseira, sem áudio;
se indisponível, Abrir câmera passa a usar a captura nativa `capture=environment`; seleção de foto também fica
disponíveis. O navegador pode apresentar interfaces diferentes no iOS/Android.
A câmera é encerrada ao fechar, ocultar a página, capturar ou iniciar envio.
As imagens são processadas no aparelho; só as páginas revisadas são enviadas.

A sugestão de bordas examina papel claro ou escuro, compensa iluminação lateral
e evita recortes pequenos que cortem o texto. Em baixo contraste pode usar um
enquadramento conservador da região de texto, com margem, ou a foto inteira.
Sempre há revisão. Os quatro pontos têm área de toque ampliada e margem em volta
da foto, com lupa durante o arraste. Não há números, setas ou checkbox de leitura.
A melhoria de contraste é automática. Girar, Usar Foto (sem recorte),
+ Substituir foto e Continuar ficam na revisão da captura. A câmera aberta mostra
somente Escanear; a tela inicial mostra Abrir câmera e Escolher foto.
A transformação projetiva corrige perspectiva; não há OCR ou garantia de
recuperação de texto desfocado/reflexos. Prévia ampliável, excluir e reordenar.

Na prévia, + Adicionar página fica junto de Excluir. O envio chama Salvar e enviar.
Após confirmação do servidor, uma etapa exclusiva mostra “Documento enviado com
Sucesso para Plennatec! 👍”, Escanear novo documento e Voltar Calculadora.

PDF com até 20 páginas/20 MB; imagens reduzidas a até 2000 px no maior lado.
O servidor aceita JPEG com limite por página e valida dimensões/conteúdo antes
de gerar PDF multipágina com PDFKit. Nome informado é mantido em nome_original
(e no nome sugerido ao visualizar); o nome físico usa UUID para evitar colisões.
Nenhum renomeio automático sobrescreve o nome escolhido.

## Envio e alertas

POST `/arquivo/escanear` cria `arquivo_fila`, origem `APP_SCANNER`, status
`DISPONIVEL`. O documento entra no fluxo normal de análise/conciliação. Seu
conteúdo é dado, não instrução para execução de ações. A transação e chave de
envio por usuário impedem duplicação por duplo toque/reenvio. Alterar o conteúdo
com a mesma chave já recebida é rejeitado para evitar perda silenciosa.
Se a análise falhar após salvar, o retorno informa que o documento está salvo
com análise pendente. Falha de rede mantém páginas em memória para nova tentativa;
recarregar/fechar o aplicativo perde páginas não enviadas (há aviso ao sair).

Usa o alerta automático existente de Arquivos em `src/painel/automatic.js`:
origem arquivo_fila, responsável com permissão de gerenciar Arquivos, entrada
status DISPONIVEL, resolução ao lançar/usar/excluir no fluxo existente. O mesmo
contador aparece no painel e na visão do responsável/superior mapeado; não cria
outro aviso ou e-mail por página.

## Validação

Testes locais: permissões positivas/negativas, sessão/CSRF, PDF multipágina,
JPEG inválido, geometria/perspectiva, sugestão de cantos, gravação e reenvio sem
duplicação. Conferência visual em Chrome com documento artificial e viewport
390 px. Câmera real e interfaces nativas iPhone/Android precisam de teste nos
aparelhos após publicação. Nenhum documento foi enviado à produção nesta etapa.
Referências: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
 e https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture

## Refinamento das margens do papel

Antes de usar o enquadramento de segurança baseado no texto, o detector procura
quatro bordas contínuas ao redor da região impressa. Ajusta inclinação e posição
das linhas por contraste, mede suporte ao longo de cada lado e refina o encaixe
com amostras locais. Há uma margem de segurança pequena para não cortar a borda.
A confiança exige quatro lados válidos e cobertura da região principal de texto;
pequenas marcas no fundo podem ser descartadas como ruído. Se não houver suporte
suficiente, mantém os métodos anteriores e a possibilidade de ajuste manual.

A comparação local do comprovante de restaurante fornecido mostrou o novo
contorno próximo do papel, em vez do retângulo largo anterior. O print contém o
contorno antigo desenhado sobre a foto; essa comparação não substitui validação
com fotografias originais e novas capturas no iOS/Android. Teste sintético cobre
papel inclinado com margens brancas largas, fundo claro com variação de luz e
marcas fora do documento, verificando distância de cada canto à borda conhecida.
Não foi adicionado enquadramento ao vivo antes da captura nesta alteração.
