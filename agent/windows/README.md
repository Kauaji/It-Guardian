# IT Guardian Agent para Windows

Agente PowerShell do beta funcional. Ele envia inventario basico e heartbeat
para o IT Guardian, sem executar comandos remotos ou coletar arquivos pessoais.

## Requisitos

- Windows 10/11 ou Windows Server;
- PowerShell 5.1 ou superior;
- acesso HTTP/HTTPS ao servidor IT Guardian;
- token de enrollment criado por um administrador;
- PowerShell como administrador somente para instalar ou desinstalar.

## Testar sem instalar

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\test-heartbeat.ps1 -ServerUrl "http://IP-DO-SERVIDOR" -Token "itg_TOKEN"
```

O teste consulta `/health` e envia um heartbeat diagnostico. O token e usado
somente no cabecalho `Authorization` e nao e exibido.

## Instalar

```powershell
.\Install-Agent.ps1 -ServerUrl "http://IP-DO-SERVIDOR" -AgentToken "itg_TOKEN" -IntervalSeconds 300 -MachineAlias "PC Laboratorio"
```

O instalador:

- cria `C:\ProgramData\ITGuardianAgent`;
- grava a configuracao com ACL restrita;
- registra a tarefa `IT Guardian Agent` como `SYSTEM`;
- inicia o agente e envia heartbeat a cada 60 segundos (padrao atual);
- executa um teste imediato;
- grava logs em `C:\ProgramData\ITGuardianAgent\logs\agent.log`.

## Diagnosticar

```powershell
& "$env:ProgramData\ITGuardianAgent\diagnose-agent.ps1"
Get-Content "$env:ProgramData\ITGuardianAgent\logs\agent.log" -Tail 50
```

O diagnostico nao imprime o token.

## Desinstalar

```powershell
.\Uninstall-Agent.ps1
```

O script remove a tarefa e pergunta antes de apagar configuracao e logs. Para
automacao controlada, consulte os parametros com:

```powershell
Get-Help .\Uninstall-Agent.ps1 -Full
```

## Arquivos

- `it-guardian-agent.ps1`: processo principal;
- `Install-Agent.ps1`: instalacao da tarefa;
- `Uninstall-Agent.ps1`: remocao com confirmacao;
- `test-heartbeat.ps1`: teste real sem instalar;
- `diagnose-agent.ps1`: diagnostico da instalacao;
- `Test-Agent.ps1`: testes automatizados locais;
- `config.example.json`: formato de configuracao.

Seguranca e campos coletados: `docs/SEGURANCA-DO-AGENTE.md`.
