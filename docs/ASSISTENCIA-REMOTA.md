# Assistencia Remota

## Escopo desta versao

A Assistencia Remota do IT Guardian e um recurso inicial para suporte legitimo
em maquinas Windows proprias ou formalmente autorizadas. A implementacao atual
foi desenhada para laboratorio, homologacao e ambiente interno. Ela permanece
desabilitada por padrao e nao deve ser tratada como uma solucao publica de
acesso remoto.

O fluxo permite:

- iniciar atendimento pelo Inventario ou por uma Ordem de Servico vinculada;
- exigir a senha do tecnico antes de criar a sessao;
- apresentar consentimento local na maquina atendida;
- visualizar um monitor por vez e trocar o monitor selecionado, com aviso
  quando so existe um monitor disponivel;
- pausar e retomar a visualizacao sem encerrar a sessao;
- solicitar e liberar controle basico de mouse e teclado;
- acompanhar FPS real, banda estimada, qualidade e tamanho do ultimo quadro
  no proprio viewer;
- reconectar manualmente quando o agente parar de responder por um tempo;
- trocar mensagens de texto com o usuario local durante a sessao ativa;
- encerrar pelo navegador ou pela maquina atendida;
- registrar os eventos no historico da maquina, da OS e da sessao.

Esta versao usa `snapshot_polling` como transporte padrao, com FPS,
resolucao e qualidade JPEG configuraveis dentro de limites seguros, ajuste
automatico de qualidade e deduplicacao de quadros identicos. Os frames JPEG
trafegam com token curto, ficam somente em memoria e nunca sao gravados no
banco ou no historico. Existem dois transportes alternativos, ambos opt-in e
desligados por padrao: `webrtc` (video por WebRTC, com viewer no navegador e
processo auxiliar no agente Windows — veja "Transporte WebRTC") e `rustdesk`
(cliente nativo — veja "Transporte RustDesk").

## Estado seguro padrao

As flags do backend e do frontend ficam `false` nos arquivos de exemplo. Para
manter o recurso desligado, use:

```env
ENABLE_REMOTE_ASSISTANCE=false
REMOTE_ASSISTANCE_ENV=disabled
ENABLE_REMOTE_CONTROL=false
ENABLE_REMOTE_PRIVACY_MODE=false
ENABLE_REMOTE_ADMIN_ACTIONS=false
REMOTE_ASSISTANCE_LAB_AUTO_CONSENT=false

VITE_ENABLE_REMOTE_ASSISTANCE=false
VITE_ENABLE_REMOTE_CONTROL=false
VITE_ENABLE_REMOTE_PRIVACY_MODE=false
VITE_ENABLE_REMOTE_ADMIN_ACTIONS=false
```

Nos arquivos de exemplo, o transporte tambem ja vem com valores conservadores
mesmo com o recurso desligado (`REMOTE_ASSISTANCE_TRANSPORT=snapshot_polling`,
`REMOTE_ASSISTANCE_TARGET_FPS=3`, `REMOTE_ASSISTANCE_WEBRTC_ENABLED=false`),
para que ativar `ENABLE_REMOTE_ASSISTANCE` sozinho ja resulte num
comportamento seguro sem exigir ajuste fino imediato.

O backend so considera o recurso disponivel quando o ambiente efetivo
(`REMOTE_ASSISTANCE_ENV`, depois `REMOTE_ASSISTANCE_ENVIRONMENT`,
`IT_GUARDIAN_ENVIRONMENT` e `NODE_ENV`, nessa ordem) for `lab`, `homologation`
ou `internal` (ou os aliases `laboratory`, `laboratorio`, `homologacao`,
`interno` e `test`). Em `NODE_ENV=production` sem um desses valores em
`REMOTE_ASSISTANCE_ENV`, `GET /api/remote-assistance/config` devolve
`enabled: false` e as demais rotas respondem `403`. O consentimento
automatico de laboratorio e ignorado em deploy publico (`VERCEL=1` ou
`VERCEL_ENV=production`). O frontend nunca substitui essa validacao do
servidor.

## Habilitar somente em laboratorio

Use estas flags apenas em uma rede de teste, com maquinas conhecidas:

```env
ENABLE_REMOTE_ASSISTANCE=true
REMOTE_ASSISTANCE_ENV=lab
ENABLE_REMOTE_CONTROL=true
ENABLE_REMOTE_PRIVACY_MODE=false
ENABLE_REMOTE_ADMIN_ACTIONS=false
REMOTE_ASSISTANCE_LAB_AUTO_CONSENT=false

VITE_ENABLE_REMOTE_ASSISTANCE=true
VITE_ENABLE_REMOTE_CONTROL=true
VITE_ENABLE_REMOTE_PRIVACY_MODE=false
VITE_ENABLE_REMOTE_ADMIN_ACTIONS=false
```

Reinicie API, frontend e agente depois da alteracao. O consentimento automatico
existe exclusivamente para laboratorio isolado e deliberado. Ele e bloqueado
em implantacao publica e deve continuar `false` no teste humano.

### Habilitar tambem no agente Windows (flag separada, por maquina)

As flags acima ligam a funcionalidade no servidor/frontend, mas cada maquina
com o agente Windows so participa de assistencia remota se o `config.json`
dela tambem tiver `"enableRemoteAssistance": true`. Sem essa segunda flag, o
pedido de sessao do tecnico fica preso em "aguardando" para sempre e **nenhum
aviso de consentimento aparece na maquina** — a bandeja (`RemoteAssistanceTrayController`)
sonda um pipe local a cada 2,5s, mas esse pipe so existe quando o coletor
(`RemoteAssistanceBroker`) inicia, e ele so inicia com essa flag ligada.

Para ligar, na ordem de preferencia:

- **No instalador** (`installers/windows-collector/ITGuardianCollector.iss`,
  compilado por `build-installer.ps1`): marque a opcao "Habilitar assistencia
  remota nesta maquina" no assistente, ou gere/rode o instalador
  silenciosamente com o parametro `/EnableRemoteAssistance=1`. Se essa opcao
  nao aparece (reparo ou "trocar a chave" preservando uma configuracao
  existente), a flag continua vindo do `config.json` ja presente na maquina.
