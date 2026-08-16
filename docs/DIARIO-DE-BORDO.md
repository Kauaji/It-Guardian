# Diario de bordo

Registro cronologico das entregas relevantes do IT Guardian. Toda consolidacao
funcional, mudanca operacional, migracao ou liberacao deve acrescentar uma
entrada neste arquivo com data, escopo, validacoes e pendencias conhecidas.

## 2026-08-15 - Decisao registrada: assistencia remota mantida ativa sem pentest independente

A avaliacao tecnica publicada (ver `Avaliação Técnica — IT Guardian`) lista
homologacao/pentest independente como pre-requisito, separado da correcao do
ACL do pipe, antes de reativar a assistencia remota em deploy publico. A
reativacao feita mais cedo em 15/08 (commit `518cfde`/`c29961a` e a remocao
do `remoteAssistanceSecurityPause`) seguiu o criterio mais estreito que
estava escrito no comentario do codigo (agente corrigido, distribuido e
confirmado em uso) — nao o criterio mais amplo da auditoria completa. Diante
dessa lacuna, explicitamente apresentada, o responsavel pelo projeto optou
por manter a assistencia remota ativa, assumindo conscientemente o risco
residual ate que um pentest de fato aconteca. Registrado aqui para que uma
proxima rodada de auditoria trate isso como decisao informada, nao como
achado que passou despercebido.

## 2026-08-15 - Agente Windows: conta de servico dedicada no lugar de SYSTEM

### Causa raiz

- a auditoria tecnica (Agente Windows, 5,5/10) lista "task agendada continua
  rodando como SYSTEM permanente sem nenhuma camada de contencao" como
  achado aberto de severidade alta. Investigacao direta no codigo
  (`agent/windows/ITGuardian.Windows.cs`) mapeou exatamente por que SYSTEM
  foi usado: leitura de saude/SMART de disco via WMI (`root\wmi` —
  `MSStorageDriver_FailurePredictData` — e `root\Microsoft\Windows\Storage` —
  `MSFT_StorageReliabilityCounter`) e levantamento de software instalado por
  usuario via enumeracao de `HKEY_USERS` de todos os perfis carregados.
  Nenhuma dessas operacoes exige a identidade SYSTEM especificamente —
  exige associacao ao grupo Administradores, que SYSTEM tambem satisfaz por
  ser um superconjunto.

### Correcao

- `installers/windows-collector/Finalize-CollectorInstall.ps1`: nova conta
  de servico local dedicada `ITGuardianCollector`, criada (ou com senha
  rotacionada, se ja existir) a cada instalacao/reinstalacao/troca de chave,
  com senha aleatoria de 24 caracteres gerada via
  `RandomNumberGenerator` (garante ao menos 1 caractere de cada classe:
  maiuscula/minuscula/digito/simbolo, embaralhados por Fisher-Yates — nao
  fica so anexada como sufixo previsivel), adicionada ao grupo
  Administradores, com `PasswordNeverExpires`/`UserMayNotChangePassword`
  (conta de servico, sem uso interativo). A tarefa agendada passa a rodar
  sob essa conta (`Register-ScheduledTask -User ".\ITGuardianCollector"
  -Password ...`) em vez de `-UserId "SYSTEM" -LogonType ServiceAccount`. A
  senha em texto claro fica em memoria só pelo tempo do registro da tarefa
  (o Task Scheduler protege a credencial internamente depois de registrada,
  do mesmo jeito que ja faz para contas de servico do Windows) e a variavel
  e zerada logo em seguida.
- ACL de `config.json` (`S-1-5-18`/SYSTEM + `S-1-5-32-544`/Administradores)
  nao precisou mudar: a nova conta ja tem acesso por ser membro de
  Administradores. O grant de `FullControl` no pipe nomeado da assistencia
  remota (`CreatePipe()` em `ITGuardian.RemoteAssistance.cs`) tambem nao
  precisou mudar pelo mesmo motivo — ja concedia tanto a `LocalSystemSid`
  quanto a `BuiltinAdministratorsSid`.
- `installers/windows-collector/Uninstall-Collector.ps1`: remove a conta
  `ITGuardianCollector` ao desinstalar.
- instalador reconstruido para embutir os scripts corrigidos.

### Validacoes

- `[System.Management.Automation.Language.Parser]::ParseFile` nos dois
  scripts alterados: sem erros de sintaxe;
- assinaturas exatas de `New-LocalUser`/`Set-LocalUser`/
  `Register-ScheduledTask`/`Add-LocalGroupMember`/`Get-LocalGroupMember`/
  `Remove-LocalUser` conferidas via `Get-Command -Syntax` nesta mesma
  maquina antes de escrever o codigo que as usa (evitou pelo menos uma
  suposicao errada: `Set-LocalUser` usa `-UserMayChangePassword <bool>`,
  nome e tipo diferentes do `-UserMayNotChangePassword` switch do
  `New-LocalUser`);
- gerador de senha testado isoladamente (8 amostras): sempre 24 caracteres,
  sempre as 4 classes de caractere presentes, sem elevacao necessaria para
  essa parte;
- `npm run installer:windows`: compilacao completa sem erros.

### Pendencias conhecidas

- **não foi possível testar a criação da conta e o registro da tarefa
  agendada de ponta a ponta nesta sessão** — a sessão do PowerShell
  disponível aqui não está elevada (`IsAdmin: False`), e `New-LocalUser`/
  `Add-LocalGroupMember`/`Register-ScheduledTask -User -Password` exigem
  administrador. A verificação ficou limitada a sintaxe do script,
  assinatura exata dos cmdlets, e teste isolado do gerador de senha — não
  cobre o cenário completo (conta criada, associada a Administradores,
  tarefa rodando sob ela, coleta de inventário incluindo SMART e software
  por usuário funcionando). **Precisa de teste manual numa máquina real**
  antes de considerar este achado fechado com a mesma confiança dos outros
  itens desta auditoria.

### Causa raiz

- `RemoteAssistanceConsentForm` e `RemoteAssistanceIndicatorForm` ja tinham
  `TopMost = true` e `StartPosition = CenterScreen`/posicionamento manual,
  mas ambos sao exibidos a partir de um tick de `System.Windows.Forms.Timer`
  em segundo plano (`PollPending`), nao de uma acao direta do usuario. O
  Windows restringe qual processo pode roubar o foco nesse cenario (mesma
  protecao que impede popups abusivos); nesse caso o formulario podia so
  piscar na barra de tarefas em vez de vir de fato para frente enquanto o
  usuario estava digitando ou clicando em outra janela.

### Correcao

- `agent/windows/ITGuardian.RemoteAssistance.cs`: novo `ForegroundHelper`
  estatico com o padrao AttachThreadInput + SetForegroundWindow (fixa
  temporariamente a thread do formulario a thread da janela em primeiro
  plano atual para que SetForegroundWindow funcione de forma confiavel,
  depois desfaz o vinculo) — aplicado no `OnShown` de
  `RemoteAssistanceConsentForm` e `RemoteAssistanceIndicatorForm`;
  `RemoteAssistanceConsentForm` tambem passou a tocar
  `SystemSounds.Exclamation` ao aparecer, como reforco sonoro;
  falha ao forcar o foco nunca derruba o formulario (ele continua visivel
  por ser `TopMost`, so nao necessariamente ativo/com foco de teclado).
- confirmado que a tela de consentimento ja mostra tecnico, organizacao,
  computador, sistema operacional e motivo (descricao) informados pelo
  tecnico, com botoes Autorizar/Negar — nao precisou ser criada do zero.
  O chat (`RemoteAssistanceChatForm`) fica disponivel a partir do indicador
  flutuante ("Chat") assim que a sessao e aceita — antes do consentimento
  nao existe sessao para rotear mensagens, entao nao faz sentido oferecer
  chat na propria tela de autorizacao.
- instalador reconstruido (`npm run installer:windows`) para embutir o
  agente corrigido.

### Validacoes

- `npm run installer:windows`: compilacao do `ITGuardian.exe` sem erros
  (confirma que `ForegroundHelper` e as novas chamadas compilam);
- `npm run test` (suite completa do servidor): 267 testes, 265 passaram, 2
  skips pre-existentes, 0 falhas — sem regressao.

### Pendencias conhecidas

- **nao foi possivel testar visualmente** o comportamento de vir para
  frente numa maquina Windows real com o usuario ativo em outra janela —
  essa e uma limitacao de ambiente desta sessao (sem acesso a um desktop
  Windows interativo), nao algo verificado e confirmado funcionando. A
  implementacao segue o padrao Win32 documentado e usado por outras
  ferramentas de suporte remoto, e a suite de testes automatizados nao
  cobre (nem consegue cobrir) esse comportamento especifico de UI nativa —
  precisa de teste manual numa maquina real apos reinstalar com o
  instalador novo.

## 2026-08-15 - Instalador: torna confiavel o primeiro lancamento do icone de bandeja

### Causa raiz

- a tela de consentimento da assistencia remota (`RemoteAssistanceConsentForm`)
  ja existe no agente e funciona — mas ela so aparece dentro do processo do
  icone de bandeja (`ITGuardian.exe --tray`), que e um processo separado do
  coletor de fundo (`--collector`, que roda como tarefa agendada com SYSTEM).
  O coletor por si so nunca mostra UI nenhuma.
- `Finalize-CollectorInstall.ps1` ja tentava lancar o icone de bandeja logo
  apos instalar (`Start-Process ... --tray`), mas numa unica tentativa sem
  verificar se o processo de fato ficou de pe — so capturava excecao de
  lancamento, nao falha silenciosa. Como o executavel nao e assinado (sem
  certificado configurado), o antivirus/SmartScreen frequentemente faz uma
  varredura no primeiro uso que atrasa ou interrompe essa primeira janela sem
  lancar excecao nenhuma no PowerShell — a tentativa "tinha sucesso" e o
  icone nunca aparecia mesmo assim, deixando o usuario preso em "Aguardando
  autorizacao local" indefinidamente ate deslogar/logar de novo (unico
  momento em que a chave `HKLM...\Run` ja registrada teria uma nova chance).

### Correcao

- `installers/windows-collector/Finalize-CollectorInstall.ps1`: substituida a
  tentativa unica por um loop de ate 3 tentativas com verificacao real via
  `Get-CimInstance Win32_Process` (filtrando `ExecutablePath` + `CommandLine
  like "*--tray*"` para diferenciar do processo `--collector`, que usa o
  mesmo executavel). So desiste e cai no aviso de "proximo logon" depois de
  3 tentativas sem confirmar o processo rodando;
- instalador reconstruido (`npm run installer:windows`) para embutir o script
  corrigido — o `.exe` anterior nao tem essa correcao, precisa ser gerado de
  novo a partir deste commit em diante.

### Validacoes

- `[System.Management.Automation.Language.Parser]::ParseFile` no script
  alterado: sem erros de sintaxe;
- `npm run installer:windows`: build concluido com sucesso, script novo
  confirmado embutido no `.exe` gerado.

### Pendencias conhecidas

- nao foi possivel testar o fluxo completo (instalar → nova sessao →
  confirmar icone visivel → responder ao consentimento) numa maquina real
  nesta sessao; a correcao endereca a causa mais provavel (varredura de
  antivirus no primeiro uso do executavel nao assinado) mas continua sujeita
  a ambientes onde 3 tentativas de ~3s nao sejam suficientes — nesses casos o
  fallback de "proximo logon" continua valendo.

## 2026-08-15 - Reativada a assistencia remota em deploy publico (pausa de seguranca resolvida)

### Contexto

- em 2026-08-14 (commit `9c4e06f`) uma auditoria encontrou que o ACL do pipe
  nomeado local do agente Windows aceitava qualquer usuario autenticado da
  maquina (nao so o usuario logado), permitindo interferir no consentimento
  local sem o dono da tela saber. O mesmo commit ja corrigiu o ACL (restrito
  a `WellKnownSidType.InteractiveSid`) e, por seguranca, forcou
  `enabled = false` para assistencia remota em qualquer deploy publico
  (`VERCEL === "1"` ou `VERCEL_ENV === "production"`) — independente de
  qualquer variavel de ambiente — ate o agente corrigido ser distribuido e
  confirmado em uso.
- nesta entrega: gerado um instalador novo (`npm run installer:windows`),
  compilado a partir do `agent/windows/ITGuardian.RemoteAssistance.cs` atual
  (ja com a correcao do ACL), e confirmado que foi instalado numa maquina
  real. Criterio de reativacao documentado no proprio codigo satisfeito.

### Correcao

- `server/src/config/environment.js` (`getRemoteAssistanceConfig`): removida
  a pausa incondicional (`remoteAssistanceSecurityPause`/`publicDeployment`
  forcando `enabled = false`). `enabled` volta a depender só de
  `ENABLE_REMOTE_ASSISTANCE` e da lista de ambientes permitidos
  (`REMOTE_ASSISTANCE_ENV` em lab/laboratorio/homologacao/internal/test) —
  a mesma logica que ja existia antes da pausa temporaria. `publicDeployment`
  continua existindo e sendo usado (retornado na config, e ainda desliga
  `autoConsentEnabled` em deploy publico — esse controle especifico nao
  tinha relacao com o bug do ACL e permanece intacto);
- `disabledReason` no retorno da funcao ajustado: o valor `"security_pause"`
  nao existe mais (so `"environment_not_allowed"` ou `"feature_disabled"`);
- `server/src/config/environment.test.mjs`: teste que afirmava a pausa
  incondicional em Vercel reescrito para o comportamento correto (habilitado
  quando as flags estao corretas, mesmo em deploy publico); teste novo
  cobrindo que `environment_not_allowed` continua bloqueando mesmo com
  `ENABLE_REMOTE_ASSISTANCE=true`, se `REMOTE_ASSISTANCE_ENV` nao estiver
  numa lista permitida.

### Validacoes

- `node --test server/src/config/environment.test.mjs`: 13/13;
- `npm run test` (suite completa do servidor): 267 testes, 265 passaram, 2
  skips pre-existentes, 0 falhas — inclui o teste de integracao "pipe local
  da assistencia remota nao aceita qualquer usuario autenticado da maquina",
  que segue validando a correcao do ACL em si (nao mexida nesta entrega);
- `npx eslint` nos arquivos alterados: sem erros nem warnings;
- varredura completa do repositorio confirmando zero referencias residuais a
  `remoteAssistanceSecurityPause`/`"security_pause"`.

### Pendencias conhecidas

