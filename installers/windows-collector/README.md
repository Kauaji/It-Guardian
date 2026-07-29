# Instalador Windows do IT Guardian

O instalador visual solicita somente a chave de produto. A URL da API do
IT Guardian e incorporada durante o build, e a chave e enviada diretamente ao
endpoint HTTPS de ativacao sem ser gravada em arquivo ou log. O instalador
configura somente o coletor nativo e nao baixa agentes externos.

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

- arquivos em `C:\ProgramData\ITGuardian`;
- token derivado salvo em `config.json` com acesso somente a SYSTEM e
  administradores;
- executavel nativo `ITGuardian.exe`, identificado como `IT Guardian` no
  Gerenciador de Tarefas;
- tarefa `IT Guardian Collector` executada como SYSTEM na inicializacao do
  Windows;
- indicador visual do IT Guardian iniciado com a sessao do Windows e exibido na
  bandeja do sistema, sem menu ou comandos remotos;
- primeiro heartbeat validado antes de concluir;
- icone oficial aplicado ao programa, instalador e desinstalador;
- atalho `Abrir chamado - IT Guardian` na area de trabalho com o icone oficial;
- desinstalador registrado em `Aplicativos instalados` e atalho
  `Desinstalar IT Guardian` criado no menu Iniciar;
- logs em `C:\ProgramData\ITGuardian\logs\agent.log`.

O coletor envia inventario e heartbeat e pode consumir trabalhos de manutencao
cadastrados pela fila autenticada. Nao existe terminal remoto, download
arbitrario ou `shell: true`. O indicador da bandeja apenas informa visualmente
que o IT Guardian esta instalado.

O runbook completo de arquitetura, licenciamento, deploy e diagnostico esta em
[`docs/CLOUD-COLLECTOR-E-LICENCIAMENTO.md`](../../docs/CLOUD-COLLECTOR-E-LICENCIAMENTO.md).
