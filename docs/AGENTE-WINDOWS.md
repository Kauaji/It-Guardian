# IT Guardian Agent para Windows

## Coletor nativo

O instalador comum distribui somente o coletor nativo do IT Guardian. OCS e
Zabbix sao adaptadores avancados do backend para empresas que ja possuem esses
servidores. Seus agentes nao sao baixados nem instalados no computador.

O agente coleta inventario tecnico e envia heartbeat HTTP/JSON ao servidor. A
instalacao cloud usa o executavel nativo `ITGuardian.exe`, instalado em
`%ProgramFiles%\IT Guardian`. Ele roda como `SYSTEM` por uma tarefa agendada e
mantem um indicador visual na bandeja do Windows.

## Dados coletados

- identificador estavel da maquina (`MachineGuid`);
- hostname, Windows, versao e arquitetura;
- IP local e MAC da interface ativa;
- modelo, arquitetura, nucleos e detalhes da CPU;
- memoria total, modulos e saude estimada;
- discos, espaco livre e dados SMART quando o hardware/driver os expoe;
- placa-mae, video, bateria, rede e perifericos Plug and Play;
- softwares instalados em nivel de maquina e nos perfis de usuario carregados;
- Windows e Office, incluindo licenciamento quando o Windows o disponibiliza;
- uptime;
- versao do agente e horario da coleta;
- alias, ambiente, grupo e segmento configurados;
- usuario logado somente quando a configuracao autoriza a coleta.

O agente nao coleta arquivos, senhas, teclas, tela, historico, geolocalizacao,
lista detalhada de processos ou conteudo pessoal.

## Instalacao cloud por chave de produto

Para novos computadores cloud, use o instalador visual descrito em
[`CLOUD-COLLECTOR-E-LICENCIAMENTO.md`](CLOUD-COLLECTOR-E-LICENCIAMENTO.md).
Ele pede somente a chave de produto, cria o enrollment automaticamente e
instala o executavel nativo `ITGuardian.exe`, a tarefa
`IT Guardian Collector` e o indicador visual da bandeja.

Na instalacao cloud, o executavel aparece como `IT Guardian` no Gerenciador de
Tarefas, inicia com o Windows e usa o mesmo icone no programa, na bandeja e no
atalho `Abrir chamado - IT Guardian`. O indicador da bandeja nao possui acoes:
ele serve somente para deixar claro que o IT Guardian esta instalado.

Quando o instalador encontra uma instalacao existente, oferece por padrao
`Reparar ou atualizar`. Esse modo preserva chave, token e identificacao da
maquina, substitui os binarios, recria a tarefa agendada e valida a primeira
comunicacao. A opcao de reativacao permanece disponivel para trocar a chave.

O agente recarrega a configuracao a cada ciclo e usa espera curta baseada no
relogio UTC. Depois de suspender e retomar o Windows, ele volta a enviar o
heartbeat sem precisar ser reinstalado. A tarefa tambem e configurada para
iniciar no boot e no logon, aceitar bateria, iniciar assim que possivel e tentar
novamente em caso de falha.

A instalacao manual abaixo continua sendo o caminho para servidores locais e
laboratorios que administram os enrollments diretamente.

## Instalar