- este commit por si so nao liga a assistencia remota em producao: ainda e
  necessario configurar em producao (Vercel) as variaveis
  `ENABLE_REMOTE_ASSISTANCE=true`, `REMOTE_ASSISTANCE_ENV` com um valor
  permitido (ex.: `internal`) no projeto do servidor, e
  `VITE_ENABLE_REMOTE_ASSISTANCE=true` no build do client (exige novo build,
  variavel de compilacao) — nenhuma dessas foi configurada nesta sessao por
  falta de acesso ao painel da Vercel;
- a protecao do ACL só vale nas maquinas que ja rodam o agente compilado a
  partir do commit `9c4e06f` em diante. Qualquer maquina ainda com um agente
  mais antigo continua com o pipe vulneravel especificamente nela ate ser
  reinstalada com o instalador atual.

## 2026-08-15 - Dashboard redesenhado: faixa de KPI, LEDs de pulso e numeros animados

### Causa raiz / motivacao

- um conceito visual (mockup estatico, nao versionado no repo) foi validado
  com o usuario; a parte do Dashboard foi aprovada explicitamente, junto com
  um pedido para levar as animacoes/fluidez do conceito ao sistema real,
  mantendo compatibilidade com os presets de tema existentes (Aurora,
  Nebulosa, Oceano, Sunset, Esmeralda, Cyber Blue, Midnight, Personalizado em
  `GeneralSettingsModal.jsx`), que sobrescrevem variaveis CSS via
  `document.documentElement.style.setProperty`.

### Correcao

- dois primitivos novos e reutilizaveis em `client/src/components/ui/`:
  `AnimatedNumber.jsx` (rolagem tipo odometro por digito quando o valor muda,
  com fallback instantaneo sob `prefers-reduced-motion`, mais alternativa
  textual em `.sr-only` para leitor de tela) e `PulseDot.jsx` (LED com anel
  pulsante cuja cadencia varia por `tone`: `ok` rapido/regular, `warning`
  lento/irregular, `danger` rapido, tone desconhecido = estatico);
- `DashboardKpiCard.jsx` removido; substituido por `DashboardKpiStrip.jsx` —
  uma unica faixa dividida por ticks (bordas finas) em vez de 4 cartoes
  separados com barra de acento lateral colorida;
- `DashboardPage.jsx` reestruturado: a faixa de KPI ocupa a largura total,
  seguida por `.dashboard-instrument-row` pareando o gauge de Saude da
  infraestrutura com um novo painel "Ativos monitorados" agrupando os
  `SummaryCard`s existentes — mesma logica de dados (`overview`/`summary`/
  `reportPending`), so a apresentacao mudou;
- `DeviceTable.jsx` (Dashboard) e `MachineCard.jsx` (Inventario) ganharam
  `PulseDot` ao lado do nome/badge de status existente, mais
  `font-variant-numeric: tabular-nums` nas colunas numericas via nova classe
  utilitaria `.tabular-nums`;
- `DashboardHealthScore.jsx`: numero central do gauge agora usa um novo hook
  `useCountUp` (interpolacao suave via `requestAnimationFrame`, tambem com
  fallback instantaneo sob reduced motion) em vez de saltar direto pro valor;
- `SummaryCard.jsx` (compartilhado com `AlertCenterV2.jsx`, em Avisos) passou
  a envolver o valor em `AnimatedNumber` — unica mudanca desta entrega que
  atravessa a fronteira do Dashboard;
- `styles.css`: todo o CSS novo usa os tokens de tema existentes
  (`var(--surface)`, `var(--border)`, `var(--text-*)`, mais `--font-mono`
  novo) em vez de cor hardcoded, exceto as cores de severidade ok/warning do
  pulse-dot e da celula "ok" da faixa, que seguem o mesmo padrao ja usado em
  `.dashboard-kpi-card` antes desta mudanca (nao redefinidas por tema — nao e
  uma inconsistencia nova); as regras de `.pulse-dot-ring` e
  `.animated-number-digit-track` foram acrescentadas dentro do bloco
  `@media (prefers-reduced-motion: reduce)` ja existente, sem duplica-lo;
  CSS morto de `.dashboard-kpi-grid`/`.dashboard-kpi-card`/
  `.dashboard-kpi-icon-badge`/`.dashboard-kpi-skeleton-icon` removido junto
  com o componente que os usava.

### Validacoes

- `npx eslint` nos arquivos alterados: sem erros nem warnings;
- `npm run test:client`: 49/49 testes (`SummaryCard.test.jsx` ajustado para
  nao depender de `getByText` com resultado unico, ja que o valor agora
  aparece duas vezes no DOM — visual `aria-hidden` e alternativa em
  `.sr-only`);
- `npm run build --workspace client`: build de producao sem erros;
- verificacao interativa real (`DATABASE_URL=memory` +
  `ENABLE_DEMO_SEED=true`, login `admin@itguardian.local`, nunca usado assim
  em producao — o proprio `resolveDatabaseConfig` recusa `DATABASE_URL=memory`
  quando `isProductionLike`): Dashboard renderizou a faixa de KPI, o gauge e
  o painel de Ativos monitorados com dados reais vindos da API, fonte mono
  aplicada, sem erro novo no console;
- verificacao do CSS compilado (`dist/assets/*.css`) confirmando ausencia de
  qualquer referencia residual as classes removidas e presenca correta das
  novas classes dentro do bloco de reduced-motion existente;
- revisao adversarial via workflow multi-agente (correcao, regressao em
  `AlertCenterV2`/`MachineCard`/resto de `styles.css`, acessibilidade e
  compatibilidade com presets de tema) antes do deploy — encontrou 2 bugs
  reais de correcao e 1 problema real de contraste, todos corrigidos nesta
  mesma entrega:
  1. `DeviceTable.jsx` passava `statusClass(device.status)` (mapeado para
     badge: offline -> "warning") direto como `tone` do `PulseDot`, fazendo
     maquinas offline pulsarem em ambar continuamente em vez de mostrar o
     LED estatico — corrigido com um `pulseTone()` proprio (mesmo padrao ja
     usado em `MachineCard.jsx`: offline -> "offline");
  2. `AnimatedNumber.jsx` chaveava cada digito pelo indice da esquerda para a
     direita; ao mudar a quantidade de digitos (ex.: 9 -> 10, 99 -> 100) a
     animacao rolava o digito errado. Corrigido chaveando por distancia do
     final da string (valor posicional) em vez do inicio, preservando a
     ordem visual de leitura mas alinhando corretamente unidade/dezena/etc.
     entre renderizacoes;
  3. `.pulse-dot.ok` e `.dashboard-kpi-strip-cell.ok` usavam o mesmo verde
     `#1f7a61` do tema claro tambem no escuro, sem o ajuste de contraste que
     `.machine-metrics strong.ok` ja aplica (`#65e59b` no escuro) — abaixo
     de 4.5:1 AA contra `--surface` escuro (~3.4:1). Corrigido replicando o
     mesmo trio de cores ja usado em `.machine-metrics` (`#65e59b`/
     `#fbbf24`/`#fb7185`) para as tres tonalidades do `pulse-dot` no tema
     escuro.
  Tambem consolidado um `@media (prefers-reduced-motion: reduce)` duplicado
  que a propria implementacao inicial criou para
  `.dashboard-kpi-strip-value-skeleton` em vez de reaproveitar o bloco ja
  existente.
- lint, `test:client` (49/49) e `build` re-executados apos as correcoes,
  todos verdes; CSS compilado reinspecionado confirmando as novas regras de
  contraste escuro e a ausencia do bloco de reduced-motion duplicado.

### Pendencias conhecidas

- verificacao visual ao vivo do `PulseDot` dentro de `MachineCard`
  (Inventario) nao foi concluida interativamente — o seed de demonstracao
  nao inclui maquinas reais e a criacao manual de ativo nao completou a
  tempo; a integracao foi validada via revisao de codigo, teste do CSS
  compilado isolado (mesmas classes, mesmo componente ja confirmado
  funcionando em `DeviceTable`) e a revisao adversarial do workflow.

## 2026-08-15 - Estado de sessao (auth/permissoes/notificacoes) extraido para Context

### Causa raiz

- a auditoria de codigo de 2026-08-14 apontou `App.jsx` (3326 linhas) como
  ponto unico de estado global do frontend: `useAppSessionController` ja
  centralizava a logica (token, user, notify/toast, tema, login/logout),
  mas o resultado so chegava a `Dashboard` — a funcao interna que renderiza
  o app inteiro apos o login — via props explicitas. `user` sozinho e usado
  51 vezes dentro de `Dashboard` (a maioria em `hasPermission(user, "...")`),
  `notify` 130 vezes e `token` 70 vezes; qualquer componente novo que
  precisasse de auth/permissao teria que receber esses tres valores por
  props desde `App`, atravessando manualmente cada nivel intermediario.

### Correcao

- novo `client/src/context/AppSessionContext.jsx`: `AppSessionProvider`
  (recebe o `value` ja calculado por `useAppSessionController` e disponibiliza
  via Context, mais um helper derivado `can(permissionId)` sobre
  `hasPermission`) e `useAppSession()` para leitura em qualquer profundidade;
- `App()` passou a envolver `<Dashboard />` e `<Toast />` em
  `<AppSessionProvider value={sessionState}>` em vez de passar
  `token`/`user`/`theme`/`notify`/`onToggleTheme`/`onLogout` como props;
- `Dashboard` passou a ler esses mesmos valores de `useAppSession()`
  (com alias `toggleTheme: onToggleTheme` e `logout: onLogout` para manter
  os nomes internos identicos) em vez de recebe-los como parametros —
  diff minimo: so a assinatura da funcao mudou, as 3000 linhas do corpo
  que ja usavam `user`/`token`/`notify`/`onToggleTheme`/`onLogout` como
  variaveis locais continuam identicas, porque essas variaveis continuam
  existindo com o mesmo nome, só que vindas do contexto;
- `AuthScreen` (renderizada quando ainda nao ha sessao) continua recebendo
  `notify`/`onAuth` como props simples, sem mudanca — nao faz sentido puxar
  contexto de sessao autenticada numa tela que existe justamente para criar
  essa sessao;
- escopo deliberadamente contido: os 51 `hasPermission(user, "...")` dentro
  de `Dashboard` nao foram migrados para o helper `can()` do contexto nesta
  entrega (continuam funcionando identicos, via a mesma variavel `user`
  agora vinda do contexto) — trocar todos os call sites de uma vez so
  aumentaria o diff sem mudar comportamento; o helper `can()` fica disponivel
  para uso gradual daqui pra frente, inclusive por componentes que hoje nao
  tem acesso a `user` nenhum.

### Validacoes

- `npm run build`: 2380 modulos, sem erro; chunk do `InventoryBoard`
  manteve o mesmo tamanho (59.77 kB), confirmando que o lazy-load do Mapa
  3D nao foi afetado;
- `npm run lint`, `npm run check:architecture` (311 arquivos) e
  `npm run test:client` (30 testes) aprovados;
- validacao interativa real no navegador (servidor local com
  `DATABASE_URL=memory` e seed de demonstracao): login como
  `admin@itguardian.local` renderizou o dashboard completo; alternancia de
  tema (`toggleTheme` via contexto) mudou `document.documentElement.dataset.theme`
  de `dark` para `light` de verdade; navegacao para Inventario (com abas
  Quadro/Plantas/Mapa 3D, segmentos e grupos) e Ordens de Servico renderizou
  sem nenhum erro novo no console; logout (`onLogout` via contexto) voltou
  para a tela de login corretamente — todo o ciclo de sessao passando pelo
  Context, nao mais por props vindas de `App`.

### Pendencias reais

- migrar os 51 `hasPermission(user, ...)` de `Dashboard` para `can()` do
  contexto, e estender o Context a outros pontos de entrada (ex.:
  `AssetPublicView`, se algum dia precisar de sessao) ficam para uma
  proxima rodada incremental — nao ha urgencia, o comportamento atual e
  identico ao anterior;
- o restante do estado local de `App.jsx`/`Dashboard` (drag-and-drop de
  inventario, segmentos, filtros de OS etc.) continua fora do escopo desta
  entrega, propositalmente — a auditoria original apontou especificamente
  auth/permissoes/notificacoes como o "estado global" a extrair, nao o
  estado de UI especifico de cada tela.

## 2026-08-15 - Extracao mecanica de tokens de cor no styles.css

### Causa raiz

- a auditoria original apontou `styles.css` com 18.076 linhas, so 76
  tokens contra 944 cores hex hardcoded, e 105 `!important`. Diferente dos
  outros achados desta sessao, esse nao foi corrigido nas rodadas
  anteriores porque nao tem uma forma de verificacao equivalente (teste que
  passa/falha, query no banco): a unica forma de saber se uma reescrita de
  CSS quebrou alguma tela e inspecao visual, e o app tem dezenas de telas
  em dois temas.

### Correcao (escopo deliberadamente contido)

- em vez de uma reescrita ampla, uma extracao puramente mecanica: as 15
  cores hex mais repetidas no arquivo (295 das 947 ocorrencias, ~31%) que
  **nao colidem com o valor de nenhum token existente** foram substituidas
  por `var(--nome-do-token)`, com o token declarado no `:root` base com o
  mesmo valor hex exato — sem mudar uma unica cor renderizada;
- a exclusao de colisao importa: `#1f7a61` (47 ocorrencias) e `#ffffff`
  (79 ocorrencias) coincidem com os valores atuais de `--accent` e
  `--surface`, que **variam por tema** (`--accent` e `#34d399` no escuro).
  Trocar esses literais por esses tokens existentes mudaria a cor
  renderizada no modo escuro — por isso foram deixados de fora desta
  rodada, nao tocados;
- os 15 novos tokens (`--status-info`, `--status-danger`,
  `--status-warning`, mais uma escala neutra `--slate-*`/`--red-*`/
  `--amber-600`/`--orange-*`/`--green-600`) sao declarados uma unica vez,
  sem variante por tema — inspecionado o contexto de uso antes de nomear
  (`#dc2626` aparece consistentemente em `.danger-action`, `.critical`,
  `.error`; `#f59e0b` em `.backup-*`/avisos; `#2563eb` em foco/abas) para
  justificar os nomes semanticos dos tres primeiros;
- script de migracao com checagem de seguranca programada: aborta se
  qualquer cor-alvo ja for o valor de um token nomeado existente, antes de
  fazer qualquer substituicao.

### Validacoes