- **Manualmente**: editar `"enableRemoteAssistance": true` direto no
  `config.json` instalado (`C:\ProgramData\ITGuardian\config.json`, ACL
  restrita a SYSTEM/Administradores) — o coletor rele o arquivo a cada ciclo
  de heartbeat, nao precisa reinstalar nem reiniciar a tarefa.

## Ajustar fluidez do transporte snapshot polling

Todos os limites abaixo sao aplicados no servidor
(`server/src/config/environment.js`) mesmo que o valor pedido seja maior —
o objetivo e permitir ajuste fino sem abrir brecha para configuracao
perigosa:

```env
REMOTE_ASSISTANCE_TRANSPORT=snapshot_polling
REMOTE_ASSISTANCE_TARGET_FPS=3        # 1 a 10, nunca acima do teto abaixo
REMOTE_ASSISTANCE_MAX_FPS=3           # teto rigido, 1 a 10
REMOTE_ASSISTANCE_MAX_WIDTH=1280      # 320 a 1920
REMOTE_ASSISTANCE_MAX_HEIGHT=720      # 240 a 1080
REMOTE_ASSISTANCE_JPEG_QUALITY=65     # ponto de partida, 10 a 95
REMOTE_ASSISTANCE_MIN_JPEG_QUALITY=35 # piso do ajuste automatico (10 a 90)
REMOTE_ASSISTANCE_MAX_JPEG_QUALITY=80 # teto do ajuste automatico (20 a 95)
REMOTE_ASSISTANCE_MAX_FRAME_BYTES=700000  # 100000 a 900000
REMOTE_ASSISTANCE_ADAPTIVE_QUALITY=true
REMOTE_ASSISTANCE_VIEWER_POLL_MS=350  # 80 a 2000
REMOTE_ASSISTANCE_AGENT_CAPTURE_MS=350  # 150 a 2000
REMOTE_ASSISTANCE_IDLE_TIMEOUT_SECONDS=60  # 20 a 300
REMOTE_ASSISTANCE_RECONNECT_GRACE_SECONDS=30  # 10 a 120
REMOTE_ASSISTANCE_SESSION_TTL_MINUTES=20  # 5 a 60
```

Os valores acima sao os dos arquivos `.env.example`. Quando a variavel nao e
definida, o codigo (`getRemoteAssistanceConfig`) usa outros padroes mais
generosos: `MAX_FPS=8` (teto 10), `TARGET_FPS` igual a `MAX_FPS`,
`AGENT_CAPTURE_MS` derivado de `1000 / TARGET_FPS` e `VIEWER_POLL_MS` igual a
`AGENT_CAPTURE_MS` (minimo 80 ms). O viewer do navegador usa
`viewerPollMs` devolvido por `GET /api/remote-assistance/config` e, se o
campo faltar, consulta a cada 1000 ms; o estado da sessao e a auditoria sao
consultados a cada 1200 ms.

Comportamento resultante:

- `REMOTE_ASSISTANCE_AGENT_CAPTURE_MS` nunca fica abaixo do intervalo minimo
  implicito por `REMOTE_ASSISTANCE_MAX_FPS` — o servidor corrige o valor
  automaticamente para nao pedir ao agente uma cadencia que ele proprio
  recusaria por excesso de taxa;
- com `REMOTE_ASSISTANCE_ADAPTIVE_QUALITY=true`, o servidor reduz qualidade e,
  se necessario, resolucao quando um quadro aceito fica proximo do limite de
  bytes, e recupera qualidade aos poucos quando os quadros ficam
  confortavelmente pequenos; o agente aplica o `qualityHint` recebido a cada
  poll de comandos, sempre reforcando os mesmos limites localmente;
- o agente calcula um hash do quadro capturado e, se for identico ao
  anterior, envia um aviso leve (`unchanged: true`) em vez do JPEG completo —
  a sessao continua "fresca" para o viewer sem gastar banda com telas
  paradas;
- `REMOTE_ASSISTANCE_IDLE_TIMEOUT_SECONDS` define quando o viewer passa a
  mostrar "reconectando"; `REMOTE_ASSISTANCE_AGENT_TIMEOUT_SECONDS` (ja
  existente) continua sendo o prazo apos o qual a sessao e encerrada por
  perda de comunicacao.

## Relay em deploy serverless (Vercel)

O "relay" e a memoria efemera onde ficam o ultimo quadro, a fila de comandos,
o estado de pausa e a sinalizacao WebRTC de uma sessao ativa — nunca o banco
de dados. Em desenvolvimento local e no perfil Docker, esse relay vive na
memoria do proprio processo Node, que roda continuamente. Isso **nao
funciona em deploy serverless** (Vercel): cada chamada a API pode cair numa
instancia de funcao diferente, sem memoria compartilhada com a instancia
anterior — um frame enviado pelo agente podia simplesmente nao aparecer para
o tecnico.

Para resolver isso sem abrir mao da garantia de "nenhum frame persistido em
banco", o relay pode usar um Redis externo (Upstash) como armazenamento
compartilhado entre instancias, em vez de memoria local:

```env
UPSTASH_REDIS_REST_URL=https://SEU-BANCO.upstash.io
UPSTASH_REDIS_REST_TOKEN=***
```

Comportamento:

- **sem essas variaveis**, o relay continua em memoria — funciona
  normalmente em `npm run dev:server` e no perfil Docker (processo unico e
  persistente), mas fica sujeito a se comportar mal em multiplas instancias
  serverless;
- **com essas variaveis**, o relay usa o Redis automaticamente, sem nenhuma
  outra mudanca de configuracao — a deteccao e feita uma vez, na inicializacao
  do processo;
- o conteudo do relay (inclusive o quadro de tela) fica com TTL de 30 minutos
  no Redis como rede de seguranca, mas continua sendo apagado explicitamente
  ao encerrar, expirar ou negar a sessao — igual ao comportamento em memoria;
- a fila de comandos de mouse/teclado usa operacoes atomicas do Redis
  (`RPUSH`/`LPOP`), para nao perder um clique por causa de duas chamadas
  simultaneas.

### Como criar o Redis

1. No painel do Vercel, va em `Storage` (ou `Marketplace`) e adicione um
   banco Upstash Redis ao projeto — ou crie diretamente em
   [upstash.com](https://upstash.com) (tem plano gratuito suficiente para
   este uso).