1. Gere um token conforme `docs/INSTALACAO-LOCAL.md`.
2. Copie a pasta `agent\windows` para o computador cliente.
3. Abra PowerShell como administrador.
4. Execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Install-Agent.ps1 -ServerUrl "http://192.168.1.10" -AgentToken "itg_TOKEN" -IntervalSeconds 300 -MachineAlias "Bancada 01" -Environment "Laboratorio"
```

O intervalo aceito vai de 30 a 86400 segundos. O token fica no arquivo local de
configuracao com acesso restrito a `SYSTEM` e administradores. No servidor ele
fica somente em hash.

O padrao oficial e um heartbeat a cada 60 segundos. Uma maquina fica `offline`
depois do periodo configurado em `AGENT_OFFLINE_AFTER_MINUTES` (10 minutos por
padrao), respeitando no minimo tres intervalos do agente.

## Verificar e diagnosticar

Executar uma coleta manual sem instalar:

```powershell
Copy-Item config.example.json config.json
notepad config.json
.\it-guardian-agent.ps1 -Once
```

Teste de conectividade e autenticacao, sem instalar:

```powershell
.\test-heartbeat.ps1 -ServerUrl "http://192.168.1.10" -Token "itg_TOKEN"
```

Diagnostico da instalacao:

```powershell
& "$env:ProgramData\ITGuardianAgent\diagnose-agent.ps1"
```

Logs:

```text
%ProgramData%\ITGuardianAgent\logs\agent.log
```

O log registra versao, `serverUrl`, sucesso, ultimo erro e tempo ate o proximo
envio. O token completo nunca e escrito no log. Erros de rede sao registrados e
o loop continua.

Se uma maquina enviar menos campos que outra, verifique primeiro a versao do
agente, o log, WMI, Agendador de Tarefas, drivers de armazenamento e permissoes
de rede. SMART, temperatura, licencas e alguns dados de memoria dependem do que
o firmware, o driver e o Windows realmente expoem. O instalador valida WMI e o
Agendador e executa o coletor como `SYSTEM`, mas nao cria excecoes de antivirus
nem tenta contornar politicas da empresa.

Verifique a tarefa:

```powershell
Get-ScheduledTask -TaskName "IT Guardian Agent"
Get-ScheduledTaskInfo -TaskName "IT Guardian Agent"
```

## Desinstalar

Use `Configuracoes > Aplicativos > Aplicativos instalados > IT Guardian >
Desinstalar` ou o atalho `Desinstalar IT Guardian` no menu Iniciar.

O desinstalador para o processo, remove as tarefas, a inicializacao automatica,
os arquivos e os logs locais. Por compatibilidade, ele reconhece marcadores de
versoes antigas e nunca remove uma instalacao OCS/Zabbix preexistente. O
historico no servidor e preservado.

## Configuracao

`config.json` aceita somente:

- `serverUrl`;
- `supportUrl`;
- `agentToken`;
- `intervalSeconds`;
- `machineId` opcional;
- `machineAlias`;
- `environment`;
- `group`;
- `segment`;
- `includeLoggedUser`;
- `enableRemoteScriptExecution` (default `false` — ver "Trabalhos de
  manutencao" abaixo e
  [SCRIPTS-MANUTENCAO-SEGURANCA.md](SCRIPTS-MANUTENCAO-SEGURANCA.md));
- `enableRemoteAssistance` (default `false` — ver
  [ASSISTENCIA-REMOTA.md](ASSISTENCIA-REMOTA.md#habilitar-tambem-no-agente-windows-flag-separada-por-maquina)).

O backend rejeita campos adicionais no inventario. Trabalhos de manutencao sao
obtidos por uma fila autenticada separada; nao existe campo de comando no
`config.json`, download arbitrario ou atualizacao remota.

## Trabalhos de manutencao

Sugestoes, preventivas, automatizacoes, Avisos e Ordens de Servico podem
preparar trabalhos `bat`, `cmd` ou `powershell` para uma maquina especifica.
O agente consulta uma fila autenticada, aceita somente esses tipos, aplica
limite de 15 a 600 segundos, limita a saida a 64 KiB e devolve resultado e
log ao servidor. Nenhum trabalho e executado se o agente da maquina estiver
offline.

A execucao real so acontece quando **duas flags batem ao mesmo tempo**: o
servidor (`ENABLE_REMOTE_SCRIPT_EXECUTION=true`) e o coletor local
(`"enableRemoteScriptExecution": true` neste `config.json`). Por padrao as
duas ficam desligadas — o sistema so registra/simula. Para ligar num
computador:

- **No instalador** (`installers/windows-collector/ITGuardianCollector.iss`,
  compilado por `build-installer.ps1`): marque a opcao "Habilitar execucao
  real de scripts nesta maquina" no assistente, ou gere/rode o instalador
  silenciosamente com o parametro `/EnableRemoteScriptExecution=1`. Se essa
  opcao nao aparece (repositorio ou "trocar a chave" preservando uma
  configuracao existente), a flag continua vindo do `config.json` ja
  presente na maquina.
- **Manualmente**: editar `"enableRemoteScriptExecution": true` direto no
  `config.json` instalado e reiniciar o servico/tarefa do coletor.

Detalhes completos (bloqueio de conteudo perigoso, controle duplo,
diagnostico visual de bloqueio, roteiro de teste ponta a ponta) em
[SCRIPTS-MANUTENCAO-SEGURANCA.md](SCRIPTS-MANUTENCAO-SEGURANCA.md).

A fila, o historico e a validacao automatica estao cobertos por testes. Uma
execucao real em uma maquina deve ser feita conscientemente pelo tecnico; a
suite automatizada nao dispara um BAT no computador do desenvolvedor.

## Agente, OCS e Zabbix

O agente do IT Guardian cobre o endpoint: heartbeat, inventario, metricas
atuais, softwares e trabalhos de manutencao aprovados. Ele nao substitui todos
os recursos de plataformas especializadas.

- Zabbix continua indicado para series temporais longas, SNMP, monitoramento de
  rede e servicos, proxies distribuidos, triggers e graficos avancados.
- OCS continua indicado para inventario corporativo normalizado, descoberta de
  rede, historico amplo, distribuicao de pacotes e ecossistema de plugins.

Essas integracoes so dependem de um computador especifico quando seus
servidores estiverem hospedados nele. O IT Guardian cloud e seu banco nao
dependem do computador do tecnico; apenas a coleta e a execucao em cada endpoint
dependem do agente daquele endpoint estar online.

## Atualizacoes

A versao atual possui reparo/upgrade preservando a ativacao, mas ainda nao tem
autoatualizador silencioso. Para atualizar, execute o instalador mais novo e use
`Reparar ou atualizar`. Um autoatualizador seguro futuro deve exigir binarios e
manifesto assinados, verificacao de hash, rollback e canal de versao; ele nao
deve baixar e executar arquivos arbitrarios.

No reparo 1.6.1, o agente tambem renova no servidor o link assinado do atalho
`Abrir chamado - IT Guardian`. Esse link permite que a pagina publica reconheca
automaticamente a maquina instalada quando o usuario escolhe `O problema e na
minha maquina`. O token do link identifica somente a ativacao e nao contem a
chave de produto nem o token operacional do agente.