- verificado num navegador real, nos dois temas: `getComputedStyle` dos
  tres tokens principais (`--status-info`/`--status-danger`/
  `--status-warning`) resolve para o hex original identico tanto em
  `data-theme="light"` quanto `"dark"` — prova direta de que nenhuma cor
  mudou;
- `npm run build` aprovado, CSS gerado sem erro de sintaxe;
- `npm run lint`, `npm run check:architecture` (321 arquivos) e
  `npm run test:client` (49 testes) aprovados;
- contagem de cores hex no arquivo caiu de 947 para ~652 ocorrencias em
  uso real (78 → 93 tokens declarados).

### Pendencias reais

- restam ~650 ocorrencias de cores hardcoded, incluindo as de maior
  frequencia (`#ffffff`, `#1f7a61`) que exigem decisao caso a caso (nao
  mecanica) sobre se cada uso deveria de fato seguir o tema ou permanecer
  fixo — trabalho para rodadas futuras, com revisao visual real;
- os 105 `!important` nao foram tocados nesta rodada;
- este e um primeiro passo mecanico e comprovadamente seguro, nao uma
  resposta completa ao achado original.

## 2026-08-15 - Ampliacao da cobertura de testes do client (Vitest)

### Causa raiz

- a entrega de 15/08 que introduziu Vitest cobriu so 3 arquivos (2 modulos
  puros + 1 componente de exemplo) como primeiro passo deliberadamente
  minimo. Este item retoma esse ponto e amplia a cobertura de verdade.

### Correcao

- a maioria dos utilitarios puros do client ja tinha cobertura via
  `node --test` no workspace do servidor (import direto cruzado de
  workspace, padrao ja estabelecido no projeto para `serviceOrderBoardUtils.js`,
  `automationUtils.js`, `permissions.js`, `remoteAssistanceModel.js` etc.)
  — duplicar esses em Vitest teria baixo valor;
- o gap real era em **componentes** (renderizacao, interacao real), a
  categoria que o Vitest+Testing Library existe para cobrir e que so tinha
  1 exemplo. Adicionados: `Toast.jsx` (mensagem condicional, classe de
  tone, timer de auto-fechamento com fake timers, e que trocar a mensagem
  não dispara o `onClose` antigo pendente), `PermissionBlocked.jsx` e
  `ViewLoadingState.jsx` (smoke tests de acessibilidade), e
  `AutomationIndicatorDots.jsx` (funcoes puras exportadas + interacao real
  de usuario: clicar num ponto chama `onSelectPlan`, o botao "+N" abre um
  popover com `aria-expanded` correto).

### Validacoes

- um teste inicial (`maxVisible` clampado para 1 mesmo com `0`) revelou que
  minha suposicao sobre o comportamento estava errada: `Number(0) || 4`
  avalia para `4` porque `0` e falsy em JS, entao `maxVisible: 0` cai no
  padrao de 4, nao fica em 1 — o teste foi corrigido para descrever o
  comportamento real do componente, nao o que eu assumi que ele fazia;
- `npm run test --workspace client`: 8 arquivos, 49 testes aprovados (era
  3 arquivos, 30 testes);
- `npm run lint`, `npm run check:architecture` (321 arquivos) e
  `npm run build` aprovados.

### Pendencias reais

- ainda e uma fracao pequena dos ~121 arquivos-fonte do client; a maioria
  das telas maiores (`InventoryBoard`, `ServiceOrdersBoard`,
  `AlertCenterV2`) continua sem teste de componente — ampliar isso segue
  sendo trabalho incremental para rodadas futuras, nao algo que se fecha
  de uma vez.

## 2026-08-15 - Classe de erro tipada (AppError) no backend

### Causa raiz

- a auditoria original apontou 114 ocorrencias do padrao manual
  `const error = new Error(); error.statusCode = X; throw error;` espalhadas
  pelo backend, sem nenhuma classe de erro tipada.

### Correcao

- novo `server/src/lib/errors.js`: `AppError` (subclasse real de `Error`,
  com `statusCode`/`code`/`expose`) e cinco factories atalho —
  `badRequest`, `forbidden`, `notFoundError`, `conflict`,
  `serviceUnavailable` — cobrindo os status codes 400/403/404/409/503 que
  ja apareciam no padrao manual;
- `errorMiddleware.js` ja lia `error.statusCode`/`error.code`/`error.expose`
  de forma generica (duck typing), entao nao precisou de nenhuma mudanca —
  `AppError` e compativel por construcao;
- migrados os 22 pontos de `agentScriptJobRepository.js` (7) e
  `maintenanceScriptRepository.js` (15) — os dois arquivos mais
  concentrados do padrao, e os que mais mudaram nesta mesma sessao;
- `expose` conferido caso a caso antes de migrar: para status < 500 o
  `errorMiddleware` sempre usa `error.message` direto, independente de
  `expose` — entao o default `expose: true` do `AppError` nao muda
  comportamento nenhum nesses casos; os dois casos que ja usavam
  `expose: true` explicitamente (403 e 503) continuam identicos.

### Validacoes

- novo `server/src/lib/errors.test.mjs`: cobre defaults, overrides e as
  cinco factories;
- `npm run test --workspace server`: 264 aprovados, 2 ignorados por exigir
  PostgreSQL real, 0 falhas — inclui os testes que ja verificavam
  `statusCode`/`message` exatos dos caminhos migrados (nenhuma regressao);
- `npm run test:integration --workspace server`: 22 aprovados, 2 ignorados,
  0 falhas;
- `npm run lint` e `npm run check:architecture` (317 arquivos) aprovados.

### Pendencias reais

- restam ~90 ocorrencias do padrao manual em outros arquivos do backend —
  migradas apenas os dois arquivos mais concentrados nesta rodada, como
  demonstracao do padrao; converter o resto e um trabalho mecanico mas
  extenso, fica para rodadas incrementais futuras;
- a classificacao de erro de banco por regex sobre `error.message`
  (`errorMiddleware.js`) nao foi tocada — e um problema relacionado mas
  distinto (deteccao heuristica de erro de conexao, nao falta de
  tipagem).

## 2026-08-15 - Focus trap nos modais que usam useModalLifecycle

### Causa raiz

- a auditoria original apontou "sem focus trap em nenhum modal; tratamento
  de Escape inconsistente entre eles". Investigando: `useModalLifecycle.js`
  ja existia e ja cuidava de Escape, foco inicial e restauracao de foco ao
  fechar de forma consistente — mas so 4 dos ~20 componentes tipo-modal do
  projeto usavam esse hook compartilhado; o resto tinha logica de Escape
  duplicada (ou nenhuma) e nenhum deles impedia Tab/Shift+Tab de escapar
  do modal para o conteudo atras do backdrop.

### Correcao

- `useModalLifecycle` ganhou focus trap: ao pressionar Tab no ultimo
  elemento focavel do modal (ou Shift+Tab no primeiro), o foco volta para
  o outro extremo em vez de sair do modal; tambem cobre o caso defensivo de
  o foco ja estar fora do dialog por algum outro motivo;
- `MoveMachineModal.jsx` (so tinha Escape ad-hoc) e
  `ServiceOrderFormModal.jsx` (nao tinha Escape nenhum) migrados para o
  hook compartilhado — ganham focus trap e Escape consistente no mesmo
  commit;
- escopo deliberadamente contido: migrar os ~15 modais restantes
  (`MachineDetailsModal`, `GeneralSettingsModal`, `ServiceOrderDetailsModal`
  etc., a maioria dos quais ja tem Escape ad-hoc proprio, alguns com
  excecoes especificas como o de `MachineDetailsModal` para nao fechar por
  cima de um modal de assistencia remota aberto) fica para uma proxima
  rodada — cada um precisa de revisao individual antes de trocar sua logica
  de Escape por uma generica.

### Validacoes

- novo `client/src/hooks/useModalLifecycle.test.jsx`: foco inicial no
  primeiro elemento focavel, Tab no ultimo volta ao primeiro, Shift+Tab no
  primeiro vai ao ultimo, Escape chama `onClose`, e Tab num elemento do
  meio nao interfere no fluxo normal;
- a checagem de visibilidade original (`offsetParent !== null`) nao
  funciona em jsdom (que nao calcula layout) e teria feito os proprios
  testes falharem por engano — trocada por uma checagem via
  `getComputedStyle` (`display`/`visibility`), que funciona igual em
  navegador real e em jsdom;
- validado interativamente num navegador real (nao so os testes): abri o
  formulario de criar segmento, confirmei que Shift+Tab do botao "Fechar"
  vai para "Cancelar" (pulando corretamente o botao "Criar segmento",
  desabilitado enquanto o nome esta vazio — prova que o trap respeita
  elementos desabilitados), Tab de volta retorna a "Fechar", e Escape
  fecha o modal;
- `npm run test --workspace client`: 35 testes aprovados;
- `npm run lint`, `npm run check:architecture` (315 arquivos) e
  `npm run build` aprovados.

## 2026-08-15 - Alerta ativo quando o deploy serverless nao tem Redis compartilhado

### Causa raiz

- a auditoria original apontou que a ausencia de Redis num deploy
  serverless (Vercel) degradava o rate limiter e o relay da assistencia
  remota silenciosamente, so diagnosticavel manualmente via `/api/health`
  — nenhum log ou alerta avisava no momento em que o problema realmente
  comeca (a inicializacao do processo sem as variaveis configuradas).

### Correcao

- `initializeRuntime()` (`server/src/bootstrap.js`) agora emite um log
  estruturado `serverless_without_shared_redis` assim que o processo sobe,
  se `isVercel` for verdadeiro e `detectRedisConfig()` nao encontrar
  `UPSTASH_REDIS_REST_URL`/`TOKEN` (ou as variaveis equivalentes do Vercel
  KV) — aparece nos logs de runtime da Vercel a cada cold start, nao so
  quando alguem lembra de checar `/api/health` manualmente;
- a decisao (`shouldWarnAboutMissingRedis`) foi extraida como funcao pura
  e exportada para ser testada isoladamente, sem precisar orquestrar
  `process.env.VERCEL` e reimportar modulos.

### Validacoes

- novo `server/src/bootstrap.test.mjs` cobre as 4 combinacoes de
  serverless × Redis configurado;
- `npm run test --workspace server`: 261 aprovados, 2 ignorados por exigir
  PostgreSQL real, 0 falhas;
- `npm run lint` e `npm run check:architecture` (314 arquivos) aprovados.

### Pendencias reais

- continua sendo um log, nao um alerta ativo de verdade (e-mail, Slack,
  PagerDuty) — depende de alguem observar os logs de runtime da Vercel;
  integrar com um canal de alerta real fica para uma proxima rodada.

## 2026-08-15 - Cadeia de hash na trilha de auditoria da assistencia remota

### Causa raiz

- a re-auditoria de 15/08 apontou que `remote_assistance_events` era
  "insert-only apenas por convencao de codigo": nenhum controle a nivel de
  banco detectava se uma linha historica fosse alterada ou removida por
  acesso direto ao banco (fora da aplicacao). A correcao anterior
  (`ON DELETE RESTRICT`, migration 013) protege contra exclusao em cascata
  pela API, mas nao contra adulteracao direta.

### Correcao

- migration `017` adiciona `event_hash`/`previous_event_hash` a
  `remote_assistance_events`, com backfill do historico existente calculado
  em ordem cronologica por sessao;
- `addRemoteAssistanceEvent` agora busca o hash do ultimo evento da sessao,
  calcula o proprio hash a partir de uma serializacao canonica (chaves
  ordenadas, para nao depender de como o Postgres reordena JSONB) incluindo
  o hash anterior, e grava os dois campos na mesma insercao;
- nova `verifyRemoteAssistanceEventChain(sessionId)` recalcula a cadeia
  inteira do zero e aponta o primeiro evento onde o hash gravado diverge do
  recalculado;
- novo endpoint `GET /api/remote-assistance/sessions/:id/events/integrity`
  (mesma permissao de `.../events`) expoe essa verificacao sob demanda.

### Validacoes

- novo `server/test-integration/remote-assistance-event-hash-chain.test.mjs`:
  cria uma sessao real com 3 eventos, confirma cadeia valida, adultera o
  `message` do terceiro evento via `UPDATE` direto (simulando acesso fora da
  aplicacao) e confirma que a verificacao aponta exatamente aquele evento
  como o ponto de quebra;
- `npm run test --workspace server`: 260 aprovados, 2 ignorados por exigir
  PostgreSQL real, 0 falhas;
- `npm run lint` e `npm run check:architecture` (313 arquivos) aprovados.

### Pendencias reais

- isto e deteccao, nao prevencao: nao ha trigger de banco bloqueando
  `UPDATE`/`DELETE` nessas linhas (pg-mem, usado nos testes locais, nao
  suporta `CREATE TRIGGER` — confirmado experimentalmente em rodadas
  anteriores desta sessao). Uma cadeia quebrada precisa de investigacao
  manual; o sistema nao se autocorrige nem bloqueia a operacao que já
  ocorreu.

## 2026-08-15 - Controle duplo para execucao de scripts de risco alto/critico

### Causa raiz

- a re-auditoria de 15/08 apontou que a pinagem por hash (entrega anterior)
  fecha a janela de adulteracao entre enfileiramento e entrega, mas nao
  resolve o cenario descrito no achado critico original: uma conta
  administrativa comprometida ainda pode cadastrar um script malicioso e
  enfileirar a propria execucao, porque nada impede a mesma pessoa de fazer
  as duas coisas.

### Correcao

- migracao `016` adiciona `maintenance_scripts.content_updated_by`
  (quem cadastrou ou editou o conteudo por ultimo, com backfill a partir de
  `created_by` para scripts existentes);
- `createMaintenanceScript`/`updateMaintenanceScript` passam a gravar
  `content_updated_by` a cada escrita; o controller de update agora repassa
  `req.user`, que antes nao chegava ao repositorio;
- `queueAgentScriptJob` (o unico ponto de entrada usado pelos tres
  caminhos que enfileiram trabalhos — sugestao de OS, automacao preventiva
  e plano preventivo) recusa com `403 SCRIPT_EXECUTION_REQUIRES_SECOND_REVIEWER`
  quando o script e `high`/`critical` **e** quem esta enfileirando e a
  mesma pessoa que aparece em `content_updated_by`. Sem duas contas
  distintas, um script de risco alto nunca sai do cadastro para a fila;
- frontend nao precisou de nenhuma mudanca: o erro chega como
  `error.message` e ja e exibido via toast pelo tratamento genérico
  existente em `handleUseScriptFromSuggestion`.

