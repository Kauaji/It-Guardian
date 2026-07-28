# IT Guardian Agent para Windows

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
Ele pede somente a chave de produto, cria o enrollment automaticamente e
instala a tarefa `IT Guardian Cloud Collector`.

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

Execute como administrador:

```powershell
& "$env:ProgramData\ITGuardianAgent\Uninstall-Agent.ps1"
```

O script para e remove a tarefa, configuracao, script e logs locais. O registro
historico no servidor e preservado. Revogue tambem o enrollment no servidor caso
o token nao deva mais ser aceito.

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