2. Copie a "REST URL" e o "REST Token" do banco.
3. Adicione como variaveis de ambiente do projeto no Vercel
   (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) e faca um novo
   deploy para elas entrarem em vigor.
4. Nenhuma alteracao e necessaria no agente Windows nem no navegador — os
   dois continuam falando HTTP com a mesma API de sempre; o Redis e um
   detalhe interno do servidor.

## Permissoes

| Permissao | Finalidade |
|---|---|
| `remote_assistance.view` | Consultar sessao, eventos, frame atual, trocar monitor e pausar/retomar a visualizacao |
| `remote_assistance.chat` | Enviar mensagens no chat da sessao (separada de `.view`: quem so acompanha a tela nao envia mensagem por padrao) |
| `remote_assistance.start` | Solicitar uma nova sessao (e enviar a oferta WebRTC) |
| `remote_assistance.control` | Solicitar controle basico apos consentimento, enviar comandos de entrada e revelar as credenciais do transporte RustDesk |
| `remote_assistance.end` | Encerrar a sessao |
| `remote_assistance.manage` | Administrar o ciclo operacional da sessao |
| `remote_assistance.privacy_mode` | Reservada; recurso nao implementado |
| `remote_assistance.admin_actions` | Reservada; recurso nao implementado |
| `security.reauthenticate` | Confirmar a senha do tecnico |

O botao so aparece quando as flags dos dois lados estao ativas, o usuario tem
as permissoes necessarias e o agente possui heartbeat recente.

## Fluxo do tecnico

1. Abra o Inventario e os detalhes da maquina, ou uma OS vinculada ao ativo.
2. Clique em `Atendimento remoto` ou `Acessar máquina`.
3. Confira nome, hostname, IP, sistema, agente e ultimo contato.
4. Informe um motivo operacional claro.
5. Digite a senha do proprio login.
6. Aguarde o usuario autorizar localmente.
7. Selecione o monitor desejado (o seletor fica oculto quando so existe um).
8. Acompanhe FPS real, banda, qualidade e tamanho do ultimo quadro no rodape.
9. Pause a visualizacao quando nao precisar acompanhar a tela em tempo real e
   retome quando precisar novamente.
10. Se o indicador mostrar "reconectando" ou "agente sem resposta", use o
    botao `Reconectar` para forcar uma nova tentativa antes de encerrar.
11. Quando necessario, solicite o controle de mouse e teclado.
12. Use o painel de chat para trocar mensagens rapidas com o usuario local,
    sem precisar de telefone ou outro canal.
13. Encerre a sessao ao concluir o atendimento.
14. Confira os eventos no historico da maquina e da OS.

A reautenticacao gera um token aleatorio, vinculado ao tecnico, ativo, OS e
acao solicitada. Ele expira em cinco minutos, e consumido uma unica vez e nao
contem a senha. No navegador, a senha digitada vive so no estado do
componente: e enviada a `POST /api/security/reauthenticate`, zerada assim que
o pedido de sessao termina (com sucesso ou erro) e nunca vai para storage,
URL ou console.

## Fluxo do usuario atendido

O agente mostra uma janela local com tecnico, organizacao, motivo e OS. O
usuario pode `Autorizar` ou `Negar`. A captura e o controle nao comecam antes da
autorizacao.

Durante a sessao, o agente exibe permanentemente:

`IT Guardian - Atendimento remoto em andamento`

O botao `Chat` no indicador abre uma janela local para trocar mensagens com o
tecnico enquanto a sessao dura.

O botao `Encerrar atendimento` para a captura, limpa os recursos locais e avisa
o servidor. Fechar o viewer, sair da conta, perder heartbeat ou atingir o
timeout tambem encerra ou expira a sessao.

## Monitores, pausa e controle

O agente envia somente metadados dos monitores: identificador, nome, resolucao
e indicador de principal. O viewer captura um monitor por vez. Quando so
existe um monitor, o seletor fica oculto e a barra mostra o nome do monitor
seguido de "(único monitor)". Ao trocar:

1. o backend valida a sessao e o monitor;
2. registra `monitor_changed`;
3. envia um comando efemero ao agente;
4. o agente muda a origem da proxima captura e reseta a deduplicacao de
   quadros (o primeiro quadro do novo monitor sempre e enviado por completo);
5. o viewer exibe carregamento ate receber o novo frame.

O botao `Pausar` interrompe a busca de novos quadros no viewer e sinaliza o
agente (`capturePaused`) para reduzir a cadencia de captura, preservando CPU e
banda quando o tecnico so precisa manter a sessao aberta sem olhar a tela.
`Retomar` volta ao ritmo normal. Pausar e retomar geram os eventos
`viewer_paused`/`viewer_resumed` na auditoria.

Se o agente parar de enviar quadros, o viewer passa por
"reconectando" (sem novidade por `REMOTE_ASSISTANCE_IDLE_TIMEOUT_SECONDS`) e,
se persistir, "agente sem resposta" — em ambos os casos o botao `Reconectar`
forca uma nova consulta de sessao e quadro sem exigir reabrir o dialogo.

Mouse e teclado exigem, ao mesmo tempo, flag global, permissao do tecnico,
reautenticacao, sessao ativa e consentimento local para controle. A lista de
eventos aceitos e fechada: movimento, cliques, duplo clique, scroll e teclas
comuns enquanto o viewer esta focado.

## Chat da sessao

Tecnico e usuario local podem trocar mensagens de texto curtas enquanto a
sessao estiver `active`. O chat usa o mesmo relay efemero do quadro de tela e
da fila de comandos — nao existe tabela nem coluna para mensagens de chat.

Funcionamento:

- cada mensagem tem `id`, `sender` (`technician` ou `agent`), `senderName`,
  `text` (ate 2000 caracteres, aparado e validado contra texto vazio) e
  `createdAt`;
- o tecnico envia por `POST /api/remote-assistance/sessions/:id/chat`
  (permissao dedicada `remote_assistance.chat`, separada de `.view` porque
  chat e um canal de comunicacao direta com o usuario local — engenharia
  social, nao so leitura de tela — e nao deveria ser liberado so por quem
  tem permissao de assistir; limite de 30 mensagens por minuto por sessao)
  e le junto do poll de quadro (`GET .../frame`), que agora tambem devolve
  `chatMessages`;
