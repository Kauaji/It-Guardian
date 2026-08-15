# Instalador Windows do IT Guardian

Ao abrir o instalador, o usuario ve uma tela unica com 4 opcoes claras:

1. **Instalar o IT Guardian** — primeiro uso neste computador; pede a chave de
   produto e ativa.
2. **Reparar o IT Guardian** — reinstala os arquivos e a tarefa agendada
   preservando a ativacao existente; nao pede chave.
3. **Trocar a chave de produto** — reativa este computador com uma chave
   diferente (por exemplo, apos mudar de organizacao).
4. **Desinstalar o IT Guardian** — confirma e aciona o desinstalador existente
   (`unins000.exe`), depois fecha o instalador.

As opcoes 2 a 4 exigem uma instalacao existente; se nenhuma for encontrada, o
instalador avisa e pede para escolher "Instalar". A URL da API do IT Guardian
e incorporada durante o build, e a chave e enviada diretamente ao endpoint
HTTPS de ativacao sem ser gravada em arquivo ou log. O instalador configura
somente o coletor nativo e nao baixa agentes externos.

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

### Assinatura de codigo (Authenticode)

Desligada por padrao — sem certificado configurado, o build funciona
exatamente como sempre funcionou (executaveis nao assinados). Quando houver
um certificado, ligue via variaveis de ambiente antes de rodar o build,
sem nenhuma mudanca de codigo:

```powershell
$env:IT_GUARDIAN_CODE_SIGN_PFX = "C:\caminho\certificado.pfx"
$env:IT_GUARDIAN_CODE_SIGN_PFX_PASSWORD = "senha-do-pfx"
npm run installer:windows
```

Para certificado em token/HSM ja instalado no repositorio de certificados do
Windows (comum em certificados EV), use o thumbprint em vez do arquivo:

```powershell
$env:IT_GUARDIAN_CODE_SIGN_THUMBPRINT = "AB12CD34..."
npm run installer:windows
```

Exige o `signtool.exe` do Windows SDK (procurado automaticamente em
`Windows Kits\10\bin`; defina `SIGNTOOL_PATH` para apontar direto se
necessario). O carimbo de tempo usa `http://timestamp.digicert.com` por
padrao, configuravel via `IT_GUARDIAN_CODE_SIGN_TIMESTAMP_URL`. Os três
executaveis (`ITGuardian.exe`, `ITGuardian-Uninstaller.exe` e o instalador
final) sao assinados quando um certificado esta configurado.

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