### Validacoes

- novo `server/test-integration/agent-script-job-dual-control.test.mjs`
  cobre quatro cenarios: risco baixo enfileirado pelo proprio autor sem
  bloqueio; risco critico recusado quando o autor tenta enfileirar sozinho;
  um segundo usuario consegue enfileirar o mesmo script critico; e depois
  que esse segundo usuario edita o conteudo, ele proprio passa a ser
  bloqueado como novo "autor";
- `npm run test --workspace server`: 259 aprovados, 2 ignorados por exigir
  PostgreSQL real, 0 falhas;
- `npm run lint` e `npm run check:architecture` (312 arquivos) aprovados.

### Pendencias reais

- o controle compara "quem enfileira" com "quem editou o conteudo", nao com
  "quem aprovou o plano automatizado"; para os caminhos de automacao
  preventiva/plano preventivo, se a mesma pessoa configurou o plano E
  cadastrou o script, o controle duplo ainda se aplica (bloqueia), mas o
  cenario de uma automacao rodando sem nenhuma segunda revisao humana em
  nenhum momento do ciclo de vida continua sendo uma superficie diferente,
  nao coberta por esta correcao;
- isto reduz o dano de uma unica conta comprometida; nao substitui
  assinatura de scripts nem uma revisao de seguranca independente.

## 2026-08-15 - Integridade de conteudo nos trabalhos de script do agente

### Causa raiz

- a auditoria de codigo de 2026-08-14 apontou que a execucao remota de
  scripts restringia apenas por **tipo** de interpretador (BAT/CMD/
  PowerShell em lista fechada), mas nunca reconferia o **conteudo**
  efetivamente entregue ao agente contra o script cadastrado e aprovado;
- em `queueAgentScriptJob`, o conteudo do script e copiado para
  `agent_script_jobs.script_content` no momento do enfileiramento; a
  entrega pelo heartbeat (`claimNextAgentScriptJob`) devolvia esse valor
  congelado sem nunca verificar se o cadastro em `maintenance_scripts`
  ainda dizia a mesma coisa — um script editado ou desativado depois de
  enfileirado, mas antes do proximo heartbeat da maquina, ainda seria
  entregue com o conteudo antigo (ou, em tese, qualquer divergencia entre
  a copia congelada e o cadastro aprovado passaria despercebida).

### Correcao

- migracao `015-agent-script-job-content-integrity` adiciona
  `agent_script_jobs.content_hash` (SHA-256 do conteudo, calculado no
  enfileiramento) e faz backfill dos trabalhos ja `queued` antes do deploy;
- `claimNextAgentScriptJob` agora faz `JOIN` com o script atual em
  `maintenance_scripts` e so entrega o trabalho se
  `sha256(conteudo atual) === content_hash` **e** o script continua ativo;
  em caso de divergencia, o trabalho e marcado `failed` (nunca chega a ser
  entregue ao agente), o log de execucao e a validacao vinculada (quando
  existe) sao encerrados como falha, e um evento
  `script_execution_blocked_content_mismatch` fica registrado no historico
  do ativo e no log geral — nada falha silenciosamente;
- a lista fechada de tipos executaveis (BAT/CMD/PowerShell) e os demais
  limites (timeout, tamanho de saida, `UseShellExecute=false` etc.)
  permanecem inalterados; esta correcao fecha o gap especifico de
  integridade de conteudo, nao substitui os demais controles.

### Bug pre-existente corrigido no caminho

- `updateMaintenanceScript` (`maintenanceScriptRepository.js`) gravava
  `active_key = NULL` no `UPDATE maintenance_scripts` — uma coluna que
  nunca existiu nessa tabela (pertence a `script_validation_runs`); qualquer
  edicao de script cadastrado quebraria com `column "active_key" does not
  exist` tambem em PostgreSQL real, nao so em pg-mem. O bug so foi
  descoberto porque este e o primeiro teste automatizado a chamar
  `updateMaintenanceScript` contra um banco de verdade; corrigido removendo
  a coluna inexistente da instrucao.

### Validacoes

- novo `server/test-integration/agent-script-job-content-integrity.test.mjs`
  cobre os tres cenarios: conteudo inalterado (entrega normal), script
  editado apos enfileirar (recusado) e script desativado apos enfileirar
  (recusado), verificando status do trabalho, do log de execucao e o
  evento no historico do ativo;
- `npm run test --workspace server`: 258 aprovados, 2 ignorados por exigir
  PostgreSQL real, 0 falhas;
- `npm run test:integration --workspace server`: 20 aprovados, 2 ignorados,
  0 falhas;
- `npm run lint` e `npm run check:architecture` (310 arquivos) aprovados.

### Pendencias reais

- a divergencia de conteudo so e detectada no momento da entrega (proximo
  heartbeat), nao no instante em que o script e editado — aceitavel porque
  o pior caso e um trabalho recusado (fail-closed), nunca uma entrega com
  conteudo desatualizado;
- trabalhos vinculados a uma automacao (`automation_run_id`) ou plano
  preventivo nao tem o cascade completo de falha propagado quando recusados
  por esta verificacao (ficam pendentes ate expirar/ser revisados
  manualmente) — cenario raro, pois exige editar o script cadastrado no
  intervalo entre o enfileiramento automatico e o heartbeat da maquina;
- assinatura criptografica de scripts para distribuicao publica (item
  separado do checklist de `SCRIPTS-MANUTENCAO-SEGURANCA.md`) continua
  pendente.

## 2026-08-15 - Vitest e Testing Library no client

### Causa raiz

- a auditoria de codigo de 2026-08-14 apontou que o frontend nao tinha
  nenhuma forma de testar componentes React (renderizacao, interacao, DOM);
  a unica cobertura existente vinha de `node --test`, rodado a partir do
  workspace do servidor, importando diretamente funcoes puras do cliente
  (`serviceOrderBoardUtils.js`, utilitarios de automacao) — o que cobre
  logica pura, mas nunca exercitou JSX de verdade.

### Correcao

- adicionado Vitest como `devDependency` do workspace `client`,
  reaproveitando o mesmo plugin React do `vite.config.js` de build (sem
  duplicar configuracao), mais `@testing-library/react`,
  `@testing-library/jest-dom` e `jsdom` para renderizacao e asserts de DOM;
- `client/vitest.config.js` (ambiente `jsdom`, setup em
  `client/src/test/setup.js`) e independente do `vite.config.js` de
  producao — nenhum arquivo `*.test.js(x)` entra no bundle final;
- `npm run test:client` na raiz roda a suite; incorporado a `npm run check`;
- cobertura inicial: os dois modulos puros mais novos ainda sem teste
  (`dashboardModel.js`, `remoteAssistanceModel.js`) e um teste de
  componente real (`SummaryCard.jsx`) provando renderizacao e matchers de
  DOM ponta a ponta.

### Validacoes

- `npm run test --workspace client`: 3 arquivos, 30 testes aprovados;
- `npm run lint`, `npm run check:architecture` (309 arquivos) e
  `npm run build` aprovados sem nenhuma mudanca de comportamento.

### Pendencias reais

- a cobertura de componente e apenas o primeiro exemplo (`SummaryCard`);
  o restante das telas React continua sem teste de renderizacao — indicado
  para ser expandido de forma incremental, nao de uma vez;
- a extracao de estado global do `App.jsx` (auth/permissoes/notificacoes)
  para Context, apontada na mesma auditoria, agora pode se apoiar nessa
  infraestrutura de teste para reduzir o risco do refactor.

## 2026-08-13 - Relay da assistencia remota funciona em deploy serverless

### Causa raiz

- o relay efemero da assistencia remota (ultimo quadro, fila de comandos,
  pausa, sinalizacao WebRTC) vivia inteiramente na memoria do processo Node
  (`Map`), o que funciona bem em `npm run dev:server` e no perfil Docker
  (processo unico e persistente), mas nao em deploy serverless: cada chamada
  a API no Vercel pode cair numa instancia de funcao diferente, sem memoria
  compartilhada, entao um quadro enviado pelo agente podia nunca chegar ao
  tecnico;
- durante a auditoria do banco no Supabase (usado como `DATABASE_URL` em
  producao), o assistente automatico do Supabase acusou Row Level Security
  desligado em todas as 70 tabelas — achado critico registrado mas nao
  corrigido nesta entrega (decisao do usuario, exige revisao tabela a tabela
  antes de ligar RLS sem quebrar o app); por causa disso, descartou-se
  qualquer solucao que exigisse expor a chave anonima do Supabase no
  navegador.

### Correcao

