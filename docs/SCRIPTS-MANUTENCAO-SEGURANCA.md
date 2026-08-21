# Scripts de manutencao: seguranca e escopo

> Execucao real e desligada por padrao (`ENABLE_REMOTE_SCRIPT_EXECUTION=false`
> no servidor, `enableRemoteScriptExecution: false` no `config.json` do
> agente). Com as duas flags ligadas e um agente ativo na maquina, os scripts
> cadastrados sao entregues de verdade e o resultado volta auditado. Com
> qualquer uma delas desligada, o sistema permanece em modo de simulacao e
> registro.

## Objetivo

O IT Guardian cadastra, analisa, recomenda, agenda e audita scripts de
manutencao (BAT, CMD, PowerShell). Nao existe campo de comando livre: um
tecnico so pode disparar um script que ja esteja no catalogo, previamente
cadastrado e validado por um administrador. Nao existe upload de `.bat` por
usuarios finais, nem execucao invisivel — toda execucao real fica registrada
no historico da Ordem de Servico ou do Aviso, no prontuario tecnico do ativo e
nos logs de auditoria.

## Pontos de disparo

A execucao real do mesmo catalogo de scripts pode ser disparada a partir de
dois lugares da aplicacao, ambos reaproveitando a mesma fila (`agent_script_
jobs`) e o mesmo agente Windows:

- **Avisos (Central de Alertas)** — a partir de uma sugestao de OS pendente,
  `POST /api/service-order-suggestions/:id/scripts/:scriptId/use`
  (`scripts.use_from_alert`). O enfileiramento e a conclusao comentam
  automaticamente no timeline do proprio aviso.
- **Ordens de Servico** — na aba "Scripts" de uma OS com ativo vinculado,
  `POST /api/service-orders/:id/scripts/:scriptId/use`
  (`service_orders.run_scripts`). Diferente do fluxo de Avisos, este caminho
  nao usa a heuristica de "observar se o alerta se resolve sozinho"
  (`script_validation_runs`): a conclusao chega diretamente do agente e fica
  vinculada a propria OS (`script_execution_logs.service_order_id`).

Em ambos os casos o usuario ve, antes de confirmar: nome do script, tipo,
nivel de risco, maquina alvo, timeout, se exige administrador/usuario logado,
e o aviso de que a execucao fica registrada em auditoria. Scripts de risco
alto ou critico exigem uma confirmacao extra explicita.

## Tipos e fluxo

- tipos executaveis no coletor: BAT, CMD e PowerShell;
- Shell e Outro podem permanecer cadastrados, mas nao sao entregues ao
  Windows;
- sugestoes, preventivas, automatizacoes e OS mantem registro/simulacao
  quando qualquer uma das flags de execucao real esta desligada;
- o heartbeat autenticado entrega no maximo um trabalho pendente para a
  propria maquina;
- o coletor devolve status, saida limitada e erro;
- resultado, auditoria e historico da maquina/OS/aviso sao atualizados.

## Bloqueio rigido de conteudo perigoso

Alem da classificacao consultiva de risco (`analyzeMaintenanceScriptContent`,
que so sugere um nivel e nunca bloqueia sozinha), todo cadastro ou edicao de
script passa por `assertScriptContentIsSafe`
(`server/src/repositories/maintenanceScriptRepository.js`), que **recusa
salvar** o script (`400`, antes de qualquer gravacao) se o conteudo bater com
um destes padroes — a lista e fixa, nao configuravel pela UI:

- `format`, `diskpart`, `cipher /w` — apagamento/particionamento de disco;
- `del /s /q c:`, `rd /s /q c:` — exclusao recursiva da unidade C:;
- `net user ... /add`, `net localgroup administrators ... /add` — criacao de
  usuario ou elevacao para administradores;
- `reg add HKLM...\Run` — persistencia via chave de registro;
- `schtasks /create` — criacao de tarefa agendada (bloqueado por completo,
  nao apenas por padrao suspeito);
- `Invoke-WebRequest` seguido de `Start-Process` na mesma linha — download
  seguido de execucao;
- `curl`/`wget` baixando um `.exe`, `certutil -urlcache` — download de
  executavel externo, inclusive disfarcado;
- `vssadmin delete shadows` — exclusao de copias de sombra (dificulta
  recuperacao apos incidente);
- `bcdedit` — alteracao de configuracao de boot;
- `takeown`/`icacls` em `system32` — alteracao de permissoes de sistema;
- `taskkill`/`sc stop` combinado com um nome de antivirus conhecido
  (Defender, MsMpEng, avp, McAfee, Symantec, Avast, Kaspersky, Sophos) —
  encerramento de protecao;
- `Set-MpPreference`, `DisableRealtimeMonitoring` — desativacao do Windows
  Defender.

