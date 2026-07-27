# Instalador Windows do servidor

Execute o PowerShell como administrador na raiz do repositorio:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\installers\windows\Install-ITGuardianServer.ps1
```

O instalador reutiliza o perfil Docker descrito em
[`docs/INSTALACAO-LOCAL.md`](../../docs/INSTALACAO-LOCAL.md). Ele nao apaga dados
existentes. A desinstalacao preserva os dados por padrao e so remove o volume
quando `-RemoveData` for informado.

Atalhos operacionais:

```powershell
.\installers\windows\start-server.ps1
.\installers\windows\diagnose-server.ps1
.\installers\windows\backup-server.ps1
.\installers\windows\restore-server.ps1 -BackupFile .\backups\it-guardian.dump
.\installers\windows\stop-server.ps1
.\installers\windows\reset-local.ps1
```

Restore e reset pedem confirmacao antes de substituir ou remover dados.