- `server/src/services/remoteAssistanceRelay.js` foi reescrito com um backend
  plugavel: sem `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
  configurados, continua usando o `Map` em memoria de sempre (nenhuma mudanca
  de comportamento local/Docker); com essas variaveis, passa a usar um Redis
  (Upstash) como armazenamento compartilhado entre instancias serverless;
- todas as funcoes do relay passaram a ser assincronas; `remoteAssistanceService.js`
  foi ajustado ponta a ponta para aguardar essas chamadas e para buscar o
  relay explicitamente antes de montar a resposta da sessao (a antiga
  mutacao direta do objeto em memoria, usada em `selectRemoteAssistanceMonitor`,
  foi substituida por uma chamada explicita ao setter, ja que isso deixou de
  funcionar por referencia com um backend externo);
- a fila de comandos de mouse/teclado usa `RPUSH`/`LPOP` atomico do Redis, em
  vez de leitura-modificacao-escrita de um blob JSON, para nao perder um
  clique sob chamadas concorrentes; o restante do estado do relay usa uma
  unica chave JSON com TTL de 30 minutos como rede de seguranca, alem da
  limpeza explicita ja existente ao encerrar/expirar/negar a sessao;
- o quadro de tela, quando passa pelo Redis, continua nunca sendo gravado no
  PostgreSQL/Supabase — a garantia de "nenhum frame persistido em banco"
  permanece intacta, o Redis cumpre o mesmo papel que a memoria do processo
  cumpria localmente.

### Validacoes

- `node --test server/src/services/remoteAssistanceRelay.test.mjs`: 12
  testes aprovados, incluindo o backend em memoria (comportamento preservado)
  e o backend Redis validado com um cliente falso injetado (`createRedisStore`
  exportado para teste), cobrindo JSON round-trip, TTL, mutacoes sucessivas e
  drenagem atomica da fila;
- `npm run test --workspace server`: 231 aprovados, 1 ignorado por exigir
  PostgreSQL real, 0 falhas — inclui os testes de integracao e de contrato
  WebRTC ja existentes, confirmando que o comportamento observavel pela API
  nao mudou;
- `npm run test:integration --workspace server`: 12 aprovados, 1 ignorado,
  0 falhas;
- `npm run lint`, `npm run check:architecture` (284 arquivos) e
  `npm run build` aprovados.

### Pendencias reais

- ainda nao testado contra um Upstash real (o ambiente de desenvolvimento
  nao tem acesso a rede para um Redis externo); a proxima validacao real
  acontece quando as variaveis forem adicionadas no Vercel e uma sessao for
  aberta contra o deploy;
- Row Level Security desligado em todas as tabelas do Supabase continua
  pendente — nao bloqueia a assistencia remota (que nao usa a API publica do
  Supabase), mas e um risco separado que precisa de decisao e execucao
  futuras;
- a leitura-modificacao-escrita do estado geral do relay no Redis nao e
  atomica (apenas a fila de comandos e); baixo risco na pratica (um agente e
  um tecnico por sessao), mas nao formalmente livre de corrida.

## 2026-08-13 - Assistencia remota V2: transporte funcional e inteligente

### Auditoria inicial

- a implementacao anterior tinha `REMOTE_ASSISTANCE_MAX_FPS` travado entre 1
  e 1 em `server/src/config/environment.js` — nenhum valor de ambiente
  conseguia elevar a taxa de quadros;
- o agente Windows capturava com qualidade JPEG e resolucao fixas
  (`50L`, largura maxima `1280`), reenviava todo quadro mesmo quando a tela
  nao mudava e usava intervalo fixo de 1000 ms sem nenhuma adaptacao;
- o viewer nao exibia FPS real, banda estimada, qualidade em uso ou tamanho
  do ultimo quadro, nao tinha como pausar a visualizacao e nao oferecia
  reconexao manual quando o agente parava de responder;
- a troca de monitor sempre mostrava o seletor, mesmo com uma unica tela.

### Decisao de arquitetura

- o transporte `snapshot_polling` foi mantido como principal e recebeu todas
  as melhorias desta entrega (fluidez, adaptacao, metricas, pausa);
- um transporte `webrtc` foi preparado no backend (sinalizacao SDP
  autenticada, tokens curtos, auditoria) mas permanece **desligado por
  padrao** e sem nenhum peer real — nao existe `RTCPeerConnection` no
  navegador nem biblioteca WebRTC nativa no agente C#; ativar a flag so
  libera a troca de SDP pela API, nenhuma tela adicional passa a trafegar
  por WebRTC nesta entrega.

### Backend

- `server/src/config/environment.js`: novos campos com limites seguros —
  `targetFps`/`maxFramesPerSecond` (1 a 5), `maxWidth`/`maxHeight`,
  `jpegQuality`/`minJpegQuality`/`maxJpegQuality`, `adaptiveQuality`,
  `agentCaptureMs`/`viewerPollMs` (o intervalo do agente nunca fica abaixo do
  que o teto de FPS permite), `idleTimeoutSeconds` (sempre menor que
  `agentTimeoutSeconds`), `reconnectGraceSeconds`, `transport` com fallback
  automatico para `snapshot_polling` quando `webrtc` e pedido sem a flag
  `REMOTE_ASSISTANCE_WEBRTC_ENABLED`, e bloco `webrtc` com STUN/TURN
  filtrados por esquema e limitados em quantidade;
- `server/src/domain/remoteAssistancePolicy.js`: `deriveConnectionState`
  (funcao pura que deriva `connecting`/`active`/`reconnecting`/
  `agent_offline` a partir do tempo desde o ultimo frame, sem persistir nada
  novo), `stepAdaptiveQuality` (reduz qualidade/resolucao perto do limite de
  bytes, recupera aos poucos com folga), `assertWebrtcEnabled` e
  `sanitizeSdp`;
- `server/src/services/remoteAssistanceRelay.js`: janela de metricas (FPS
  real, bytes/s, tamanho do ultimo quadro, quadros duplicados descartados),
  estado de qualidade adaptativa por sessao, flag de pausa do viewer e caixa
  efemera de sinalizacao WebRTC — tudo em memoria, nunca persistido;
- `server/src/services/remoteAssistanceService.js`: quadros passam a aceitar
  um aviso leve `{ unchanged: true }` quando identicos ao anterior (o agente
  calcula o hash antes de enviar), mantendo a sessao "fresca" sem gastar
  banda; a resposta de comandos para o agente ganhou `qualityHint`
  (largura/altura/qualidade/intervalo) e `capturePaused`; novo endpoint de
  pausar/retomar (`POST /sessions/:id/pause`); quatro endpoints de
  sinalizacao WebRTC (`webrtc/offer` e `webrtc/answer`, lado tecnico e lado
  agente), todos recusando com `409` enquanto a flag estiver desligada.

### Agente Windows

- `agent/windows/ITGuardian.RemoteAssistance.cs`: captura respeita o
  `qualityHint` recebido do servidor (largura, qualidade JPEG e intervalo de
  captura), sempre reforcando limites locais seguros como defesa adicional;
  calcula hash MD5 do quadro codificado e envia `unchanged: true` quando
  identico ao anterior; respeita `capturePaused` (para de capturar e dobra o
  intervalo de poll de comandos); falha de captura (tela bloqueada, monitor
  removido, erro de GDI) e isolada num `try/catch` proprio e nunca conta
  para o contador de falhas de rede que encerraria a sessao;
  `lastFrameHash` e resetado a cada troca de monitor para garantir que o
  primeiro quadro da nova tela sempre seja enviado por completo;
- validado compilando com `csc.exe` (.NET Framework 4.0 x64, mesmas
  referencias do instalador) — sem acesso a hardware Windows real neste
  ambiente para validar a captura de tela em execucao.

### Viewer (frontend)

- `client/src/components/remoteAssistance/RemoteAssistanceAction.jsx`:
  rodape agora mostra transporte, FPS real, latencia HTTP, banda, qualidade
  e tamanho do ultimo quadro; botao `Pausar`/`Retomar`; botao `Reconectar`
  quando o estado e `reconnecting`/`agent_offline` ou ha erro; seletor de
  monitor some quando ha apenas uma tela (mostra o nome dela em texto);
  indicador visual de quadro atrasado; `viewerPollMs` passou a vir da
  configuracao do backend em vez de fixo em 1000 ms;
- `remoteAssistanceModel.js`: novos rotulos para os estados derivados de
  conexao e formatadores de bytes/s, tamanho de quadro e transporte.

### Auditoria e seguranca (inalteradas por design)

- reautenticacao, consentimento local, indicador permanente, botao local de
  encerramento, tokens curtos e separados, flags por ambiente e bloqueio de
  modo privacidade/acoes administrativas continuam exatamente como antes;
- nenhum frame, senha ou token completo e persistido — os novos campos
  (`unchanged`, `qualityHint`, sinalizacao SDP) seguem a mesma regra;
- novos eventos de auditoria: `viewer_paused`, `viewer_resumed`.

### Validacoes

- `node --test` nos arquivos de dominio/relay alterados: 25 + 7 = 32 testes
  aprovados (config, `deriveConnectionState`, `stepAdaptiveQuality`, relay,
  metricas, dedupe, pausa);
- `npm run test --workspace server`: suite completa aprovada;
- `npm run test:integration --workspace server`: inclui novo arquivo
  `remote-assistance-webrtc-signaling.test.mjs` (bloqueio com a flag
  desligada e relay completo de oferta/resposta com a flag ligada) e cobertura
  adicional de metricas, pausa e ping de tela inalterada em
  `remote-assistance-lab.test.mjs`;
- `npx playwright test tests/e2e/remote-assistance.spec.js`: teste existente
  mantido e um novo teste cobrindo sessao ativa, metricas visiveis, aviso de
  monitor unico, pausar/retomar e encerramento;
- `npm run lint`, `npm run build` e `git diff --check` aprovados.

### Pendencias reais

- WebRTC nao tem peer real em nenhum lado — apenas a sinalizacao backend
  esta pronta; implementar `RTCPeerConnection` no viewer e um peer nativo no
  agente C# (exige biblioteca WebRTC nativa, hoje ausente do projeto) fica
  para uma proxima entrega;
- STUN/TURN nunca foram exercitados contra um servidor real;
- a captura de tela do agente e a compilacao C# foram validadas apenas por
  compilacao estatica (`csc.exe`), sem hardware Windows real disponivel
  nesta sessao para medir FPS/qualidade em condicoes de rede reais;
- o ajuste adaptativo de qualidade reage ao tamanho do quadro aceito, nao a
  uma medida direta de latencia/perda de pacotes de rede;
- assinatura de codigo do agente/instalador continua pendente, como ja
  registrado em entradas anteriores.

## 2026-08-13 - Deteccao do agente na assistencia remota considera dataSources

### Causa raiz e correcao

- `hasRemoteAssistanceAgent(asset)` reconhecia o agente apenas por
  `asset.source === "agent"` ou pelos campos diretos `agent`, `agentVersion` e
  `agentEnrollmentId`;
- uma maquina monitorada representada com `source` diferente de `agent` mas
  com `agent` presente em `asset.dataSources` (padrao ja usado por
  `getMachineSourceLabel` no inventario) deixava de exibir o icone de
  atendimento remoto no card compacto e podia ser tratada como inelegivel por
  `isRemoteAssistanceAssetFresh`, que depende dessa mesma funcao;
- `hasRemoteAssistanceAgent` passou a considerar tambem
  `Array.isArray(asset.dataSources) && asset.dataSources.includes("agent")`,
  seguindo o mesmo padrao ja usado em
  `client/src/components/inventory/agentPresentation.js`;
- nenhuma outra funcionalidade ou protecao de seguranca da assistencia remota
  foi alterada: flags desligadas por padrao, reautenticacao, consentimento
  local, auditoria e limites de FPS permanecem inalterados.

### Cobertura

- adicionado teste em `server/src/domain/remoteAssistancePolicy.test.mjs`
  cobrindo um ativo com `source` diferente de `agent` e `dataSources`
  contendo `agent`, um ativo somente `manual`, `asset` nulo e
  `dataSources` com formato invalido (nao array).

### Validacoes

- `npm run test --workspace server`: 203 testes aprovados e 1 ignorado por
  exigir PostgreSQL real, 0 falhas;
- `npm run lint`, `npm run check:architecture`, `npm run build` e
  `git diff --check` aprovados.

### Pendencias conhecidas

- indicadores visuais de FPS real e bytes por segundo do roadmap de
  Assistencia Remota V2 ainda nao foram implementados; o rodape do viewer
  continua exibindo apenas latencia HTTP e o limite fixo de FPS;
- migracao para WebRTC e assinatura do agente/instalador seguem pendentes,
  conforme `docs/ASSISTENCIA-REMOTA.md`.

## 2026-08-09 - Correcao do erro de inicializacao da tela de avisos

### Causa raiz e correcao

- a tela de avisos ainda podia falhar em producao com `Cannot access before
  initialization`;
- o agrupamento de alertas era calculado antes dos mapas auxiliares de
  dispositivos, segmentos, grupos e abas existirem no ciclo de renderizacao;
- os mapas foram declarados antes de qualquer calculo que dependa deles,
  removendo o risco de TDZ no bundle minificado de producao.

### Validacao

- validacoes executadas nesta entrega: teste direcionado de alertas, lint e
  build de producao.

## 2026-08-09 - Blindagem adicional da tela de avisos

### Causa raiz e correcao

- a tela de avisos ainda podia cair em producao quando campos de alerta
  chegavam como objetos estruturados em componentes legados ou pelo streaming;
- o hook central de dados agora normaliza alertas, historico e sugestoes assim
  que a API ou o WebSocket entregam os payloads;
- listas antigas, historico do dashboard, detalhes de sugestao e modal da
  maquina passaram a formatar valores estruturados antes de renderizar;
- a correcao reduz o risco de erro React #31 quando o agente envia objetos de
  software, hardware ou diagnostico em campos de texto.

### Validacao

- validacoes executadas nesta entrega: lint, build, teste direcionado de
  alertas e `git diff --check`;
- apos aprovacao, publicar na `main` e validar o deploy de producao no Vercel.

## 2026-08-09 - Recuperacao da tela de avisos em producao

### Causa raiz e correcao

- a tela de avisos podia receber objetos estruturados do agente/API em campos
  exibidos diretamente no JSX, como detalhes de software, correlacoes e logs;
- esses objetos disparavam o erro minificado do React #31 e derrubavam a tela
  para o fallback de runtime em producao;
- a central de avisos passou a normalizar valores estruturados antes de
  renderizar titulos, nomes, correlacoes, comentarios, checklist e logs;
- a renderizacao de valor atual, scripts, status, localizacao e comentarios foi
  endurecida para aceitar payloads mistos do agente/API sem derrubar a view;
- o nome fantasia continua priorizado, com fallback seguro para hostname/id.

### Validacao

- adicionado teste direcionado para impedir regressao quando o dado vier como
  objeto com `name`, `version`, `installedAt` e `manufacturer`;
- validacoes executadas nesta entrega: teste direcionado de alertas, lint,
  build e `git diff --check`.

## 2026-08-03 - Instalador 1.6.3 e finalizacao deterministica

### Causa raiz e correcao

- o erro de instalacao `45:2724` foi reproduzido e localizado no uso de
  `$LASTEXITCODE` depois da abertura do executavel Windows sem console;
- o heartbeat inicial agora usa `Start-Process -Wait -PassThru` e avalia o
  `ExitCode` do processo real, inclusive quando o servidor estiver
  temporariamente indisponivel;
- a partida imediata da tarefa agendada deixou de cancelar a instalacao quando
  o Windows ja registrou a tarefa e pode inicia-la no proximo ciclo;
- a pasta de logs permite escrita pelo coletor em segundo plano e pelo icone de
  bandeja, sem ampliar o acesso ao `config.json` protegido;
- uma falha de escrita de log nao encerra mais o agente nem mascara o erro
  operacional original.

### Artefato e validacao

- coletor e instalador alinhados na versao `1.6.3`;
- artefato `ITGuardian-Collector-Setup.exe` gerado com 2.099.315 bytes e
  SHA-256 `EA93DD6A2F483F9BA29405DE939F4A7CED8961F94AC599DCF4C94A424607DAC7`;
- parser PowerShell e testes direcionados do instalador aprovados;
- o coletor recompilado foi executado com `--once` e retornou um codigo de
  processo controlado, sem a excecao CLR que derrubava a versao anterior.
- `npm run lint`, `npm run check:architecture`, `npm run build` e
  `git diff --check` aprovados;
- testes do servidor: 184 executados, com 183 aprovados e 1 ignorado.

### Pendencia conhecida

- o executavel ainda nao possui assinatura Authenticode.

## 2026-08-03 - Instalador 1.6.2, reparo visivel e download confiavel

### Correcao da finalizacao

- o modo `Instalar ou reparar o IT Guardian` passou a ser exibido antes da
  ativacao e tambem reconhece residuos de uma instalacao interrompida;
- uma configuracao valida continua sendo preservada no reparo; instalacoes
  parciais solicitam a chave novamente e reconstroem a configuracao;
- o heartbeat inicial ganhou tres tentativas e deixou de cancelar uma
  instalacao estruturalmente valida por indisponibilidade momentanea da rede;
- a tarefa resiliente do Windows permanece responsavel pelas novas tentativas;
- o log de diagnostico agora tambem e preservado em
  `C:\ProgramData\ITGuardian-install-finalize.log`, fora da pasta removida pelo
  rollback do instalador.

### Publicacao e validacao

- coletor e instalador alinhados na versao `1.6.2`;
- artefato `ITGuardian-Collector-Setup.exe` gerado com 2.099.090 bytes e
  SHA-256 `ED07BDD7B7356B8876A72F7EC50ABC61B664FA232310B4A5168AB29C74C47876`;
- testes de seguranca do instalador: 3/3 aprovados;
- `npm run lint`, `npm run build` e `git diff --check` aprovados;
- a interface aponta para o release versionado do instalador quando nenhuma
  URL externa for configurada.

### Pendencia conhecida

- o executavel ainda nao possui assinatura Authenticode; a assinatura de
  codigo continua obrigatoria antes de uma distribuicao comercial ampla.

## 2026-08-02 - Hardening profissional e recuperacao da tela branca

### Estabilidade do frontend e Vercel

- identificada a causa da tela branca: HTML/main bundle antigo referenciando um
  chunk lazy removido por um deploy mais novo;
- navegacoes SPA passaram a usar `no-store` e assets com hash mantem cache
  imutavel;
- falha de import dinamico faz uma unica recarga com cache busting, sem loop;
- um Error Boundary exibe recuperacao profissional em vez de deixar `#root`
  vazio quando ocorre uma falha de renderizacao.

### Seguranca e coletor 1.6.1

- `ENABLE_REMOTE_SCRIPT_EXECUTION=false` tornou-se o padrao documentado;
- API recusa criar jobs, heartbeat nao entrega jobs e coletor exige uma segunda
  flag local antes de executar qualquer comando;
- frontend informa o modo de simulacao/registro e nao oferece execucao real;
- rotas publicas e do coletor receberam limites dedicados;
- payload do coletor passou a ter limite local de 1 MB;
- tarefa agendada descreve apenas inventario e heartbeat;
- usuario logado segue opcional e desligado por padrao.

### Auditoria e pendencias

- criada `docs/AUDITORIA-BETA-PROFISSIONAL.md` com arquitetura, privacidade,
  matriz de riscos e controles;
- assinatura de codigo, atualizacao automatica assinada e homologacao em VM
  limpa continuam pendentes antes de uso em cliente real.

## 2026-08-02 - Reparo do agente e ciclo real de manutencao

### Instalador e agente 1.6.1

- o instalador detecta a instalacao existente e oferece `Reparar ou atualizar`,
  preservando chave, token, identificacao e configuracao da maquina;
- a tarefa do coletor e recriada como `SYSTEM`, com gatilhos no boot e logon,
  execucao em bateria, inicio assim que possivel e tentativas apos falha;
- o loop do agente deixou de depender de uma espera longa: recarrega a
  configuracao e retoma o heartbeat logo depois de suspensao ou hibernacao;
- a coleta de Office e softwares foi ampliada para registros de maquina e
  perfis de usuario carregados, sem criar exclusoes de antivirus.

### Auditoria das anotacoes operacionais