- o agente envia por `POST /api/agents/remote-assistance/sessions/:id/chat` e
  le junto do poll de comandos (`GET .../commands`), que tambem devolve
  `chatMessages` — nenhum poll adicional foi criado nos dois lados;
- a cada poll o servidor devolve a lista completa (ate 200 mensagens mais
  recentes, guardadas com `RPUSH`/`LTRIM` atomico); o cliente deduplica pelo
  `id` de cada mensagem em vez de um cursor por posicao, porque o corte do
  historico desloca indices;
- encerrar, expirar ou negar a sessao limpa o historico de chat junto com o
  restante do relay — nenhuma mensagem sobrevive ao fim da sessao;
- no agente Windows, a janela de chat abre pelo botao `Chat` no indicador
  flutuante e mostra o historico recebido enquanto a janela estava fechada
  assim que e aberta.

## Estrutura do cliente (frontend)

O ponto de entrada e `client/src/components/remoteAssistance/RemoteAssistanceAction.jsx`
(export default, props `asset`, `alias`, `serviceOrder`, `token`, `user`,
`notify`, `compact`), usado pelo Inventario, pela OS e pelos alertas. Ele so
orquestra: a logica fica em hooks por responsabilidade e a interface em
componentes de apresentacao pequenos.

```text
client/src/components/remoteAssistance/
  RemoteAssistanceAction.jsx        orquestrador (mesmo caminho, export e props de sempre)
  remoteAssistanceModel.js          regras puras: flag do front, elegibilidade do ativo, rotulos de estado/transporte, formatadores
  hooks/
    useRemoteAvailability.js        permissoes, elegibilidade, flags e titulo de indisponibilidade do botao
    useRemoteAssistanceConfig.js    GET /api/remote-assistance/config
    useRemoteAssistanceDialog.js    compoe os hooks abaixo; inicia, encerra e fecha o dialogo
    useRemoteReauth.js              motivo, modo pedido e senha; troca a senha por token de reautenticacao
    useRemoteAssistanceSession.js   criar/encerrar/pausar, polling de sessao e auditoria (1,2 s), encerra no evento it-guardian:auth-expired
    useRemoteViewer.js              polling de quadros (viewerPollMs), latencia, troca de monitor, reconectar
    useRemoteWebrtc.js              RTCPeerConnection recvonly, oferta/resposta SDP
    useRustdeskCredentials.js       revelar e copiar id/senha do RustDesk (so em memoria)
    useRustdeskCountdown.js         contagem regressiva ate o expiresAt da senha
    useRemoteChat.js                mensagens, rascunho, envio
    useRemoteControl.js             controle, trava de teclado local, traducao de mouse/teclado
    useBodyScrollLock.js            trava o scroll do body com o dialogo aberto
  components/
    RemoteAssistanceTrigger.jsx     botao que abre o dialogo
    RemoteDialogHeader.jsx          cabecalho (maquina, IP, fechar)
    RemoteReauthPanel.jsx           formulario: resumo da maquina, motivo, modo, senha
    RemoteViewer.jsx                corpo da sessao
    RemoteToolbar.jsx               barra de controles (+ RemoteStatus, RemoteMonitorPicker)
    RemoteScreen.jsx                visor (snapshot ou video WebRTC) e captura de mouse/teclado
    RemoteWaitingState.jsx          estados de espera (consentimento, negociacao, imagem)
    RemoteRustdeskPanel.jsx         painel do transporte RustDesk
    RemoteFooterMetrics.jsx         transporte, FPS, latencia, banda, qualidade
    RemoteEvents.jsx                auditoria recente (5 ultimos eventos)
    RemoteChat.jsx                  chat com o usuario local
  utils/                            funcoes puras: format, frame, input, notify, viewState, webrtc
  test/fixtures.jsx                 mock da API e helpers dos testes
  RemoteAssistanceAction.*.test.jsx testes de fluxo (nativo, ciclo de vida, RustDesk, WebRTC, controle/chat)
```

Regras do cliente que o servidor nao substitui, mas que valem registrar:

- a API e sempre importada de `client/src/api.js` (barril); os testes mockam
  esse modulo;
- o botao so aparece com `VITE_ENABLE_REMOTE_ASSISTANCE=true`, as permissoes
  `remote_assistance.view` e `.start`, agente com contato recente e
  `enabled: true` vindo de `/api/remote-assistance/config`. O controle exige
  tambem `VITE_ENABLE_REMOTE_CONTROL=true`, `controlEnabled` no backend e
  `remote_assistance.control`. As demais flags `VITE_*` do `.env.example`
  (privacidade, acoes administrativas, transporte, FPS) nao sao lidas pelo
  codigo do cliente;
- o tecnico, a senha digitada, o token de visualizacao e as credenciais
  RustDesk ficam so no estado do React: nada vai para `localStorage`,
  `sessionStorage` ou console;
- fechar o dialogo com sessao em andamento pede confirmacao e encerra a sessao
  antes de fechar; perder o login do tecnico (`it-guardian:auth-expired`)
  tambem encerra;
- os textos visiveis da pasta usam ortografia com acentos; os testes e2e
  (`tests/e2e/remote-assistance.spec.js`) procuram esses textos.

## Persistencia e auditoria

A migration cria:

- `security_reauthentication_tokens`;
- `remote_assistance_sessions`;
- `remote_assistance_events`.

As sessoes registram ativo, OS opcional, tecnico, estado, consentimento,
monitor, controle, datas e encerramento. Os eventos registram ator, mensagem e
metadados operacionais. Solicitar, autorizar, negar, iniciar, trocar monitor,
habilitar controle, liberar controle, falhar e encerrar tambem geram entradas
no historico global da maquina e, quando aplicavel, da OS.

Excluir um ativo ou uma sessao com historico associado falha em vez de apagar
o historico em cascata (`ON DELETE RESTRICT`, migration
`013-remote-assistance-audit-integrity`) — nenhuma rota hoje apaga essas
linhas de verdade, mas isso impede que uma futura feature de "excluir ativo
definitivamente" apague silenciosamente a trilha de auditoria da assistencia
remota daquele ativo.

