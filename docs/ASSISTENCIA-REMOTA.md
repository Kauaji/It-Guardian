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
- visualizar um monitor por vez e trocar o monitor selecionado;
- solicitar e liberar controle basico de mouse e teclado;
- encerrar pelo navegador ou pela maquina atendida;
- registrar os eventos no historico da maquina, da OS e da sessao.

Esta versao usa `snapshot_polling` como transporte de laboratorio. Os frames
JPEG trafegam com token curto, ficam somente em memoria e nunca sao gravados no
banco ou no historico. A taxa maxima e de 1 FPS.

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

## Permissoes

| Permissao | Finalidade |
|---|---|
| `remote_assistance.view` | Consultar sessao, eventos e frame atual |
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
7. Selecione o monitor desejado.
8. Quando necessario, solicite o controle de mouse e teclado.
9. Encerre a sessao ao concluir o atendimento.
10. Confira os eventos no historico da maquina e da OS.

A reautenticacao gera um token aleatorio, vinculado ao tecnico, ativo, OS e
acao solicitada. Ele expira em cinco minutos, e consumido uma unica vez e nao
contem a senha.

## Fluxo do usuario atendido

O agente mostra uma janela local com tecnico, organizacao, motivo e OS. O
usuario pode `Autorizar` ou `Negar`. A captura e o controle nao comecam antes da
autorizacao.

Durante a sessao, o agente exibe permanentemente:

`IT Guardian - Atendimento remoto em andamento`

O botao `Encerrar atendimento` para a captura, limpa os recursos locais e avisa
o servidor. Fechar o viewer, sair da conta, perder heartbeat ou atingir o
timeout tambem encerra ou expira a sessao.

## Monitores e controle

O agente envia somente metadados dos monitores: identificador, nome, resolucao
e indicador de principal. O viewer captura um monitor por vez. Ao trocar:

1. o backend valida a sessao e o monitor;
2. registra `monitor_changed`;
3. envia um comando efemero ao agente;
4. o agente muda a origem da proxima captura;
5. o viewer exibe carregamento ate receber o novo frame.

Mouse e teclado exigem, ao mesmo tempo, flag global, permissao do tecnico,
reautenticacao, sessao ativa e consentimento local para controle. A lista de
eventos aceitos e fechada: movimento, cliques, duplo clique, scroll e teclas
comuns enquanto o viewer esta focado.

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

Nenhuma senha, token completo, frame ou evento bruto de teclado e persistido.
As respostas de frame usam `Cache-Control: private, no-store, max-age=0`.

## Endpoints

### Tecnico autenticado

- `POST /api/security/reauthenticate`
- `GET /api/remote-assistance/config`
- `POST /api/remote-assistance/assets/:assetId/sessions`
- `GET /api/remote-assistance/sessions/:sessionId`
- `GET /api/remote-assistance/sessions/:sessionId/events`
- `GET /api/remote-assistance/sessions/:sessionId/frame`
- `POST /api/remote-assistance/sessions/:sessionId/input`
- `POST /api/remote-assistance/sessions/:sessionId/monitor`
- `POST /api/remote-assistance/sessions/:sessionId/control`
- `POST /api/remote-assistance/sessions/:sessionId/end`

### Agente autenticado

- `GET /api/agents/remote-assistance/pending`
- `POST /api/agents/remote-assistance/sessions/:sessionId/consent`
- `POST /api/agents/remote-assistance/sessions/:sessionId/frame`
- `GET /api/agents/remote-assistance/sessions/:sessionId/commands`
- `POST /api/agents/remote-assistance/sessions/:sessionId/end`

Viewer e agente recebem credenciais curtas e distintas. O token de enrollment
nao e exposto ao navegador e o JWT do tecnico nao vira token de transporte.

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
12. Troque de monitor, quando houver mais de um.
13. Solicite controle e valide mouse, clique, scroll e tecla comum.
14. Encerre primeiro pelo usuario e depois repita encerrando pelo tecnico.
15. Confirme que nao ha frames nas tabelas ou logs.
16. Saia da conta durante uma sessao e confirme o encerramento automatico.

## Limitacoes e riscos

- `snapshot_polling` nao oferece fluidez de uma solucao WebRTC.
- A taxa de 1 FPS e adequada apenas para validacao funcional.
- A captura usa recursos do desktop interativo e pode falhar em tela bloqueada,
  desktop seguro ou sessao sem usuario.
- UAC e `Ctrl+Alt+Del` nao sao controlados.
- O transporte precisa de HTTPS fora de uma LAN isolada.
- STUN/TURN e sinalizacao WebRTC ainda nao foram implementados.
- Modo privacidade e acoes administrativas permanecem placeholders bloqueados.
- O agente e o instalador ainda precisam de assinatura de codigo antes de uso
  em clientes.

## O que nao foi implementado

- acesso invisivel, captura secreta ou controle silencioso;
- bypass de UAC ou elevacao administrativa silenciosa;
- transferencia de arquivos, clipboard, audio ou gravacao de sessao;
- shell remoto livre ou captura global fora da sessao;
- tela preta, bloqueio de input local ou modo privacidade;
- persistencia de frames;
- WebRTC, STUN ou TURN.

## Roadmap

1. Substituir snapshots por WebRTC com signaling autenticado.
2. Homologar STUN/TURN e reconexao em redes reais.
3. Assinar agente e instalador.
4. Executar revisao de seguranca independente e teste de invasao.
5. Adicionar metricas de qualidade sem armazenar conteudo da tela.
6. Avaliar recursos administrativos apenas com consentimento e elevacao
   legitima do Windows, sem bypass de UAC.