- o link `Abrir chamado` instalado no Windows agora recebe uma identificacao
  assinada e limitada da ativacao; ao escolher `O problema e na minha maquina`,
  o chamado usa automaticamente a maquina correta sem expor a chave do produto;
- o modo de reparo renova esse link para instalacoes existentes e recria o
  atalho publico com a identificacao atual;
- maquinas sem contato ficam `Offline` durante os primeiros tres dias e passam
  para `Erro` somente depois desse prazo, com a mesma regra em dashboard,
  inventario e cards;
- o nome fantasia passou a substituir o hostname no objeto compartilhado pelo
  frontend, preservando o hostname apenas como dado tecnico e fallback;
- plantas podem ser excluidas pelo botao vermelho da barra superior e o zoom
  por roda/clique so captura a interacao quando a ferramenta de lupa esta ativa;
- ordens nao finalizadas continuam visiveis nos meses seguintes; ordens
  finalizadas permanecem visiveis ate o mes em que foram encerradas.

### Ordens de servico e inventario

- a entrada e saida de manutencao passaram a ser persistidas no backend;
- criacao, vinculacao, troca de maquina, finalizacao e exclusao de OS agora
  sincronizam o segmento de manutencao e o historico da maquina;
- chamados publicos, sugestoes aceitas e OS geradas por preventiva usam o mesmo
  ciclo de manutencao;
- foram criadas as tabelas `maintenance_records` e `backup_assignments`, com
  indices por maquina, OS e status;
- o frontend deixou de simular localmente a manutencao e recarrega o estado
  canonico do servidor.

### Execucao e limites

- sugestoes, preventivas e automatizacoes continuam usando a fila autenticada
  de trabalhos do agente, com tipo permitido, timeout e limite de saida;
- os testes validam enfileiramento, claim, resultado e historico, sem executar
  um BAT arbitrario no computador de desenvolvimento;
- o instalador faz upgrade preservando ativacao, mas autoatualizacao silenciosa
  assinada ainda nao foi implementada;
- SMART, temperatura, licencas e alguns dados de hardware continuam sujeitos ao
  suporte de firmware, driver, Windows e politicas da organizacao.

### Validacoes

- 178 testes aprovados e 1 teste dependente de PostgreSQL real ignorado;
- o teste integrado reproduziu criacao de OS, vinculacao posterior, entrada em
  manutencao, desvinculacao e saida da manutencao;
- lint, build de producao, arquitetura e `git diff --check` aprovados;
- o smoke E2E foi alinhado ao contrato atual de `/api/health`, que informa
  `database: "ok"` quando a conexao esta saudavel;
- Inno Setup 6.7.3 compilou o instalador Windows 1.6.1;
- SHA-256 do instalador:
  `1D8D4C51626D1F4CDE8ED369F717C7CC254FA632D0898BA83912EA7087494C4E`.

### Compatibilidade desta atualizacao

- uma instalacao nova ja recebe o atalho identificado durante a ativacao;
- uma instalacao anterior deve executar o instalador 1.6.1 e escolher
  `Reparar ou atualizar` uma vez para renovar o atalho sem perder a ativacao.

## 2026-07-29 - Alias nos avisos e inventario ampliado do agente 1.5.0

### Entrega

- sugestoes de OS passaram a resolver o nome fantasia persistido da maquina,
  inclusive para avisos criados antes da alteracao;
- titulos dos cards foram resumidos para formatos como `RAM alta em <maquina>`
  e `Disco em alerta em <maquina>`;
- a seta do card de maquina real voltou a exibir os perifericos coletados, em
  modo somente leitura;
- coletor Windows 1.5.0 passou a enriquecer CPU, modulos de memoria, video,
  placa-mae, bateria, adaptadores de rede e perifericos Plug and Play;
- os novos dados foram distribuidos nas abas Hardware, Rede e Perifericos do
  inventario, preservando a organizacao atual da interface;
- instalador e desinstalador foram recompilados na versao 1.5.0.

### Validacoes

- 165 testes unitarios aprovados e 1 teste dependente de PostgreSQL real
  ignorado;
- 9 testes de integracao aprovados e 1 teste dependente de PostgreSQL real
  ignorado;
- lint, build de producao e compilacao do instalador aprovados;
- `git diff --check` aprovado;
- SHA-256 do instalador:
  `7E789297A7C74EA5B82B42793E2A2206DBC5EF30EAC7CB3FCDD6C050060781B2`.

### Pendencias conhecidas

- as maquinas existentes precisam receber o coletor 1.5.0 e concluir uma nova
  coleta para que os campos adicionais e perifericos aparecam;
- SMART, temperatura, desgaste, licencas e sensores dependem do que o Windows,
  o fabricante e as permissoes do endpoint realmente disponibilizam; o sistema
  nao inventa valores quando a fonte nao responde;
- assinatura do instalador e ensaio em maquina Windows limpa continuam
  necessarios antes da distribuicao publica.

## 2026-07-29 - Beta centrada no coletor nativo

### Decisao e entrega

- coletor Windows nativo definido como unica dependencia obrigatoria no
  endpoint;
- OCS e Zabbix mantidos como adaptadores avancados, opcionais, somente leitura
  e desabilitados por padrao;
- instalador comum simplificado para solicitar apenas a chave e instalar o
  coletor nativo, sem baixar ou empacotar agentes externos;
- alertas do coletor cobrem heartbeat atrasado, CPU, memoria, disco alto e disco
  praticamente cheio;
- documentacao de cloud, beta, seguranca e integracoes alinhada ao
  comportamento real;
- decisao e limites registrados em `DECISAO-OCS-ZABBIX-BETA.md`.

### Pendencias conhecidas

- inventario completo de softwares, temperatura e atualizacao automatica foram
  adiados ate existirem politicas e fontes tecnicas confiaveis;
- assinatura do instalador e ensaio em maquina virtual limpa continuam
  requisitos antes da distribuicao publica.

## 2026-07-29 - Inventario real, avisos reais e execucao controlada pelo agente

### Entrega

- cards das maquinas coletadas pelo agente voltaram ao mesmo formato compacto
  do inventario, sem um bloco visual exclusivo para heartbeat;
- informacoes do coletor foram distribuidas entre Geral, Hardware e Rede; a aba
  separada `Agente IT Guardian` foi removida;
- Central de Avisos deixou de sintetizar dados de demonstracao e agora cria
  avisos somente a partir de maquinas reais do agente: heartbeat atrasado, CPU,
  memoria e disco;
- registros antigos com origem `mock` foram excluidos das consultas de avisos
  e sugestoes;
- criada fila persistente `agent_script_jobs`, vinculada ao ativo, enrollment,
  script cadastrado, log, validacao, preventiva e execucao automatizada;
- heartbeat autenticado entrega no maximo um trabalho pendente para a propria
  maquina e a nova rota autenticada recebe seu resultado;
- agente Windows 1.3.0 executa apenas scripts cadastrados dos tipos BAT, CMD e
  PowerShell, usando executaveis fixos do Windows, sem `shell: true`, com timeout,
  limite de saida, validacao de privilegio e remocao do arquivo temporario;
- sugestoes, preventivas manuais e agendas automatizadas passaram a enfileirar
  execucao real no agente, mantendo o cadastro e o resultado na mesma transacao;
- conclusao atualiza logs, validacoes, planos, agendas, auditoria global e o
  historico da respectiva maquina acessado pelo Inventario.

### Validacoes

- fluxo integrado de fila, entrega pelo heartbeat, retorno de resultado, log e
  historico da maquina aprovado sem executar um script operacional;
- suite completa, incluindo o roundtrip: 160 testes aprovados, 1 ignorado por
  exigir PostgreSQL real e 0 falhas;
- testes especificos do agente Windows aprovados;
- build de producao aprovado com 2.353 modulos transformados;
- lint sem avisos, verificacao arquitetural aprovada em 254 arquivos e
  `git diff --check` aprovado;
- compilacao do codigo C# do agente validada.

### Pendencias conhecidas

- reinstalar o coletor atualizado nas maquinas reais para habilitar o consumo
  da fila;
- validar em homologacao um script cadastrado de baixo risco antes de liberar
  rotinas operacionais;
- o teste automatizado usa resultado sintetico e nao executa BAT, CMD ou
  PowerShell no computador de desenvolvimento.

## 2026-07-29 - Finalizacao robusta e desinstalador executavel

### Escopo

- registro da inicializacao do coletor migrado para `schtasks.exe`;
- finalizacao passou a registrar diagnostico em
  `C:\ProgramData\ITGuardian\logs\install-finalize.log`;
- adicionado `ITGuardian-Uninstaller.exe` com icone e elevacao controlada para
  iniciar o desinstalador oficial do pacote.

## 2026-07-28 - Correcao dos argumentos opcionais do instalador Windows

### Escopo

- corrigida a falha de pos-instalacao causada pelo repasse de argumentos vazios
  de OCS/Zabbix ao `powershell.exe`;
- o instalador agora omite os parametros externos quando a organizacao utiliza
  somente o coletor nativo do IT Guardian;
- configuracoes externas parciais continuam bloqueadas para evitar uma
  instalacao inconsistente.

### Validacoes

- falha reproduzida com o mesmo comando do instalador e confirmada como
  `MissingArgument` para `OcsServerUrl`;
- teste de regressao do instalador atualizado;
- novo instalador recompilado e fluxo sem OCS/Zabbix validado.

## 2026-07-28 - Ativacao cloud independente de OCS e Zabbix

### Entrega

- ativacao por chave deixa de exigir infraestrutura OCS/Zabbix para cadastrar o
  coletor nativo do IT Guardian;
- instalador sempre configura o coletor, a tarefa SYSTEM, o indicador da
  bandeja e valida o primeiro heartbeat;
- OCS Inventory Agent e Zabbix Agent 2 permanecem incorporados ao pacote, mas
  so sao instalados quando a chave devolve os tres destinos completos;
- configuracao externa parcial continua bloqueada para evitar agentes
  instalados incorretamente;
- nenhuma URL ficticia, dependencia de Radmin ou servidor local improvisado foi
  introduzido.

### Validacoes executadas

- integracao confirmou ativacao `201`, token derivado, vaga e enrollment para
  chave sem monitoramento externo;
- integracao confirmou resposta explicita `monitoring.configured=false` e
  destinos nulos;
- teste de seguranca do instalador confirmou instalacao condicional dos agentes
  externos e ausencia de persistencia da chave;
- lint, verificacao de arquitetura, integracao completa e build de producao
  aprovados;
- parser do PowerShell aprovado para os scripts operacionais;
- Inno Setup 6.7.3 compilou o instalador 1.3.0 com sucesso;
- artefato final `ITGuardian-Collector-Setup.exe` com 24.078.647 bytes e
  SHA-256
  `0D0A999BE485920C0D0478A54908CBFB64575A2B37D48386FD9CF288081126E2`;
- deploy de producao Vercel `dpl_7H7qRHVn5YMzgie1JMjFJs9RJP32`
  confirmado como `READY` para o commit `bbd01b2`;
- `/api/health` confirmou API e banco em estado `ok`;
- chave real da organizacao validada em producao com `201`, token derivado,
  URL de suporte e ativacao da maquina, mesmo sem destinos OCS/Zabbix.

### Pendencias conhecidas

- OCS e Zabbix somente funcionarao depois que servidores centrais reais e
  acessiveis forem vinculados a chave;
- validar o novo executavel em uma VM Windows limpa e assina-lo antes da
  distribuicao publica.

## 2026-07-28 - Destinos OCS e Zabbix automaticos por chave

### Entrega

- migracao `007-product-key-monitoring` adiciona OCS, Zabbix passivo e Zabbix
  ativo a cada chave de produto;
- rota administrativa `PUT /api/product-keys/:id/monitoring` e CLI
  `product-key:monitoring` configuram chaves existentes;
- criacao de chave aceita os tres destinos em conjunto;
- ativacao devolve automaticamente os destinos pertencentes a chave, sem
  credenciais das APIs centrais;
- resposta de ativacao mantem o objeto `monitoring` e tambem entrega os tres
  destinos no nivel principal esperado pelo instalador Windows 1.3.0;
- destinos externos ausentes sao devolvidos como nulos; desde a correcao de
  compatibilidade posterior, isso nao bloqueia o coletor nativo;
- instalador 1.3.0 simplificado para solicitar somente a chave de produto;
- chave e destinos nao sao gravados no `config.json`; somente o token derivado
  e mantido com ACL restrita.

### Validacoes executadas

- teste de integracao original cobriu o bloqueio anterior; a entrada posterior
  registra a substituicao por monitoramento externo opcional;
- acesso a configuracao validado em `403` para operador e `200` para
  administrador;
- URL OCS com protocolo invalido rejeitada em `400`;
- duas chaves retornaram destinos diferentes sem vazamento entre organizacoes;
- teste do instalador confirmou ausencia da pagina manual de OCS/Zabbix e
  ausencia de persistencia da chave;
- `npm run lint` aprovado sem avisos;
- verificacao de arquitetura aprovada para 250 arquivos;
- servidor aprovado em 157 testes: 156 aprovados, nenhum reprovado e 1 teste de
  PostgreSQL real ignorado por depender de infraestrutura externa;
- build de producao aprovado com 2.353 modulos transformados;
- parser do PowerShell aprovado para os quatro scripts operacionais do pacote;
- `git diff --check` aprovado;
- Inno Setup compilou o instalador 1.3.0 com sucesso;
- artefato final `ITGuardian-Collector-Setup.exe` com 24.078.644 bytes e
  SHA-256
  `6D55BBEBE8D21CDB893E70D5F438D01733FB37D19F224B8C4786CDB1092CE000`.

### Pendencias conhecidas

- cadastrar os destinos reais OCS/Zabbix na chave que sera usada nesta
  organizacao;
- reinstalar e validar o pacote em uma VM Windows limpa depois da configuracao;
- assinar o instalador antes de uma distribuicao publica.

## 2026-07-28 - OCS e Zabbix incorporados ao instalador Windows

### Entrega

- instalador Windows atualizado para incluir OCS Inventory Agent 2.11.0.1 e
  Zabbix Agent 2 7.0.29 oficiais;
- build reproduzivel baixa os pacotes somente das distribuicoes oficiais,
  valida hashes SHA-256 fixos e exige assinaturas Authenticode dos publicadores
  FactorFX e Zabbix SIA;
- assistente instala os agentes com os destinos vinculados a chave;
- instalacao silenciosa configura os dois agentes como servicos automaticos e
  exige que ambos alcancem o estado `Running`;