Desde a migration `017-remote-assistance-event-hash-chain`, cada linha de
`remote_assistance_events` tambem carrega `event_hash`/`previous_event_hash`:
o hash de cada evento inclui o hash do evento anterior da mesma sessao, numa
cadeia continua. Isso torna a garantia "insert-only" verificavel, nao so uma
convencao de codigo — uma alteracao ou remocao de qualquer linha historica
(inclusive por acesso direto ao banco, fora da aplicacao) quebra a cadeia de
forma detectavel. `GET /api/remote-assistance/sessions/:id/events/integrity`
(mesma permissao de `.../events`) recalcula a cadeia inteira sob demanda e
devolve `{ valid, totalEvents, brokenAtEventId, brokenAtIndex }`. Isto e
deteccao, nao prevencao: nao ha trigger de banco bloqueando `UPDATE`/`DELETE`
(nao suportado no pg-mem usado nos testes locais); quem detecta uma cadeia
quebrada precisa investigar manualmente a causa.

Nenhuma senha, token completo, frame, mensagem de chat ou evento bruto de
teclado e persistido **no banco de dados**. As respostas de frame usam
`Cache-Control: private, no-store, max-age=0`.

Quando o relay usa Redis (veja "Relay em deploy serverless"), o quadro atual
fica temporariamente nesse armazenamento externo com TTL de 30 minutos e e
apagado explicitamente ao fim da sessao — nunca chega a ir para o
PostgreSQL/Supabase nem para qualquer tabela consultavel pelo restante do
sistema. E o mesmo papel que a memoria do processo cumpre localmente, apenas
compartilhado entre instancias serverless.

## Endpoints

### Tecnico autenticado

- `POST /api/security/reauthenticate`
- `GET /api/remote-assistance/config`
- `POST /api/remote-assistance/assets/:assetId/sessions`
- `GET /api/remote-assistance/sessions/:sessionId`
- `GET /api/remote-assistance/sessions/:sessionId/events`
- `GET /api/remote-assistance/sessions/:sessionId/events/integrity`
- `GET /api/remote-assistance/sessions/:sessionId/frame`
- `POST /api/remote-assistance/sessions/:sessionId/input`
- `POST /api/remote-assistance/sessions/:sessionId/chat`
- `POST /api/remote-assistance/sessions/:sessionId/monitor`
- `POST /api/remote-assistance/sessions/:sessionId/pause`
- `POST /api/remote-assistance/sessions/:sessionId/control`
- `GET /api/remote-assistance/sessions/:sessionId/rustdesk-credentials` (so com o transporte RustDesk)
- `POST /api/remote-assistance/sessions/:sessionId/webrtc/offer` (inativo por padrao)
- `GET /api/remote-assistance/sessions/:sessionId/webrtc/answer` (inativo por padrao)
- `POST /api/remote-assistance/sessions/:sessionId/end`

### Agente autenticado

- `GET /api/agents/remote-assistance/pending`
- `POST /api/agents/remote-assistance/rustdesk-id`
- `POST /api/agents/remote-assistance/sessions/:sessionId/consent`
- `POST /api/agents/remote-assistance/sessions/:sessionId/frame`
- `GET /api/agents/remote-assistance/sessions/:sessionId/commands`
- `POST /api/agents/remote-assistance/sessions/:sessionId/chat`
- `GET /api/agents/remote-assistance/sessions/:sessionId/webrtc/offer` (inativo por padrao)
- `POST /api/agents/remote-assistance/sessions/:sessionId/webrtc/answer` (inativo por padrao)
- `POST /api/agents/remote-assistance/sessions/:sessionId/end`

Viewer e agente recebem credenciais curtas e distintas. O token de enrollment
nao e exposto ao navegador e o JWT do tecnico nao vira token de transporte. Os
quatro endpoints `webrtc/*` respondem `409` enquanto
`REMOTE_ASSISTANCE_WEBRTC_ENABLED` estiver `false` (o padrao).

## Transporte WebRTC (opt-in, desligado por padrao)

O transporte `webrtc` entrega o video da tela por WebRTC em vez de JPEG por
HTTP. Ele existe ponta a ponta no codigo, mas so e usado quando as duas
condicoes abaixo forem verdadeiras ao mesmo tempo; caso contrario a sessao cai
em `snapshot_polling` (`transportFallback: true` em
`/api/remote-assistance/config`):

```env
REMOTE_ASSISTANCE_WEBRTC_ENABLED=true
REMOTE_ASSISTANCE_TRANSPORT=webrtc
```

Como funciona:

- **Backend**: sinalizacao autenticada de oferta/resposta SDP com tokens curtos
  e separados (viewer e agente), validacao de forma do SDP (tamanho maximo,
  prefixo `v=0`) e relay efemero de oferta e resposta por sessao, nunca
  persistido. Nao ha sinalizacao trickle: a oferta e a resposta viajam como um
  SDP unico, por isso quem negocia espera a coleta de candidatos ICE terminar;
- **Navegador** (`client/src/components/remoteAssistance/hooks/useRemoteWebrtc.js`):
  cria um `RTCPeerConnection` somente-recebimento (`recvonly`) de video com a
  lista `iceServers` devolvida por `/api/remote-assistance/config`, espera o
  `iceGatheringState` ficar `complete` (limite de 8 s), envia a oferta e
  consulta a resposta a cada 1 s. Pausar a visualizacao ou encerrar a sessao
  fecha a conexao; retomar abre outra. Enquanto a trilha de video nao chega o
  viewer mostra "Negociando conexão WebRTC com o agente...". O viewer continua
  consultando `GET .../frame` para metricas e mensagens do chat;
- **Agente Windows**: ao receber `transport: "webrtc"` na resposta de
  `GET .../commands`, o controlador da bandeja pede ao broker
  (`start_webrtc`, via pipe local) para iniciar o processo auxiliar
  `ITGuardianRemoteAssistanceWebRtc.exe` (`agent/windows/webrtc`, SIPSorcery,
  captura de tela codificada em VP8). Os parametros, inclusive o token da
  sessao, vao por uma linha JSON na entrada padrao do processo — nunca por
  argumento de linha de comando. Se o executavel nao existir (instalador
  gerado sem o .NET SDK) ou falhar ao iniciar, a sessao continua no transporte
  JPEG. Com o helper ativo o agente nao envia quadros JPEG;
