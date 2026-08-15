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

Esta versao usa `snapshot_polling` como transporte principal, agora com FPS,
resolucao e qualidade JPEG configuraveis dentro de limites seguros, ajuste
automatico de qualidade e deduplicacao de quadros identicos. Os frames JPEG
trafegam com token curto, ficam somente em memoria e nunca sao gravados no
banco ou no historico. Um transporte `webrtc` esta preparado (sinalizacao
autenticada no backend) mas permanece desligado por padrao — veja
"Transporte WebRTC" abaixo.

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

Em `NODE_ENV=production`, o backend recusa novas sessoes quando
`REMOTE_ASSISTANCE_ENV` nao for explicitamente `lab`, `homologation` ou
`internal`. O frontend nunca substitui essa validacao do servidor.

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

## Ajustar fluidez do transporte snapshot polling

Todos os limites abaixo sao aplicados no servidor
(`server/src/config/environment.js`) mesmo que o valor pedido seja maior —
o objetivo e permitir ajuste fino sem abrir brecha para configuracao
perigosa:

```env
REMOTE_ASSISTANCE_TRANSPORT=snapshot_polling
REMOTE_ASSISTANCE_TARGET_FPS=3        # 1 a 5, nunca acima do teto abaixo
REMOTE_ASSISTANCE_MAX_FPS=3           # teto rigido, 1 a 5
REMOTE_ASSISTANCE_MAX_WIDTH=1280      # 320 a 1920
REMOTE_ASSISTANCE_MAX_HEIGHT=720      # 240 a 1080
REMOTE_ASSISTANCE_JPEG_QUALITY=65     # ponto de partida, 10 a 95
REMOTE_ASSISTANCE_MIN_JPEG_QUALITY=35 # piso do ajuste automatico
REMOTE_ASSISTANCE_MAX_JPEG_QUALITY=80 # teto do ajuste automatico
REMOTE_ASSISTANCE_MAX_FRAME_BYTES=700000
REMOTE_ASSISTANCE_ADAPTIVE_QUALITY=true
REMOTE_ASSISTANCE_VIEWER_POLL_MS=350
REMOTE_ASSISTANCE_AGENT_CAPTURE_MS=350
REMOTE_ASSISTANCE_IDLE_TIMEOUT_SECONDS=60
REMOTE_ASSISTANCE_RECONNECT_GRACE_SECONDS=30
```

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
| `remote_assistance.start` | Solicitar uma nova sessao |
| `remote_assistance.control` | Solicitar controle basico apos consentimento |
| `remote_assistance.end` | Encerrar a sessao |
| `remote_assistance.manage` | Administrar o ciclo operacional da sessao |
| `remote_assistance.privacy_mode` | Reservada; recurso nao implementado |
| `remote_assistance.admin_actions` | Reservada; recurso nao implementado |
| `security.reauthenticate` | Confirmar a senha do tecnico |

O botao so aparece quando as flags dos dois lados estao ativas, o usuario tem
as permissoes necessarias e o agente possui heartbeat recente.

## Fluxo do tecnico

1. Abra o Inventario e os detalhes da maquina, ou uma OS vinculada ao ativo.
2. Clique em `Atendimento remoto` ou `Acessar maquina`.
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
contem a senha.

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
existe um monitor, o seletor fica oculto e um texto informa "unico monitor
detectado". Ao trocar:

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
- `GET /api/remote-assistance/sessions/:sessionId/frame`
- `POST /api/remote-assistance/sessions/:sessionId/input`
- `POST /api/remote-assistance/sessions/:sessionId/chat`
- `POST /api/remote-assistance/sessions/:sessionId/monitor`
- `POST /api/remote-assistance/sessions/:sessionId/pause`
- `POST /api/remote-assistance/sessions/:sessionId/control`
- `POST /api/remote-assistance/sessions/:sessionId/webrtc/offer` (inativo por padrao)
- `GET /api/remote-assistance/sessions/:sessionId/webrtc/answer` (inativo por padrao)
- `POST /api/remote-assistance/sessions/:sessionId/end`

### Agente autenticado