- arquivo `monitoring-agents.json` registra versoes, destinos, servicos e
  propriedade da instalacao;
- desinstalador remove um agente externo somente quando o marcador confirma que
  ele foi instalado pelo IT Guardian, preservando instalacoes preexistentes;
- desinstalador disponivel em `Aplicativos instalados` e pelo atalho
  `Desinstalar IT Guardian` no menu Iniciar;
- binarios de terceiros permanecem fora do Git e sao incorporados somente ao
  artefato compilado.

### Validacoes executadas

- assinaturas e hashes dos pacotes oficiais aprovados;
- parser do PowerShell aprovado para os scripts do instalador;
- testes direcionados do instalador e seguranca aprovados;
- build de producao aprovado com 2.353 modulos transformados;
- `git diff --check` aprovado;
- Inno Setup 6.7.3 compilou o instalador 1.3.0 com os dois agentes incorporados;
- artefato final `ITGuardian-Collector-Setup.exe` com 24.078.918 bytes e
  SHA-256
  `D6CF7643E15048BB513657A39B8275AED3BB8428C74127FF04B9E20E0D86A728`;
- IT Guardian 1.2.0 desinstalado deste computador com codigo de saida `0`;
- registro de aplicativo, diretorio antigo, tarefas agendadas, processo e
  entrada de inicializacao automatica da versao 1.2.0 confirmados como ausentes.

### Pendencias conhecidas

- vincular os enderecos reais dos servidores OCS e Zabbix a chave;
- informar uma chave de produto valida para a reinstalacao;
- depois dessas configuracoes, instalar e executar o ensaio completo da 1.3.0
  neste computador;
- os servidores centrais OCS/Zabbix continuam sendo infraestrutura separada:
  o instalador distribui os agentes Windows, nao servidores ficticios locais.

## 2026-07-28 - Fontes reais e identidade nativa no Windows

### Entrega

- OCS e Zabbix restritos aos modos `real` e `disabled`, sem fallback mock e sem
  criacao de maquinas ficticias;
- snapshots mock antigos removidos na inicializacao e registros obsoletos de
  cada fonte removidos depois de uma sincronizacao real;
- seed historico de maquinas manuais removido do codigo e seed de outros dados
  demonstrativos condicionado a `ENABLE_DEMO_SEED=true` explicitamente;
- migracao remove somente os 13 ativos manuais exatos do seed historico,
  preservando ativos reais criados pelo usuario;
- sincronizacao automatica inicial e periodica de OCS/Zabbix em processos
  persistentes com acesso a LAN, com protecao contra execucoes sobrepostas;
- aplicativo nativo `ITGuardian.exe`, com produto, descricao e processo
  identificados como `IT Guardian`;
- tarefa `IT Guardian Collector` executada como SYSTEM na inicializacao e
  indicador visual iniciado com a sessao do Windows;
- icone oficial compartilhado pelo executavel, instalador, desinstalador,
  bandeja e atalho `Abrir chamado - IT Guardian`;
- indicador da bandeja estritamente visual, sem menu, execucao remota ou
  comandos para o usuario.

### Validacoes executadas

- parser do PowerShell aprovou gerador de icone, build, finalizacao,
  desinstalacao e diagnostico;
- testes de clientes confirmam que configuracoes mock legadas ficam
  desabilitadas e nao retornam dados inventados;
- teste de integracao confirma remocao de registros obsoletos apos
  sincronizacao real vazia;
- teste de seguranca do instalador cobre identidade nativa, tarefa de
  inicializacao, bandeja, icones e ausencia de execucao de shell.
- suite completa do servidor: 156 testes aprovados, 1 ignorado por exigir
  PostgreSQL real e 0 falhas;
- suite de integracao: 8 testes aprovados, 1 ignorado pelo mesmo requisito e
  0 falhas;
- cobertura selecionada: 89,66% de linhas, 64,17% de branches e 86,21% de
  funcoes;
- lint sem avisos, verificacao arquitetural aprovada em 248 arquivos,
  `git diff --check` aprovado e build de producao concluido com 2.353 modulos;
- Inno Setup 6.7.3 compilou o instalador final
  `ITGuardian-Collector-Setup.exe` sem avisos.

### Pendencias conhecidas

- configurar endpoints e credenciais reais de OCS e Zabbix; o `.env` deste
  computador ainda nao possui esses dados;
- executar a API/worker em uma maquina persistente que alcance os dois servicos
  na LAN;
- reinstalar o pacote Windows atualizado nas maquinas para aplicar executavel,
  tarefa, bandeja e icones novos;
- assinar o instalador antes de uma distribuicao publica.

## 2026-07-28 - Coletor cloud e licenciamento por chave

### Entrega

- chaves de produto armazenadas somente em hash, com expiracao, estado e limite
  transacional de computadores;
- ativacoes por fingerprint em hash, reinstalacao idempotente, revogacao de
  tokens e liberacao de vagas;
- endpoint publico e limitado para ativar o coletor, com rotas administrativas
  protegidas por autenticacao e papel de administrador;
- telemetria real ampliada com CPU, memoria, disco, fabricante, modelo e serial;
- instalador visual Inno Setup que pede somente a chave, cria tarefa SYSTEM,
  valida o primeiro heartbeat e instala o atalho de abertura de chamado;
- painel administrativo para chaves, ativacoes, OCS, Zabbix e download do
  instalador;
- arquitetura cloud/local e runbook operacional documentados.

### Validacoes executadas ate a consolidacao

- teste de ativacao invalida, inativa, expirada e acima do limite;
- reinstalacao da mesma maquina sem consumir nova vaga;
- concorrencia de duas maquinas pela ultima vaga sem ultrapassar o limite;
- acesso administrativo validado em `401`, `403` e `200`;
- token anterior revogado e heartbeat real persistido no inventario;
- instalador verificado contra persistencia da chave e execucao remota;
- suite completa do servidor: 154 testes aprovados, 1 ignorado por exigir
  PostgreSQL real e 0 falhas;
- suite de integracao: 7 testes aprovados, 1 ignorado pelo mesmo requisito e
  0 falhas;
- lint sem avisos, verificacao arquitetural aprovada em 248 arquivos e
  `git diff --check` aprovado;
- cinco scripts PowerShell do agente e do instalador aprovados pelo parser;
- build de producao aprovado, com 2.353 modulos transformados e saida da
  Vercel preparada;
- Inno Setup 6.7.3 instalado e instalador final compilado com sucesso.

### Pendencias conhecidas

- assinar o executavel e testar instalacao/desinstalacao em VM Windows limpa;
- publicar o instalador em HTTPS e configurar `VITE_COLLECTOR_INSTALLER_URL`;
- configurar PostgreSQL gerenciado e variaveis no deploy definitivo;
- executar OCS/Zabbix em processo com acesso a LAN quando forem habilitados.

## 2026-07-27 - Beta funcional consolidada na main

### Entrega

- perfil local oficial com Docker Compose, PostgreSQL persistente, API Express
  e frontend Nginx;
- inicializacao, diagnostico, parada, backup, restore e reset por scripts
  PowerShell;
- criacao segura do primeiro administrador e de enrollments para agentes;
- agente Windows com heartbeat e inventario basico, sem execucao remota;
- estado online/offline integrado ao inventario e vinculacao de ativos no mapa
  2D;
- OCS e Zabbix mantidos como integracoes opcionais e desabilitadas por padrao;
- documentacao da beta, instalacao, agente, seguranca, testes em maquinas reais
  e checklist de liberacao.

### Commits consolidados

- `165783a` - adiciona modo local de instalacao do IT Guardian;
- `c391bb3` - integra agente Windows ao inventario real;
- `6cd8ec6` - cobre inventario e heartbeat do agente;
- `24f497e` - documenta instalacao local e agente Windows;
- `fa12f3d` - adiciona integracoes opcionais OCS e Zabbix;
- `c7e7b6a` - prepara runtime da beta funcional;
- `d487c21` - consolida operacao do agente Windows;
- `402eba9` - documenta instalacao e validacao da beta.

### Validacoes

- testes unitarios: 149 aprovados e 1 ignorado;
- testes de integracao: 4 aprovados e 1 ignorado;
- lint aprovado;
- build de producao aprovado;
- verificacao arquitetural aprovada em 237 arquivos;
- 19 scripts PowerShell validados por parser;
- smoke test realizado com Docker e PostgreSQL reais.

### Pendencias conhecidas

- concluir o ensaio completo com um segundo computador Windows;
- configurar HTTPS ou VPN antes de qualquer exposicao fora da LAN;
- validar restore e recuperacao de desastre no ambiente definitivo;
- habilitar OCS ou Zabbix somente em ambiente de homologacao.

## 2026-07-29 - Correcao do limite de conexoes na Vercel

### Incidente

- login e demais rotas da API retornavam `500` em producao;
- os logs da Vercel confirmaram `EMAXCONN`, com o limite de 200 conexoes do
  PostgreSQL esgotado.

### Correcao

- pool limitado a uma conexao por instancia serverless, inclusive quando uma
  configuracao antiga de `DB_POOL_MAX` solicitar um valor maior;
- conexoes ociosas passam a ser liberadas em cinco segundos na Vercel;
- `allowExitOnIdle` habilitado em serverless;
- servidor tradicional preserva o pool padrao de dez conexoes e continua
  aceitando configuracao explicita.

### Validacoes

- 165 testes do servidor aprovados e 1 ignorado;
- lint aprovado;
- build de producao aprovado;
- `git diff --check` aprovado.

## 2026-07-29 - Inventario real ampliado e nomes fantasia persistentes

### Entrega

- agente Windows 1.4.0 passou a coletar arquitetura, nucleos fisicos, usuario
  local consentido, saude dos modulos de memoria, Office, licencas parciais,
  softwares instalados e detalhes dos discos;
- discos agora usam `MSFT_StorageReliabilityCounter` e SMART legado como
  fallback para temperatura, horas ligadas, setores realocados, desgaste e
  estimativa de saude, respeitando o que cada fabricante disponibiliza;
- detalhes ampliados do agente sao validados, limitados a 1 MB e persistidos
  em `agent_assets.inventory_details`;
- nome fantasia de ativos do agente passou a ser salvo no servidor e
  preservado nos heartbeats posteriores;
- cards, diagnosticos e historico de avisos usam o nome fantasia sem perder o
  hostname tecnico usado na correlacao;
- inventario abre sempre no Quadro quando acessado pela navegacao principal;
- objetos claros do editor 2D, especialmente PCs sobre mesas, recebem uma cor
  de contraste por tipo para nao desaparecerem;
- titulo da planta recebeu espaco adicional controlado para nomes de ambiente;
- instalador e desinstalador Windows foram recompilados na versao 1.4.0.

### Execucao de scripts

- o fluxo autenticado de BAT, CMD e PowerShell permanece restrito ao agente
  Windows instalado;
- o servidor cria a tarefa, o agente a retira por heartbeat, executa em
  processo controlado, devolve resultado e registra log e historico do ativo;
- nenhuma execucao ocorre dentro da Vercel ou do navegador.

### Validacoes

- 165 testes do servidor aprovados, 1 ignorado por exigir PostgreSQL real e
  nenhuma falha;
- teste de integracao do agente confirmou inventario ampliado, persistencia do
  nome fantasia, retirada de tarefa, resultado e historico;
- teste PowerShell do agente aprovado;
- lint e `git diff --check` aprovados;
- build de producao aprovado com 2.353 modulos transformados;
- Inno Setup 6.7.3 compilou com sucesso o instalador Windows 1.4.0.

### Limitacoes conhecidas

- SMART, temperatura, vida util e dados de licenca dependem do suporte do
  hardware, driver, fabricante e edicao do Windows;
- a saude do disco e exibida como estimativa quando calculada por desgaste ou
  atributos SMART, sem prometer precisao que o dispositivo nao fornece;
- maquinas instaladas com agente anterior precisam atualizar para 1.4.0 para
  enviar os novos campos.

## 2026-07-29 - Protecao de renderizacao e hardware segmentado

### Incidente

- a tela podia ficar branca ao renderizar registros estruturados de software
  como filhos React;
- o erro de producao indicava um objeto com os campos `name`, `version`,
  `installedAt` e `manufacturer`.

### Correcao

- valores estruturados de inventario agora passam por formatacao segura antes
  de chegar ao JSX;
- a lista resumida de softwares usa rotulos legiveis e chaves estaveis;
- a aba Hardware foi dividida em sistema, processador, memoria, video,
  placa-mae, armazenamento, energia e licenciamento;
- modulos de memoria, adaptadores de video e discos possuem detalhamento
  individual, sem misturar todos os dados em uma unica grade.

### Compatibilidade

- formatos antigos, textos simples e os novos objetos enviados pelo agente sao
  aceitos simultaneamente;
- dados ausentes continuam apresentados como indisponiveis, sem interromper a
  pagina inteira.

## 2026-07-29 - Avisos consolidados e perifericos manuais

### Avisos e nomes

- alertas e preventivas passam a usar o nome fantasia da maquina, mantendo o
  hostname como fallback;
- sugestoes ativas da mesma maquina aparecem em um unico card, com problemas
  resumidos, ocorrencias acumuladas e prioridade recalculada;
- quando a validacao de um BAT confirma a resolucao, o problema vinculado deixa
  o agrupamento; sem problemas ativos, o card desaparece;
- avisos sem nova ocorrencia sao encerrados automaticamente apos 48 horas por
  padrao, com o prazo editavel nas configuracoes de Avisos.

### Perifericos

- a lista exibida no card e nos detalhes da maquina agora contem somente os
  perifericos cadastrados manualmente pelo tecnico;
- inclusoes e remocoes sao persistidas por usuario e registradas no historico
  da maquina;
- dados eventualmente coletados pelo agente permanecem separados e nao
  preenchem a lista manual.

### Validacoes

- build de producao aprovado;
- 171 testes aprovados e 1 ignorado por exigir PostgreSQL real;
- testes novos cobrem nome fantasia, fallback, consolidacao, escalonamento de
  prioridade, remocao progressiva de problemas, prazo configuravel e separacao
  entre perifericos coletados e cadastrados manualmente;
- lint e `git diff --check` aprovados.

## 2026-08-03 - Heartbeat resiliente a caracteres NUL

### Incidente

- o coletor 1.6.3 iniciava e tentava comunicar a cada cinco minutos, mas os
  heartbeats de uma maquina especifica recebiam HTTP 500;