- flags de configuracao: `REMOTE_ASSISTANCE_WEBRTC_ENABLED`,
  `REMOTE_ASSISTANCE_STUN_URLS`, `REMOTE_ASSISTANCE_TURN_URL`,
  `REMOTE_ASSISTANCE_TURN_USERNAME`, `REMOTE_ASSISTANCE_TURN_CREDENTIAL` (o
  servidor le este nome; os `.env.example` ainda listam
  `REMOTE_ASSISTANCE_TURN_PASSWORD`, que nao e lida) e
  `REMOTE_ASSISTANCE_MAX_BITRATE_KBPS`, todas desligadas/vazias por padrao.
  Sem `REMOTE_ASSISTANCE_TURN_URL` a lista de servidores ICE fica so com STUN.

Testes: contrato da sinalizacao em
`server/test-integration/remote-assistance-webrtc-signaling.test.mjs`; fluxo do
viewer em `client/src/components/remoteAssistance/RemoteAssistanceAction.webrtc.test.jsx`
(com `RTCPeerConnection` simulado).

O que este documento **nao** registra: homologacao de STUN/TURN em redes reais
(NAT simetrico, firewalls corporativos) nem medicao de latencia/FPS do video
WebRTC em producao. Trate esses pontos como pendentes ate haver evidencia.

## Transporte RustDesk (alternativo, opt-in)

