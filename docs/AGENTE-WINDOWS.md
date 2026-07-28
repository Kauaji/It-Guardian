# IT Guardian Agent para Windows

## Agentes OCS e Zabbix no instalador

O instalador 1.3.0 tambem distribui os agentes oficiais OCS Inventory e Zabbix
Agent 2. Durante a ativacao, a API devolve automaticamente os servidores
centrais vinculados a chave da organizacao. Os pacotes sao verificados por hash
e assinatura antes do build e novamente antes da instalacao. Os agentes
externos somente sao instalados quando a chave possui a configuracao completa;
o coletor nativo nao depende deles.

O instalador nao cria servidores OCS ou Zabbix dentro do computador monitorado.
Sem uma infraestrutura central real e acessivel, os agentes nao podem enviar
inventario ou metricas.

O agente coleta inventario basico e envia heartbeat HTTP/JSON ao servidor local.
Ele e um script PowerShell visivel, instalado em
`%ProgramData%\ITGuardianAgent` e iniciado por uma tarefa agendada chamada
`IT Guardian Agent`.

## Dados coletados

- identificador estavel da maquina (`MachineGuid`);
- hostname, Windows, versao e arquitetura;
- IP local e MAC da interface ativa;
- modelo de CPU;
- memoria total;
- tamanho e espaco livre do disco do sistema;
- uptime;
- versao do agente e horario da coleta;
- alias, ambiente, grupo e segmento configurados;
- usuario logado somente quando `-IncludeLoggedUser` for solicitado.

O agente nao coleta arquivos, senhas, teclas, tela, historico, geolocalizacao,
lista detalhada de processos ou conteudo pessoal.

## Instalacao cloud por chave de produto

Para novos computadores cloud, use o instalador visual descrito em
[`CLOUD-COLLECTOR-E-LICENCIAMENTO.md`](CLOUD-COLLECTOR-E-LICENCIAMENTO.md).
Ele pede somente a chave de produto, baixa da API os destinos centrais
OCS/Zabbix vinculados a ela, cria o enrollment automaticamente e instala o
executavel nativo `ITGuardian.exe`, a tarefa `IT Guardian Collector`, o
indicador visual da bandeja e, quando configurados, os dois agentes de
monitoramento externos.

Na instalacao cloud, o executavel aparece como `IT Guardian` no Gerenciador de
Tarefas, inicia com o Windows e usa o mesmo icone no programa, na bandeja e no
atalho `Abrir chamado - IT Guardian`. O indicador da bandeja nao possui acoes:
ele serve somente para deixar claro que o IT Guardian esta instalado.

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

O padrao oficial e um heartbeat a cada 300 segundos. Uma maquina fica `offline`
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

Verifique a tarefa:

```powershell
Get-ScheduledTask -TaskName "IT Guardian Agent"
Get-ScheduledTaskInfo -TaskName "IT Guardian Agent"
```

## Desinstalar

Use `Configuracoes > Aplicativos > Aplicativos instalados > IT Guardian >
Desinstalar` ou o atalho `Desinstalar IT Guardian` no menu Iniciar.

O desinstalador para o processo, remove as tarefas, a inicializacao automatica,
os arquivos e os logs locais. OCS Inventory Agent e Zabbix Agent 2 somente sao
removidos quando o marcador local comprova que foram instalados pelo IT
Guardian; instalacoes preexistentes sao preservadas. O historico no servidor
tambem e preservado.

## Configuracao

`config.json` aceita somente:

- `serverUrl`;
- `agentToken`;
- `intervalSeconds`;
- `machineId` opcional;
- `machineAlias`;
- `environment`;
- `group`;
- `segment`;
- `includeLoggedUser`.

O backend rejeita campos adicionais. Nao existe campo para comando, script,
download ou atualizacao remota.