Esses padroes cobrem os itens explicitamente proibidos no escopo do recurso:
nao existe caminho para UAC bypass, keylogger, desativacao de antivirus/
firewall, download-e-execucao de binario externo ou persistencia maliciosa
via este catalogo — mesmo que alguem tente cadastrar isso, o servidor recusa
antes de gravar. Testes unitarios cobrem cada padrao individualmente e uma
lista de scripts seguros que **nao** devem ser bloqueados (ver
`server/src/repositories/maintenanceScriptRepository.test.mjs`).

## Limites de seguranca

- script precisa existir no cadastro, estar ativo e vinculado ao trabalho;
- **conteudo do trabalho e pinado por hash SHA-256 no momento do
  enfileiramento**: ao entregar o trabalho pelo heartbeat, o servidor
  recalcula o hash do conteudo atual em `maintenance_scripts` e recusa a
  entrega (marca o trabalho como falho, sem enviar nada ao agente) se o
  script foi editado ou desativado nesse intervalo;
- **controle duplo para scripts de risco alto/critico**, em duas camadas
  independentes:
  1. identidade — quem enfileira a execucao de um script `high`/`critical`
     nao pode ser a mesma pessoa que cadastrou ou editou o conteudo por
     ultimo (`content_updated_by`); recusado com
     `403 SCRIPT_EXECUTION_REQUIRES_SECOND_REVIEWER`;
  2. permissao — a pessoa que enfileira precisa ter a permissao
     `scripts.approve_high_risk`, checada na camada de servico antes mesmo
     de chegar na checagem de identidade. Essa permissao **nao** e concedida
     por padrao a nenhum papel (nem `operator`) — precisa ser atribuida
     explicitamente a quem de fato tem autoridade para aprovar execucoes de
     risco elevado. Isso reduz o dano de uma unica conta comprometida: ela
     pode cadastrar um script malicioso, mas nao pode sozinha aprova-lo e
     tambem envia-lo para execucao — precisam ser duas contas distintas,
     e uma delas precisa ter a permissao de aprovacao;
- token Bearer identifica enrollment e maquina;
- executaveis do Windows sao definidos pelo coletor;
- `UseShellExecute=false`, `CreateNoWindow=true`;
- timeout limitado entre 15 e 600 segundos;
- saida combinada limitada a 64 KiB;
- requisitos de administrador e usuario logado sao validados antes de rodar;
- arquivo temporario tem nome aleatorio e e removido ao final (`finally`);
- nao ha terminal interativo, WinRM, SSH, PsExec ou download de codigo;
- `eval`, `new Function`, `shell: true` e criacao dinamica de ScriptBlock nao
  sao usados;
- sem execucao sem agente ativo: `queueAgentScriptJob` recusa (`409`) se a
  maquina nao tiver um `agent_enrollment` ativo;
- sem execucao invisivel: o agente Windows registra no log local o
  recebimento do trabalho (id/script/tipo), o inicio, o fim (status/exit
  code/timeout) e qualquer erro — nunca o conteudo do script.

## Analise e confirmacao

A analise de texto e heuristica (`analyzeMaintenanceScriptContent`) e apenas
consultiva — sugere um nivel de risco, mas nunca decide sozinha se o script
pode ser salvo ou executado. Quem decide isso e o bloqueio rigido de
conteudo (acima) no cadastro, e a confirmacao explicita do usuario mais o
controle duplo (para risco alto/critico) no momento de enfileirar. O resumo
deve deixar claro que analisar ou cadastrar nao executa o conteudo.

## Persistencia

- `maintenance_scripts`: definicao, metadados e `content_updated_by` (usado
  pelo controle duplo);
- `script_execution_logs`: intencao, estado e resultado — ja tem colunas
  diretas para `service_order_id`, `alert_id` e `suggestion_id`;
- `agent_script_jobs`: fila por maquina, script e origem operacional
  (`execution_log_id`, `validation_id`, `automation_run_id`);
- `script_validation_runs`: heuristica especifica do fluxo de Avisos
  ("observar se o alerta se resolve sozinho apos o script"); nao e usada
  pelo fluxo de OS, que depende diretamente da conclusao reportada pelo
  agente;
- historico da maquina (Prontuario Tecnico) e da OS: evento consultavel;
- auditoria: usuario, origem, maquina, script, datas e resultado;
- comentarios no aviso: o fluxo de Avisos registra um comentario no proprio
  alerta ao enfileirar e ao concluir (nunca em reenvios idempotentes).

## Endpoints do coletor

O heartbeat autenticado (`POST /api/agents/heartbeat`) pode devolver um
trabalho (`job`) na resposta. O resultado e enviado para
`POST /api/agents/jobs/:id/result`, autenticado pelo mesmo token do
enrollment. Rotas administrativas de cadastro nao aceitam comando arbitrario
nem caminho de executavel — apenas o conteudo cadastrado no catalogo.