`snapshot_polling` (3-10 FPS tipico, JPEG por HTTP) tem um teto de fluidez
estrutural. Para quem precisa de mais performance e aceita o modelo de
seguranca diferente descrito abaixo, o IT Guardian pode delegar o video e o
controle da sessao ao cliente nativo do [RustDesk](https://rustdesk.com)
(open source), instalado pelo coletor na maquina atendida.

### O que muda de verdade

A diferenca central em relacao a `snapshot_polling`/`webrtc` nao e so
performance: **a partir do momento em que o tecnico conecta pelo cliente
RustDesk, o IT Guardian perde visibilidade da sessao**. Nao ha frame
retransmitido, nao ha fila de comandos de mouse/teclado, nao ha captura para
auditar. O backend continua controlando quem pode iniciar uma sessao,
exigindo consentimento local e reautenticacao — mas o que acontece depois da
conexao (cliques, teclas, arquivos arrastados) fica fora do alcance do IT
Guardian, do mesmo jeito que ficaria numa ligacao telefonica orientando o
usuario a instalar outro programa. Quem precisa de auditoria granular de
input deve usar `snapshot_polling` ou `webrtc` (ver secao anterior), nos quais
o controle passa pela fila de comandos do IT Guardian.

### Modelo de senha: nunca fixa, nunca compartilhada

Fica tentador (e comum em outras ferramentas de RMM) configurar uma senha
"padrao" do RustDesk, igual em toda a frota, para simplificar a conexao. O IT
Guardian **nao faz isso de proposito**: uma senha fixa compartilhada por
todas as maquinas e um unico ponto de falha para a base inteira — vazou uma
vez (engenharia reversa do instalador, dump de config, captura de rede), da
acesso irrestrito a qualquer maquina, de fora do IT Guardian, sem cair na
auditoria nem exigir reautenticacao nenhuma.

Em vez disso:

- cada sessao recebe uma senha **gerada pelo servidor** no momento em que o
  usuario local autoriza (`issueRustdeskSessionPassword`), aleatoria, de uso
  restrito aquela sessao (`generateRustdeskSessionPassword` em
  `server/src/domain/remoteAssistancePolicy.js`; 16 caracteres por padrao —
  `REMOTE_ASSISTANCE_RUSTDESK_PASSWORD_LENGTH`, 12 a 32 — sem caracteres
  ambiguos como 0/O e 1/l/I). A emissao gera o evento de auditoria
  `rustdesk_password_issued`;
- a senha nunca e persistida em banco — vive so no relay efemero da sessao
  (o mesmo mecanismo que ja guarda frame e chat), com o mesmo `expiresAt` que
  o agente recebeu para autoexpirar localmente. O TTL padrao e de 300 s
  (`REMOTE_ASSISTANCE_RUSTDESK_PASSWORD_TTL_SECONDS`, 60 a 900);
- ao conceder consentimento, o backend envia a senha ao agente pela fila de
  comandos existente (`rustdesk_set_password`, com `ttlSeconds`) — o agente
  aplica via `rustdesk.exe --password` e **agenda sozinho** a propria
  expiracao local, sem depender de um segundo aviso do servidor chegar;
- ao encerrar a sessao (pelo tecnico, pelo usuario local ou por timeout), o
  backend tambem tenta avisar o agente para revogar antes do TTL
  (comando `rustdesk_clear_password`, em `revokeRustdeskPasswordBestEffort`)
  e apaga a senha do relay — mas o aviso ao agente e reforco, nao a garantia:
  a fila de comandos so e entregue enquanto a sessao ainda esta `active`, e
  um agente que perdeu conexao exatamente no encerramento pode nao receber o
  aviso a tempo. A garantia real e o TTL aplicado localmente pelo proprio
  agente;
- o tecnico so ve a senha por pedido explicito ("Revelar senha de conexão" no
  painel), nunca automaticamente — cada revelacao gera o evento de auditoria
  `rustdesk_credentials_revealed` (com contador) no historico da maquina/OS.
  A rota `GET .../rustdesk-credentials` exige `remote_assistance.control` e
  tem limite de 10 chamadas por minuto por sessao. A revelacao devolve a
  **mesma** senha emitida no consentimento ate ela expirar: nao gera outra. Se
  expirar (resposta `409`), o usuario local precisa autorizar de novo, o que
  exige uma nova sessao — o botao "Gerar nova senha de sessão" do painel
  apenas repete o pedido e recebe esse `409`;
- no navegador, id e senha ficam apenas no estado do componente enquanto a
  sessao esta aberta: nao vao para `localStorage`/`sessionStorage`, URL ou
  console, a senha some da tela quando o `expiresAt` chega (contagem
  regressiva no painel) e todas as credenciais sao descartadas ao encerrar a
  sessao ou fechar o dialogo;
- a senha nunca viaja por URL (nem no link `rustdesk://id`, nem em nenhum
  lugar copiado automaticamente para fora do IT Guardian) — o tecnico sempre
  cola manualmente no cliente RustDesk, para nao deixar rastro em historico
  de navegador ou logs do sistema operacional.

O id do dispositivo RustDesk (`rustdesk_id` no card da maquina) **nao** segue
essa mesma cautela porque nao e segredo — e o equivalente a um numero de
telefone no protocolo RustDesk: serve so para saber com qual maquina
conectar, nunca concede acesso sozinho.

### Relay proprio obrigatorio

`REMOTE_ASSISTANCE_RUSTDESK_ENABLED=true` sozinho **nao** liga o transporte:
tambem e preciso configurar `REMOTE_ASSISTANCE_RUSTDESK_ID_SERVER` (e,
tipicamente, `REMOTE_ASSISTANCE_RUSTDESK_RELAY_SERVER`) apontando para um
`hbbs`/`hbbr` self-hosted. O IT Guardian nunca aponta para o relay publico do
RustDesk por padrao — rotear a tela de maquinas de clientes por um servidor
de terceiros e uma decisao de privacidade explicita demais para ser o
default de ninguem. Sem essas variaveis, um `REMOTE_ASSISTANCE_TRANSPORT=rustdesk`
pedido cai de volta para `snapshot_polling` automaticamente
(`transportFallback: true` na resposta de `/api/remote-assistance/config`).

**Duas configuracoes separadas, mesmo relay**: as variaveis
`REMOTE_ASSISTANCE_RUSTDESK_*` no backend so ligam/desligam o transporte no
IT Guardian (o backend nunca fala o protocolo RustDesk diretamente). Quem de
fato aponta o cliente RustDesk de cada maquina para o seu relay proprio (em
vez do relay publico de fabrica) sao as variaveis `RUSTDESK_ID_SERVER`,
`RUSTDESK_RELAY_SERVER` e `RUSTDESK_KEY` lidas por
`installers/windows-collector/build-installer.ps1` **no momento de gerar o
instalador** — elas viram `config.json` na maquina (campos
`rustdeskIdServer`/`rustdeskRelayServer`/`rustdeskKey`) e
`RustdeskController.EnsureServerConfigured` (agente Windows) escreve isso no
`RustDesk2.toml` do cliente a cada ciclo em que mudar. Use o **mesmo host e a
mesma chave publica** (`id_ed25519.pub` gerado pelo `hbbs`, ver
`docker-compose.local.yml`, perfil `rustdesk`) nos dois lugares, ou o backend
vai achar que o transporte esta configurado enquanto os clientes continuam
apontados para servidores diferentes (ou para o relay publico).
`Program Files\RustDesk\rustdesk.exe --get-id` na maquina atendida confirma
qual servidor o cliente usa hoje.

O cliente RustDesk **do proprio tecnico** fica fora do alcance do instalador
do IT Guardian — e o computador do tecnico, nao um ativo gerenciado. Configure
manualmente uma vez (Configuracoes -> Rede -> ID/Relay Server, no cliente
RustDesk do tecnico) com os mesmos tres valores, ou os dois lados nunca vao
se enxergar.

### Instalacao do cliente

O instalador do coletor (`installers/windows-collector`) pode empacotar o
instalador oficial do RustDesk e instala-lo silenciosamente junto do
coletor — veja
[`installers/windows-collector/README.md`](../installers/windows-collector/README.md#transporte-rustdesk-no-instalador-opcional).
O IT Guardian nao redistribui o RustDesk: quem gera o instalador baixa o
pacote oficial e o coloca em `installers/windows-collector/vendor/` antes do
build. O id do dispositivo criado nesse install e relatado sozinho ao
servidor no heartbeat seguinte (`ReportRustdeskIdIfChanged` em
`agent/windows/ITGuardian.Windows.cs`) e gravado no card da maquina.

### Endpoints

- `POST /api/agents/remote-assistance/rustdesk-id` — agente relata o id do
  dispositivo (autenticado pelo token de enrollment, nao pelo tecnico).
- `GET /api/remote-assistance/sessions/:sessionId/rustdesk-credentials` —
  tecnico revela id + senha da sessao ativa (exige `remote_assistance.control`,
  nao so `.view`: possuir a senha equivale a controle total, diferente do
  `snapshot_polling`, onde ver a tela e controla-la sao permissoes
  separadas). Responde `409` se a maquina ainda nao relatou um id RustDesk,
  se a senha ainda nao foi emitida ou se ja expirou.

### Limitacoes

- nenhuma auditoria granular de mouse/teclado depois da conexao (ver acima);
- exige relay proprio (`hbbs`/`hbbr`) rodando como processo sempre ligado —
  mesma familia de restricao que OCS/Zabbix/polling de LAN, incompativel com
  deploy 100% serverless;
- o RustDesk nao e mantido pelo IT Guardian: os flags de CLI usados pelo
  agente (`--password`, `--get-id`, `--silent-install`) estao marcados com
  "NOTA DE VERIFICACAO" no codigo-fonte (`agent/windows/ITGuardian.RustdeskController.cs`,
  `installers/windows-collector/Finalize-CollectorInstall.ps1`) e devem ser
  confirmados contra a versao efetivamente empacotada antes de uso em
  producao — nenhuma chamada ao RustDesk foi exercitada contra o binario real
  neste trabalho, so testada com um relay simulado no backend;
- se o cliente RustDesk nao estiver instalado na maquina do tecnico, o link
  `rustdesk://id` nao abre nada — a orientacao de instalar o cliente
  RustDesk no computador do tecnico fica fora do escopo do IT Guardian.

## Teste com duas maquinas reais

1. Use duas maquinas proprias em uma rede de laboratorio.
2. Ative as flags de laboratorio, mantendo auto consentimento desligado.
3. Atualize e reinicie o agente Windows da maquina atendida.
4. Confirme enrollment, chave de produto e heartbeat recente.
5. Entre com um tecnico que possua as permissoes da assistencia.
6. Abra o Inventario e clique em `Atendimento remoto`.
7. Informe o motivo e reautentique com a senha do tecnico.
8. Confirme que a maquina exibe a janela de consentimento.
9. Negue uma primeira tentativa e confira os tres historicos.
10. Crie outra sessao e autorize.
11. Confirme o indicador local durante todo o atendimento.
12. Troque de monitor, quando houver mais de um; confirme que o seletor fica
    oculto quando so ha um monitor.
13. Observe o rodape do viewer: FPS real deve ficar proximo do configurado,
    a banda deve variar com o conteudo da tela e a qualidade deve cair se
    voce abrir algo com muito movimento na maquina atendida.
14. Pause a visualizacao, confirme o aviso "Visualização pausada" e que o
    rodape para de atualizar; retome e confirme que volta a atualizar.
15. Desconecte a rede da maquina atendida por alguns segundos e confirme que
    o viewer mostra "reconectando"; ao reconectar a rede, use o botao
    `Reconectar` se o estado nao se recuperar sozinho.
16. Solicite controle e valide mouse, clique, scroll e tecla comum.
17. Troque mensagens de chat nos dois sentidos (painel do viewer e botao
    `Chat` do indicador local) e confirme que aparecem nos dois lados em
    poucos segundos.
18. Encerre primeiro pelo usuario e depois repita encerrando pelo tecnico.
19. Abra uma nova sessao e confirme que o historico de chat da sessao
    anterior nao aparece.
20. Confirme que nao ha frames nem mensagens de chat nas tabelas ou logs.
21. Saia da conta durante uma sessao e confirme o encerramento automatico.

## Como medir FPS, banda e latencia

O rodape do viewer calcula FPS real e banda a partir da janela recente de
quadros aceitos pelo servidor (nao conta quadros identicos ao anterior). A
latencia HTTP e medida no navegador, entre o disparo do pedido de quadro e a
resposta — reflete a rede entre o tecnico e o servidor, nao entre o servidor e
o agente. Para depurar lentidao:

1. banda alta com FPS baixo geralmente indica quadros grandes — considere
   reduzir `REMOTE_ASSISTANCE_MAX_WIDTH`/`MAX_HEIGHT` ou a qualidade maxima;
2. FPS preso no minimo com qualidade ja no piso indica rede ou CPU do lado do
   agente como gargalo, nao configuracao do servidor;
3. quadro "atrasado" no viewer com FPS normal indica problema pontual de rede
   entre o navegador e o servidor (nao entre agente e servidor).

## Limitacoes e riscos

- `snapshot_polling` melhorado (3 a 5 FPS tipico em LAN) ainda nao oferece a
  fluidez de uma solucao WebRTC nativa.
- A captura usa recursos do desktop interativo e pode falhar em tela bloqueada,
  desktop seguro ou sessao sem usuario; a falha e absorvida localmente (o
  agente pula o quadro daquele ciclo) e nao derruba a sessao.
- UAC e `Ctrl+Alt+Del` nao sao controlados.
- O transporte precisa de HTTPS fora de uma LAN isolada.
- O transporte WebRTC existe (viewer no navegador e processo auxiliar no
  agente), mas e opt-in e este documento nao registra homologacao de
  STUN/TURN em rede real; ele tambem depende do executavel auxiliar ter sido
  empacotado no instalador (sem ele a sessao continua em JPEG).
- Modo privacidade e acoes administrativas permanecem placeholders bloqueados.
- O agente e o instalador ainda precisam de assinatura de codigo antes de uso
  em clientes.
- Em deploy serverless (Vercel), o recurso so funciona corretamente com
  `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` configurados; sem essas
  variaveis, o relay fica preso na memoria de uma instancia so e o quadro pode
  nao chegar ao tecnico. Veja "Relay em deploy serverless" acima. Em producao
  (2026-08-14), o Redis (Upstash) foi conectado via integracao nativa da
  Vercel e confirmado ativo em `GET /api/health` (`remoteAssistanceRelay:
  "redis"`).
- O relay via Redis usa leitura-e-escrita simples (nao totalmente atomica)
  para o estado geral da sessao; a fila de comandos de mouse/teclado, essa
  sim, e atomica. Em uso normal (um agente e um tecnico por sessao) o risco de
  corrida e baixo, mas nao e formalmente zero.
- O ajuste adaptativo de qualidade reage ao tamanho do quadro aceito, nao a
  uma medida direta de latencia de rede — em conexoes com perda de pacotes
  mas quadros pequenos, o ajuste pode demorar a reagir.

## O que nao foi implementado

- acesso invisivel, captura secreta ou controle silencioso;
- bypass de UAC ou elevacao administrativa silenciosa;
- transferencia de arquivos, clipboard, audio ou gravacao de sessao;
- shell remoto livre ou captura global fora da sessao;
- tela preta, bloqueio de input local ou modo privacidade;
- persistencia de frames;
- homologacao de STUN/TURN em rede real e medicao do video WebRTC em
  producao (o transporte padrao continua `snapshot_polling`);
- reaproveitar ou renovar a senha RustDesk de uma sessao ja expirada sem nova
  autorizacao do usuario local.

## Por que nao ha acesso invisivel nem acoes administrativas silenciosas

Cada sessao exige reautenticacao do tecnico e consentimento explicito do
usuario local antes de qualquer captura comecar; o indicador
`IT Guardian - Atendimento remoto em andamento` permanece visivel durante toda
a sessao e o usuario pode encerrar a qualquer momento pela propria maquina.
Nao existe caminho de codigo que inicie captura, controle ou elevacao sem
passar por essas duas confirmacoes — inclusive as melhorias desta versao
(pausa, qualidade adaptativa, WebRTC opt-in, RustDesk opt-in) respeitam a mesma sessao
autenticada e auditada, sem novo canal paralelo. Acoes administrativas e modo
privacidade continuam bloqueados por flag (`ENABLE_REMOTE_ADMIN_ACTIONS`,
`ENABLE_REMOTE_PRIVACY_MODE`) porque nenhuma implementacao real existe ainda
para essas permissoes — elas so aparecem reservadas na tabela de permissoes.

## Roadmap

1. Homologar o transporte WebRTC (ja implementado no viewer e no helper do
   agente), STUN/TURN e reconexao em redes reais, e decidir se ele passa a
   ser o transporte recomendado.
2. Permitir renovar a senha RustDesk durante a sessao (hoje o painel oferece
   "Gerar nova senha de sessão", mas o backend nao emite outra).
3. Assinar agente e instalador.
4. Executar revisao de seguranca independente e teste de invasao.
5. Medir latencia real de rede (nao apenas tamanho de quadro) para alimentar
   o ajuste adaptativo de qualidade.
6. Avaliar recursos administrativos apenas com consentimento e elevacao
   legitima do Windows, sem bypass de UAC.