- `GET /api/agents/remote-assistance/pending`
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

## Transporte WebRTC (preparado, inativo por padrao)

O backend ja expoe uma sinalizacao autenticada de oferta/resposta SDP para um
futuro transporte WebRTC, seguindo o mesmo modelo de tokens curtos e
separados do snapshot polling. Isso permite evoluir o transporte sem redesenhar
a API de sessao, consentimento e auditoria.

O que existe hoje:

- flags `REMOTE_ASSISTANCE_WEBRTC_ENABLED`, `REMOTE_ASSISTANCE_STUN_URLS`,
  `REMOTE_ASSISTANCE_TURN_URL`, `REMOTE_ASSISTANCE_TURN_USERNAME`,
  `REMOTE_ASSISTANCE_TURN_PASSWORD` e `REMOTE_ASSISTANCE_MAX_BITRATE_KBPS`,
  todas desligadas/vazias por padrao;
- validacao de forma da oferta/resposta SDP (tamanho maximo, prefixo `v=0`);
- relay efemero de oferta e resposta por sessao, nunca persistido;
- testes de contrato cobrindo bloqueio quando desligado e o relay completo
  quando ligado (`server/test-integration/remote-assistance-webrtc-signaling.test.mjs`).

O que **nao** existe ainda, de proposito:

- nenhum `RTCPeerConnection` no navegador — o viewer continua 100% em
  `snapshot_polling` enquanto isso nao for implementado;
- nenhum peer WebRTC nativo no agente Windows (exigiria uma biblioteca WebRTC
  nativa em C#, hoje ausente do projeto);
- STUN/TURN reais nao foram testados em rede alguma.

Ou seja: a fiacao de seguranca (autenticacao, tokens, auditoria) esta pronta e
testada, mas video/dados via WebRTC em si e trabalho futuro. Ativar
`REMOTE_ASSISTANCE_WEBRTC_ENABLED=true` hoje so libera a troca de SDP pela API
— nenhuma tela adicional passa a trafegar por esse caminho.

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
14. Pause a visualizacao, confirme o aviso "Visualizacao pausada" e que o
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
- A sinalizacao WebRTC (oferta/resposta SDP) esta pronta e testada, mas
  nenhum peer real (navegador ou agente) a utiliza ainda — STUN/TURN nunca
  foram exercitados em rede real.
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
- video/dados WebRTC de fato (o transporte continua `snapshot_polling`); a
  sinalizacao SDP existe, mas sem peer real dos dois lados;
- STUN/TURN homologados em rede real.

## Por que nao ha acesso invisivel nem acoes administrativas silenciosas

Cada sessao exige reautenticacao do tecnico e consentimento explicito do
usuario local antes de qualquer captura comecar; o indicador
`IT Guardian - Atendimento remoto em andamento` permanece visivel durante toda
a sessao e o usuario pode encerrar a qualquer momento pela propria maquina.
Nao existe caminho de codigo que inicie captura, controle ou elevacao sem
passar por essas duas confirmacoes — inclusive as melhorias desta versao
(pausa, qualidade adaptativa, WebRTC preparado) respeitam a mesma sessao
autenticada e auditada, sem novo canal paralelo. Acoes administrativas e modo
privacidade continuam bloqueados por flag (`ENABLE_REMOTE_ADMIN_ACTIONS`,
`ENABLE_REMOTE_PRIVACY_MODE`) porque nenhuma implementacao real existe ainda
para essas permissoes — elas so aparecem reservadas na tabela de permissoes.

## Roadmap

1. Implementar `RTCPeerConnection` no viewer e um peer WebRTC nativo no
   agente Windows, usando a sinalizacao ja pronta no backend.
2. Homologar STUN/TURN e reconexao em redes reais.
3. Assinar agente e instalador.
4. Executar revisao de seguranca independente e teste de invasao.
5. Medir latencia real de rede (nao apenas tamanho de quadro) para alimentar
   o ajuste adaptativo de qualidade.
6. Avaliar recursos administrativos apenas com consentimento e elevacao
   legitima do Windows, sem bypass de UAC.