## Configuracao das tres flags

A execucao real exige as tres estarem alinhadas; qualquer uma desligada
mantem o sistema em simulacao:

1. `ENABLE_REMOTE_SCRIPT_EXECUTION=true` no ambiente do servidor.
2. `"enableRemoteScriptExecution": true` no `config.json` do agente Windows
   da maquina alvo.
3. O botao de execucao real no navegador reflete o estado real do servidor
   (via `GET /api/system-settings`, buscado no carregamento do app) — nao
   depende de rebuild do cliente. `VITE_ENABLE_REMOTE_SCRIPT_EXECUTION`
   continua existindo como fallback apenas para antes do primeiro
   carregamento das configuracoes.

## Diagnostico visual de bloqueio

Antes de executar um script (aba Scripts da OS e popover de scripts nos
Avisos), a interface mostra um checklist itemizado — nao mais uma unica
frase — buscado sob demanda em
`POST /api/maintenance-scripts/execution-diagnosis` (permissao
`scripts.view`, so leitura, nunca enfileira nada):

- **Servidor habilitado**: `ENABLE_REMOTE_SCRIPT_EXECUTION` calculado ao
  vivo.
- **Agente registrado**: a maquina tem um `agent_enrollment` ativo.
- **Agente com contato recente**: `last_seen_at` dentro da janela de
  frescor (3x o intervalo do heartbeat, minimo 10 minutos — mesma formula
  usada pela Assistencia Remota, agora tambem em
  `server/src/lib/agentFreshness.js` para o lado do servidor).
- **Coletor local permite execucao remota**: sempre aparece como "nao e
  possivel confirmar remotamente" — o servidor genuinamente nao recebe o
  valor de `enableRemoteScriptExecution` do `config.json` no heartbeat
  hoje, e mostrar isso como certeza seria enganoso. Esse e exatamente o
  cenario que a correcao do agente Windows abaixo cobre.
- **Permissao do usuario**: a permissao base do contexto
  (`service_orders.run_scripts` ou `scripts.use_from_alert`).
- Quando um script especifico esta selecionado, tambem: script ativo,
  tipo permitido, e — para risco alto/critico — se o controle duplo
  (identidade + `scripts.approve_high_risk`) esta satisfeito.

O botao de executar continua desabilitando instantaneamente com a logica
sincrona ja existente no cliente (sem esperar essa chamada de rede) — o
diagnostico e uma explicacao mais rica, nao o unico portao.

### Job preso em "claimed" (corrigido)

Antes desta rodada, se o coletor local recusasse um trabalho ja
entregue no heartbeat (por ter `enableRemoteScriptExecution: false`
localmente, mesmo com o servidor permitindo), o agente so registrava um
aviso no log e **nunca reportava o resultado** — o trabalho ficava em
`claimed` para sempre, sem aparecer como falho em lugar nenhum.
Corrigido: o agente agora reporta o trabalho como `failed` (com o motivo
exato no log de erro) para `/api/agents/jobs/:id/result` nesse caso,
usando o mesmo endpoint que ja usa para reportar sucesso/falha real.

## Botao de emergencia

Para desligar a execucao real imediatamente, em qualquer ordem:

1. **Servidor**: `ENABLE_REMOTE_SCRIPT_EXECUTION=false` e fazer o
   redeploy — nenhum trabalho novo e enfileirado a partir desse momento
   (`assertRemoteScriptExecutionEnabled` recusa com `503`), e o
   heartbeat passa a devolver `remoteScriptExecutionEnabled: false`.
2. **Agente**: `"enableRemoteScriptExecution": false` no `config.json`
   de cada maquina e reiniciar o servico/tarefa do coletor — mesmo que o
   servidor ainda esteja com a flag ligada, o agente nao executa nada
   localmente.
3. Nenhuma das duas acoes exige reverter codigo ou fazer rollback — sao
   apenas as mesmas duas flags que ja controlam a funcionalidade em
   condicoes normais.

## Scripts seguros de exemplo (para copiar e colar)

Nenhum script e semeado automaticamente no catalogo — mesmo scripts
considerados seguros devem ser cadastrados deliberadamente por um
administrador, que passa pela validacao de conteudo normal. Os exemplos
abaixo sao um ponto de partida:

- **Diagnostico basico (CMD/BAT)**:
  ```
  echo Teste IT Guardian
  hostname
  whoami
  ipconfig
  ```
- **Verificacao de disco (CMD/BAT)**:
  ```
  echo Verificacao de disco
  wmic logicaldisk get caption,freespace,size
  ```
- **Limpar cache de DNS (CMD/BAT)**:
  ```
  echo Limpando cache DNS
  ipconfig /flushdns
  ```
