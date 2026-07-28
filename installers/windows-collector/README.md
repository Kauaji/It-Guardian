# Instalador Windows do coletor cloud

O instalador visual solicita somente a chave de produto. A URL da API e
incorporada durante o build, e a chave e enviada diretamente ao endpoint HTTPS
de ativacao sem ser gravada em arquivo ou log.

## Compilar

Instale o Inno Setup 6 e execute, na raiz do repositorio:

```powershell
npm run installer:windows
```

Para outro ambiente:

```powershell
.\installers\windows-collector\build-installer.ps1 `
  -ApiBaseUrl "https://it-guardian-server.vercel.app"
```

O executavel e gerado em `installers/windows-collector/output`.

Antes de distribuir, publique o executavel em um endereco HTTPS e configure
`VITE_COLLECTOR_INSTALLER_URL` no build do frontend. Para uma liberacao publica,
assine o executavel e valide a instalacao e a remocao em uma VM Windows limpa.

## Resultado da instalacao

- arquivos em `C:\ProgramData\ITGuardianCollector`;
- token derivado salvo em `config.json` com acesso somente a SYSTEM e
  administradores;
- tarefa `IT Guardian Cloud Collector` executada como SYSTEM;
- primeiro heartbeat validado antes de concluir;
- atalho `Abrir chamado - IT Guardian` na area de trabalho;
- logs em `C:\ProgramData\ITGuardianCollector\logs\agent.log`.

O coletor apenas envia inventario e heartbeat. Ele nao recebe nem executa
comandos remotos.

O runbook completo de arquitetura, licenciamento, deploy e diagnostico esta em
[`docs/CLOUD-COLLECTOR-E-LICENCIAMENTO.md`](../../docs/CLOUD-COLLECTOR-E-LICENCIAMENTO.md).