- os logs de producao identificaram o PostgreSQL `22P05`, causado por caractere
  NUL vindo de um valor de Registro ou WMI dentro do inventario coletado;
- como o heartbeat inteiro era rejeitado, a maquina mantinha o ultimo estado
  conhecido e aparecia incorretamente como erro.

### Correcao

- campos textuais e toda a arvore de `inventoryDetails` agora removem somente
  caracteres NUL antes da validacao e persistencia;
- chaves de objetos aninhados tambem sao higienizadas para proteger colunas
  JSONB do PostgreSQL;
- o tratamento ocorre no servidor, portanto coletores 1.6.3 ja instalados se
  recuperam no heartbeat seguinte sem reinstalacao.

### Cobertura

- o teste de integracao do agente envia NUL em hostname, nome fantasia, nome de
  software, chave e valor estruturados;
- o teste exige aceite HTTP 202 e confirma os dados persistidos sem o caractere
  invalido.

## 2026-08-09 - Biblioteca profissional do editor de plantas

### Evolucao

- criada uma biblioteca versionada para objetos 2D/3D com manifesto, autoria,
  origem, licenca, dimensoes, escala, tags e capacidade de vinculo ao inventario;
- preservados os modelos CC0 de Kenney e Quaternius e os caminhos legados usados
  por plantas existentes;
- adicionadas categorias e objetos para escritorio, TI, rede e ambiente hospitalar;
- o resolvedor 3D agora consulta a biblioteca central antes de recorrer ao fallback;
- glifos de planta baixa foram ampliados para leito, maca, carrinho medico, balcao
  e sofa;
- documentados o pipeline legal de OBJ/DAE/SH3F para GLB, limites de desempenho,
  compatibilidade e inclusao futura de ativos.

### Garantias

- nenhuma parte proprietaria do Sweet Home 3D foi copiada ou extraida;
- ativos sem modelo detalhado continuam funcionais por geometria procedural;
- teste automatizado bloqueia IDs duplicados, metadados legais incompletos,
  dimensoes invalidas e caminhos de modelo inexistentes.

## 2026-08-11 - Acesso remoto no card da maquina

### Interface

- o botao de acesso remoto foi reposicionado no rodape do card, entre o
  indicador de disco e a seta de perifericos;
- maquinas gerenciadas pelo agente mantem o icone de monitor visivel nesse
  local mesmo quando o recurso esta indisponivel;
- quando desabilitado, o botao informa o motivo no tooltip sem alterar o
  alinhamento das demais acoes do card.

### Validacoes

- lint e build de producao aprovados;
- `git diff --check` aprovado.

## 2026-08-11 - Dimensionamento dos cards e acoes do inventario

### Interface

- a largura minima dos cards de maquina passou de 184 para 220 pixels para
  preservar o rodape mesmo quando todas as acoes estao disponiveis;
- os botoes de acesso remoto, perifericos e informacoes agora compartilham a
  mesma caixa de 26 por 26 pixels;
- o icone de acesso remoto foi reduzido para acompanhar a escala visual dos
  demais controles do card.

### Validacoes

- lint e build de producao aprovados;
- teste E2E aprovado em viewport de 948 por 746 pixels, verificando largura
  minima, ausencia de overflow e igualdade entre os botoes do rodape;
- `git diff --check` aprovado.

## 2026-08-13 - Resumo gerencial do dashboard

### Backend

- criado `infrastructureHealth.js`, funcao pura que calcula uma nota de 0 a
  100 a partir de sinais reais (ativos offline, alertas criticos, OS
  vencidas, disco/CPU/memoria criticos, ativos sem contato recente,
  reincidencia), com teto de deducao por fator e classificacao em quatro
  faixas;
- criado `dashboardService.js`, que reaproveita `monitoringService`,
  `alertService` e `serviceOrderService` para montar visao geral, ativos,
  ordens de servico e visao Business em um unico resumo;
- novo endpoint `GET /api/dashboard/summary?period=...`, protegido por
  `dashboard.view`, com `period` validado contra allowlist e fallback seguro;
- a metrica de OS vencidas permanece explicitamente indisponivel (nunca
  zerada nem oculta) porque o schema ainda nao persiste prazo/SLA — a nota de
  saude tambem nunca penaliza esse fator ausente;
- a visao Business so aparece com o sistema em modo Business e com OS
  vinculadas a um ambiente; sem isso, a API devolve uma mensagem explicita em
  vez de simular clientes.

### Interface

- a view do dashboard foi extraida de `App.jsx` para
  `components/dashboard/DashboardPage.jsx`, preservando o bloco original
  (cards, busca, tabela, historico) sem alteracao visual;
- adicionados KPIs de saude, graficos de distribuicao e tendencia, rankings
  operacionais (maquinas problematicas, sem contato, OS mais antigas,
  tecnicos com mais OS resolvidas) e cartao de visao Business, todos com
  estados de carregamento, vazio e erro;
- filtro de periodo (`hoje`, `7d`, `15d`, `30d`, `90d`) recalcula o resumo no
  backend; atualizacao automatica a cada 60s pausa quando a aba fica em
  segundo plano;
- corrigidos dois bugs visuais preexistentes descobertos durante o trabalho:
  a classe `.sr-only` nunca tinha sido definida (textos para leitor de tela
  ficavam visiveis) e `.spin`/`@keyframes spin` so existiam dentro de
  `.cloud-admin-panel` (icones de atualizacao em outras telas nunca giravam).

### Correcao: graficos do dashboard renderizando em branco

- os graficos de OS por status, OS por prioridade e tendencia de OS abertas
  apareciam como uma area em branco (sem erro, sem `recharts-wrapper`, sem
  SVG), apesar do `ResponsiveContainer` medir corretamente o container;
- causa: `ResponsiveContainer` clona o filho direto e injeta `width`/`height`
  medidos nele; os componentes auxiliares `SimpleBarChart`/`SimpleTrendChart`
  nao repassavam essas props para o `BarChart`/`AreaChart` real, que ficava
  sem tamanho valido e nao renderizava nada;
- corrigido repassando `...responsiveProps` do wrapper para o componente do
  recharts; validado no build de producao (`vite preview`), nao apenas no
  servidor de desenvolvimento.

### Validacoes

- `npm run lint`, `npm run check:architecture`, `npm run test --workspace
  server` (213 testes), `npm run test:integration --workspace server`
  (14 testes, incluindo o novo endpoint), `npm run build` e
  `npx playwright test` (8 testes, incluindo 3 novos para o dashboard)
  aprovados;
- verificacao visual manual no build de producao, incluindo layout mobile
  (375px), confirmando que os cards de KPI empilham em uma coluna abaixo de
  520px;
- `git diff --check` aprovado.

## 2026-08-14 - Isolamento de falhas por modulo, polish do dashboard e auditoria de codigo

### Investigacao: Inventario e Ordens de Servico "nao abrindo"

- reproduzido exaustivamente sem sucesso: local, preview e producao,
  conta admin e duas contas de demonstracao com permissoes limitadas,
  abertura de ficha de maquina e de OS — tudo funcionou em todo teste;
- causa mais provavel: efeito colateral transitorio de multiplos deploys
  consecutivos no mesmo branch durante a mesma janela de teste (um chunk
  lazy-load pode ficar temporariamente invalido entre um deploy e outro);
  ja existe recuperacao automatica para esse caso (`runtimeRecovery.js`);
- reforco de qualquer forma: cada modulo principal (Dashboard, Avisos,
  Inventario, Ordens de Servico) ganhou seu proprio `ViewErrorBoundary` em
  vez de depender so do `AppErrorBoundary` global — uma falha de
  renderizacao num modulo nao derruba mais o app inteiro.

### Polish visual do dashboard

- gauge circular (SVG) na saude da infraestrutura, com cor por
  classificacao, no lugar do numero solto;
- cards de KPI com borda de destaque e badge de icone por tom
  (ok/warning/danger/muted), elevacao sutil no hover;
- painel de acoes rapidas (Nova OS, Ver Inventario, Ver Avisos,
  Configuracoes gerais), item pendente desde a entrega anterior do
  dashboard.

### Auditoria de codigo

- varredura dedicada em seguranca, qualidade e cobertura de testes
  (detalhes em `docs/AUDITORIA-BETA-PROFISSIONAL.md`);
- corrigido: `isAllowedVercelOrigin()` confiava em qualquer origem
  terminando em `.vercel.app` (dominio publico e compartilhado) tanto para
  CORS quanto para a verificacao de origem do CSRF — um site de terceiros
  em outro projeto Vercel conseguia passar pelas duas checagens e usar o
  cookie de sessao do usuario; agora exige igualdade exata com o dominio de
  producao do proprio projeto;
- removido componente morto `InventoryVisualMapView.jsx` (1176 linhas, sem
  nenhuma referencia);
- registrado sem corrigir (fora do escopo desta entrega): rate limit em
  memoria e mais fraco em deploy serverless do que os testes locais
  sugerem; duas queries N+1 em `preventiveAutomationRepository.js`; rotas de
  dado de referencia sem permissao especifica na leitura; falta teste de
  integracao direto para `/api/service-orders`.

### Consolidacao e deploy

- push do trabalho pendente de `feature/remote-assistance-functional-v2`
  (relay Redis) e `feature/dashboard-professional-overview`, ambos
  mesclados em `main` (merge limpo, um unico conflito trivial em texto de
  documentacao);
- adicionado `remoteAssistanceRelay` no corpo de `/api/health` (`"memory"`
  ou `"redis"`) para confirmar em producao, sem acesso a logs do processo,
  se o relay esta usando o backend compartilhado necessario no Vercel.

### Validacoes

- `npm run lint`, `npm run check:architecture` (299 arquivos),
  `npm run test --workspace server` (248 aprovados, 1 ignorado),
  `npm run test:integration --workspace server` (16 aprovados, 1 ignorado),
  `npm run build` e `npx playwright test` (9 aprovados) — todos verdes apos
  o merge e apos cada correcao subsequente;
- `git diff --check` aprovado;
- corrigida tambem uma vulnerabilidade alta em dependencia transitiva
  (`nanoid` via vite/postcss) com `npm audit fix`, sem mudanca de major
  version.

### Redis conectado em producao

- apos o deploy, o usuario criou e conectou um banco Upstash Redis ao
  projeto pela integracao nativa da Vercel (Storage);
- variaveis de ambiente novas de uma integracao so sao vistas por funcoes
  serverless a partir do proximo deploy — foi necessario um deploy adicional
  (commit vazio) para a API passar a enxergar `UPSTASH_REDIS_REST_URL`/
  `TOKEN`;
- confirmado via `GET /api/health`: `remoteAssistanceRelay` mudou de
  `"memory"` para `"redis"` em producao, sem nenhum erro ou aviso nos logs
  de runtime da Vercel nos 10 minutos seguintes ao deploy. A assistencia
  remota agora tem o backend compartilhado necessario para funcionar entre
  instancias serverless distintas.

## 2026-08-14 - Instalador com 4 opcoes claras e chat na assistencia remota

### Instalador Windows

- reestruturado `installers/windows-collector/ITGuardianCollector.iss` para
  mostrar uma unica tela com 4 opcoes explicitas ao abrir (Instalar, Reparar,
  Trocar chave, Desinstalar), substituindo o fluxo anterior que so
  distinguia instalar/reparar implicitamente pela presenca de configuracao
  existente;
- opcao Desinstalar aciona o `unins000.exe` ja gerado pelo proprio Inno
  Setup (com confirmacao antes) e fecha o instalador (`Abort`), sem duplicar
  nenhuma logica do desinstalador existente;
- Reparar e Trocar chave reaproveitam 100% da logica de instalacao/ativacao
  ja testada — a mudanca ficou inteiramente no roteamento do assistente
  (Pascal Script), nenhum script de finalizacao ou desinstalacao precisou
  mudar;
- validado com compilacao real via `ISCC.exe` antes do commit.

### Chat na assistencia remota

- pedido do usuario: alem do instalador, adicionar um chat de texto entre
  tecnico e usuario local durante a sessao de assistencia remota;
- decisao de arquitetura: o chat usa o mesmo relay efemero do quadro de
  tela e da fila de comandos (nunca o banco) — `RPUSH`/`LTRIM` atomico para
  escrita (ate 200 mensagens), leitura nao-destrutiva via `LRANGE` (ao
  contrario dos comandos de input, uma mensagem de chat precisa continuar
  visivel para os dois lados, nao ser consumida uma unica vez);
- decisao deliberada de nao usar cursor por posicao para o poll incremental:
  como o `LTRIM` desloca indices ao podar o historico, cada poll devolve a
  lista completa (ja limitada a 200) e o cliente deduplica pelo `id` de cada
  mensagem — mais simples e correto do que manter um cursor que ficaria
  invalido apos o corte;
- decisao de nao criar novos ciclos de poll: as mensagens chegam junto do
  poll que ja existia em cada lado (`GET .../frame` no tecnico, a cada
  `viewerPollMs`; `GET .../commands` no agente, a cada `captureIntervalMs`)
  — evita adicionar uma segunda chamada HTTP periodica ao loop de captura
  do agente C#;
- enviar mensagem exige sessao `active` nos dois lados; permissao usada no
  tecnico e `remote_assistance.view` (chat tratado como comunicacao passiva,
  nao como controle do dispositivo);
- agente Windows: janela de chat propria (`RemoteAssistanceChatForm`),
  aberta pelo botao `Chat` do indicador flutuante existente, alimentada
  pelo mesmo loop de streaming que ja fazia poll de comandos;
- viewer React: painel de chat dentro do modal de assistencia, com balao
  diferenciado por remetente, reaproveitando o polling de frame ja
  existente;
- encerrar/expirar/negar a sessao limpa o historico de chat junto com o
  resto do relay, igual ao quadro de tela — nenhuma mensagem sobrevive ao
  fim da sessao nem chega a tocar o banco.

### Validacoes

- `node --test` em `remoteAssistanceRelay.test.mjs` (15 testes, incluindo
  os novos casos de chat em memoria e Redis simulado) e no teste de
  integracao completo `remote-assistance-lab.test.mjs` (chat nos dois
  sentidos, mensagem vazia rejeitada, historico ausente do banco);
- `npx eslint` limpo nos arquivos de servidor e cliente tocados;
- compilacao real do agente Windows via `csc.exe` (mesmos parametros do
  `build-installer.ps1`) para validar as classes e o formulario novos antes
  do commit;
- `npm run build` do cliente concluido sem erros.