- **Diagnostico de rede (PowerShell)**: `ipconfig /all`
- **Renovar IP e DNS (PowerShell)**: `ipconfig /release` seguido de
  `ipconfig /renew` e `ipconfig /flushdns`
- **Limpar temporarios (PowerShell)**:
  `Remove-Item -Path "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue`
- **Reiniciar o spooler de impressao (PowerShell)**:
  `Restart-Service -Name Spooler -Force`
- **Listar servicos parados (PowerShell)**:
  `Get-Service | Where-Object { $_.Status -eq 'Stopped' }`
- **Verificar espaco em disco (PowerShell)**:
  `Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, FreeSpace, Size`

## Roteiro de teste manual do agente Windows

O agente (`agent/windows/ITGuardian.Windows.cs`) e C# compilado para
`.exe` — nao ha como automatizar sua execucao real neste repositorio. Para
validar manualmente:

1. Compile com `installers/windows-collector/build-installer.ps1` — no
   assistente, marque "Habilitar execucao real de scripts nesta maquina"
   (ou gere silenciosamente com `/EnableRemoteScriptExecution=1` na linha
   de comando do instalador) — e instale numa maquina de teste. Se ja
   tiver instalado sem marcar essa opcao, edite `enableRemoteScriptExecution:
   true` direto no `config.json` e reinicie o servico do agente.
2. No servidor, ligue `ENABLE_REMOTE_SCRIPT_EXECUTION=true` e faca o
   redeploy.
3. Cadastre um script de baixo risco (ex.: `ipconfig /all`) no catalogo.
4. Abra uma OS com essa maquina vinculada (ou uma sugestao de Aviso gerada
   para ela), va na aba/menu de Scripts — confirme que o painel de
   diagnostico mostra todos os itens como disponiveis, exceto "coletor
   local" (sempre neutro) — e confirme a execucao.
5. Aguarde o proximo heartbeat (ou force um manualmente) — o agente deve
   receber o trabalho, executa-lo sem abrir janela visivel, e reportar o
   resultado.
6. Confira: a atividade da OS/Aviso mostra o status `succeeded` com a saida
   esperada; o log local do agente (`WriteLog`) mostra "execucao remota
   habilitada no coletor", "servidor informou remoteScriptExecutionEnabled",
   "trabalho recebido", inicio e fim, sem o conteudo do script; o
   Prontuario Tecnico do ativo e os logs de auditoria do servidor mostram
   o evento.
7. Repita com um script que force falha (`exit 1`) e um timeout curto para
   confirmar os estados `failed` e `timed_out`.
8. Desligue `enableRemoteScriptExecution` so no `config.json` (deixando o
   servidor ligado) e enfileire outro trabalho — confirme que o agente
   reporta `failed` com uma mensagem clara de recusa, em vez de deixar o
   trabalho preso em `claimed` indefinidamente.

## Checklist

- [x] Execucao real desabilitada por padrao no backend, frontend e coletor;
      liga-se com as tres flags explicitas em conjunto.
- [x] Fila persistente e idempotente.
- [x] Trabalho vinculado a maquina e enrollment; recusado sem agente ativo.
- [x] Tipos executaveis em lista fechada (BAT, CMD, PowerShell).
- [x] Executaveis fixos e sem shell implicito.
- [x] Timeout e limite de saida.
- [x] Resultado, auditoria e historico (OS, Aviso e Prontuario Tecnico).
- [x] Conteudo do trabalho pinado por hash contra o cadastro aprovado; edicao
      ou desativacao entre o enfileiramento e a entrega bloqueia o trabalho.
- [x] Bloqueio rigido de padroes de conteudo destrutivo/evasivo no cadastro
      (nao apenas classificacao consultiva de risco).
- [x] Controle duplo por identidade e por permissao explicita
      (`scripts.approve_high_risk`) para risco alto/critico.
- [x] Disparo a partir de Avisos e de Ordens de Servico, sem campo de
      comando livre e sem upload de `.bat`.
- [x] Logging estruturado no agente Windows (recebido/inicio/fim/timeout/
      erro), nunca o conteudo do script.
- [x] Testes automatizados: unidade (bloqueio de conteudo), integracao
      (fila, permissoes, flags, historico) sem executar BAT/CMD/PowerShell
      operacional de verdade.
- [x] Diagnostico visual itemizado (servidor/agente/permissao/risco) nas
      duas telas de disparo, sem substituir o gate sincrono existente.
- [x] Agente reporta falha explicita (nunca deixa preso em `claimed`)
      quando recusa um trabalho por flag local desligada.
- [x] Instalador permite habilitar `enableRemoteScriptExecution` no
      assistente ou via parametro silencioso — sem mudar o padrao seguro
      (desligado).
- [ ] Assinatura criptografica de scripts antes de distribuicao publica.
- [ ] Homologacao em maquina virtual limpa com um script de baixo risco.
