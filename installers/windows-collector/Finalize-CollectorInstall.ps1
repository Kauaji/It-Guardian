[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$InstallDirectory,
  # Chaves PUBLICAS de assinatura (ECDSA P-256, base64 SPKI). So sao gravadas no config.json se o
  # agente ainda NAO tiver uma fixada: uma chave existente nunca e sobrescrita.
  [string]$ReleasePublicKey = "",
  [string]$JobSigningPublicKey = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$taskName = "IT Guardian Collector"
$legacyTaskName = "IT Guardian Cloud Collector"
$resolvedDirectory = [IO.Path]::GetFullPath($InstallDirectory)
$configPath = Join-Path $resolvedDirectory "config.json"
$collectorPath = Join-Path $resolvedDirectory "ITGuardian.exe"
$logDirectory = Join-Path $resolvedDirectory "logs"
$installLogPath = Join-Path $logDirectory "install-finalize.log"
$durableInstallLogPath = Join-Path $env:ProgramData "ITGuardian-install-finalize.log"

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

$logAcl = Get-Acl -LiteralPath $logDirectory
$logUsersSid = New-Object System.Security.Principal.SecurityIdentifier("S-1-5-32-545")
$logRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
  $logUsersSid,
  "Modify",
  "ContainerInherit,ObjectInherit",
  "None",
  "Allow"
)
$logAcl.SetAccessRule($logRule)
Set-Acl -LiteralPath $logDirectory -AclObject $logAcl

function Write-InstallLog {
  param([Parameter(Mandatory = $true)][string]$Message)
  $entry = "{0:o} {1}" -f [DateTime]::UtcNow, $Message
  foreach ($path in @($installLogPath, $durableInstallLogPath)) {
    try {
      Add-Content -LiteralPath $path -Value $entry -Encoding UTF8
    } catch {
      # A copia externa ao diretorio do aplicativo sobrevive ao rollback do Inno Setup.
    }
  }
}

trap {
  Write-InstallLog ("ERRO: {0}`r`n{1}" -f $_.Exception.Message, ($_ | Out-String))
  exit 1
}

Write-InstallLog "Iniciando finalizacao da instalacao."
Write-InstallLog "Permissoes de log preparadas para o coletor e para o icone de bandeja."

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Configuracao do coletor nao encontrada."
}
if (-not (Test-Path -LiteralPath $collectorPath)) {
  throw "Executavel do coletor nao encontrado."
}

$config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $config.serverUrl -or -not $config.agentToken) {
  throw "A configuracao nao contem servidor e token do agente."
}

# --- Chaves de confianca (assinatura) ---------------------------------------
# releasePublicKey: assina o manifesto de atualizacao (privada fora do servidor da API).
# jobSigningPublicKey: assina cada job de script. Sem elas o agente e SEGURO por padrao: ignora
# atualizacoes automaticas e recusa jobs. Formato validado: SPKI DER de P-256 = 91 bytes em base64.
function Test-P256PublicKeyShape {
  param([string]$Value)
  return $Value -match '^MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE[A-Za-z0-9+/]{86}==$'
}
function Set-ConfigKeyIfAbsent {
  param([string]$Name, [string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
  $existing = $config.PSObject.Properties[$Name]
  if ($existing -and -not [string]::IsNullOrWhiteSpace([string]$existing.Value)) {
    Write-InstallLog "Chave $Name ja fixada no config.json; mantida (nunca sobrescrita)."
    return $false
  }
  if (-not (Test-P256PublicKeyShape $Value.Trim())) {
    Write-InstallLog "AVISO: valor recebido para $Name nao e uma chave publica ECDSA P-256 valida; ignorado."
    return $false
  }
  $config | Add-Member -NotePropertyName $Name -NotePropertyValue $Value.Trim() -Force
  Write-InstallLog "Chave $Name gravada no config.json."
  return $true
}
$keysChanged = $false
if (Set-ConfigKeyIfAbsent -Name "releasePublicKey" -Value $ReleasePublicKey) { $keysChanged = $true }
if (Set-ConfigKeyIfAbsent -Name "jobSigningPublicKey" -Value $JobSigningPublicKey) { $keysChanged = $true }
if ($keysChanged) {
  $config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $configPath -Encoding UTF8
}
foreach ($pair in @(@("releasePublicKey", "atualizacoes automaticas"), @("jobSigningPublicKey", "jobs de script"))) {
  $property = $config.PSObject.Properties[$pair[0]]
  if (-not $property -or [string]::IsNullOrWhiteSpace([string]$property.Value)) {
    Write-InstallLog "AVISO: $($pair[0]) nao configurada; $($pair[1]) permanecem BLOQUEADOS (seguro por padrao) ate a chave ser fornecida."
  }
}

try {
  $supportResponse = Invoke-RestMethod `
    -Uri ("{0}/api/agents/support-link" -f $config.serverUrl.TrimEnd('/')) `
    -Headers @{ Authorization = "Bearer $($config.agentToken)" } `
    -Method Get `
    -TimeoutSec 30
  if (-not $supportResponse.supportUrl) {
    throw "O servidor nao retornou o link de suporte."
  }
  $config.supportUrl = [string]$supportResponse.supportUrl
  $config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $configPath -Encoding UTF8
  Write-InstallLog "Link publico identificado renovado."
} catch {
  if (-not $config.supportUrl) {
    throw "Nao foi possivel obter o link identificado de abertura de chamado: $($_.Exception.Message)"
  }
  Write-InstallLog "AVISO: link identificado nao renovado; mantendo configuracao existente. $($_.Exception.Message)"
}

$shortcutPath = Join-Path ([Environment]::GetFolderPath("CommonDesktopDirectory")) "Abrir chamado - IT Guardian.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = [string]$config.supportUrl
$shortcut.WorkingDirectory = $resolvedDirectory
$shortcut.IconLocation = "$collectorPath,0"
$shortcut.Save()
Write-InstallLog "Atalho publico atualizado com a identidade deste computador."
Write-InstallLog "Coletor nativo selecionado; integracoes externas nao fazem parte do instalador comum."

$configAcl = New-Object System.Security.AccessControl.FileSecurity
$configAcl.SetAccessRuleProtection($true, $false)
foreach ($sidValue in @("S-1-5-18", "S-1-5-32-544")) {
  $sid = New-Object System.Security.Principal.SecurityIdentifier($sidValue)
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    $sid,
    "FullControl",
    "Allow"
  )
  $configAcl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $configPath -AclObject $configAcl
Write-InstallLog "ACL da configuracao aplicada."

# state\ guarda o registro anti-replay de jobs (seen-job-ids.txt). Diferente de logs\, NAO e gravavel
# por usuarios comuns: so SYSTEM e Administradores.
$stateDirectory = Join-Path $resolvedDirectory "state"
New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
$stateAcl = New-Object System.Security.AccessControl.DirectorySecurity
$stateAcl.SetAccessRuleProtection($true, $false)
foreach ($sidValue in @("S-1-5-18", "S-1-5-32-544")) {
  $sid = New-Object System.Security.Principal.SecurityIdentifier($sidValue)
  $stateRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    $sid,
    "FullControl",
    "ContainerInherit,ObjectInherit",
    "None",
    "Allow"
  )
  $stateAcl.AddAccessRule($stateRule)
}
Set-Acl -LiteralPath $stateDirectory -AclObject $stateAcl
Write-InstallLog "ACL de state\ (anti-replay de jobs) aplicada."

foreach ($serviceName in @("Schedule", "Winmgmt")) {
  $service = Get-Service -Name $serviceName -ErrorAction Stop
  if ($service.Status -ne "Running") {
    Start-Service -Name $serviceName
    $service.WaitForStatus("Running", [TimeSpan]::FromSeconds(20))
  }
  Write-InstallLog "Servico obrigatorio $serviceName validado."
}

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Stop-ScheduledTask -TaskName $legacyTaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $legacyTaskName -Confirm:$false -ErrorAction SilentlyContinue

Get-CimInstance Win32_Process -Filter "Name = 'ITGuardian.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ExecutablePath -eq $collectorPath } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# --- Identidade de execucao do coletor: SYSTEM ------------------------------
# Uma rodada anterior tentou trocar SYSTEM por uma conta de servico local
# dedicada (sem privilegio de SYSTEM, reducao real de superficie) para as
# leituras que exigem Administrador: dados SMART/saude de disco (namespaces
# WMI root\wmi e root\Microsoft\Windows\Storage) e levantamento de software
# instalado por usuario (enumera HKEY_USERS de todos os perfis carregados).
# Em teste real numa maquina Windows real, tanto Register-ScheduledTask
# quanto schtasks.exe (dois caminhos de codigo distintos do Windows) falharam
# de forma persistente e repetida ao tentar registrar a tarefa sob essa conta
# nova com logon por senha -- "Nao foi feito mapeamento entre os nomes de
# conta e as identificacoes de seguranca" (HRESULT 0x80070534), mesmo apos
# multiplas tentativas com espera crescente (ate 18s) e um reboot completo da
# maquina. Sem acesso administrativo mais profundo (politica de grupo,
# diagnostico do LSA) para identificar a causa exata nessa maquina, a conta
# dedicada nao pode ser confiada para garantir que a instalacao funcione.
# Revertido para SYSTEM (a configuracao usada antes dessa tentativa, ja
# validada em producao) ate a causa ser diagnosticada com acesso adequado --
# funcionar de verdade importa mais agora do que a reducao de superficie.
# SYSTEM nao precisa de senha nem de resolucao de nome via NTLM/LSA (usa o
# SID fixo e universalmente conhecido S-1-5-18), entao nao ha essa classe de
# falha para essa identidade.
$action = New-ScheduledTaskAction `
  -Execute $collectorPath `
  -Argument "--collector --config `"$configPath`""
$triggers = @(
  (New-ScheduledTaskTrigger -AtStartup),
  (New-ScheduledTaskTrigger -AtLogOn)
)
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 999 `
  -RestartInterval ([TimeSpan]::FromMinutes(1)) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal `
  -UserId "SYSTEM" `
  -LogonType ServiceAccount `
  -RunLevel Highest
Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $triggers `
  -Principal $principal `
  -Settings $settings `
  -Description "Mantem o inventario e o heartbeat do IT Guardian ativos." `
  -Force | Out-Null
Write-InstallLog "Tarefa resiliente registrada sob SYSTEM para inicializacao, logon, bateria e reinicio automatico."

New-ItemProperty `
  -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" `
  -Name "IT Guardian" `
  -PropertyType String `
  -Value "`"$collectorPath`" --tray --config `"$configPath`"" `
  -Force | Out-Null

$heartbeatSucceeded = $false
for ($attempt = 1; $attempt -le 3; $attempt++) {
  $heartbeatExitCode = -1
  try {
    $heartbeatProcess = Start-Process `
      -FilePath $collectorPath `
      -ArgumentList @("--collector", "--config", "`"$configPath`"", "--once") `
      -WindowStyle Hidden `
      -Wait `
      -PassThru
    $heartbeatExitCode = $heartbeatProcess.ExitCode
  } catch {
    Write-InstallLog "AVISO: nao foi possivel iniciar o heartbeat na tentativa $attempt. $($_.Exception.Message)"
  }

  if ($heartbeatExitCode -eq 0) {
    $heartbeatSucceeded = $true
    Write-InstallLog "Primeiro heartbeat concluido na tentativa $attempt."
    break
  }

  Write-InstallLog "AVISO: heartbeat inicial falhou na tentativa $attempt com codigo $heartbeatExitCode."
  if ($attempt -lt 3) {
    Start-Sleep -Seconds 3
  }
}

if (-not $heartbeatSucceeded) {
  Write-InstallLog "AVISO: o contato inicial nao foi concluido. A tarefa resiliente continuara tentando sem cancelar a instalacao."
}

try {
  Start-ScheduledTask -TaskName $taskName
} catch {
  Write-InstallLog "AVISO: a tarefa foi registrada, mas nao iniciou imediatamente; o Windows tentara novamente. $($_.Exception.Message)"
}

function Test-TrayRunning {
  $trayProcesses = Get-CimInstance Win32_Process -Filter "Name = 'ITGuardian.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -eq $collectorPath -and $_.CommandLine -like "*--tray*" }
  return @($trayProcesses).Count -gt 0
}

# Uma unica tentativa de Start-Process sem verificacao mascarava o caso mais
# comum de falha: o executavel nao e assinado (sem certificado configurado),
# entao o antivirus/SmartScreen frequentemente faz uma varredura no primeiro
# uso que atrasa (ou some com) a janela/icone sem lancar excecao nenhuma no
# PowerShell -- a tentativa "tinha sucesso" e o icone nunca aparecia mesmo
# assim. Repete com verificacao real do processo antes de desistir e cair no
# proximo logon.
$trayStarted = $false
for ($attempt = 1; $attempt -le 3; $attempt++) {
  try {
    Start-Process -FilePath $collectorPath -ArgumentList @("--tray", "--config", "`"$configPath`"")
  } catch {
    Write-InstallLog "AVISO: tentativa $attempt de lancar o icone de bandeja falhou ao iniciar o processo. $($_.Exception.Message)"
  }
  Start-Sleep -Seconds 3
  if (Test-TrayRunning) {
    $trayStarted = $true
    Write-InstallLog "Icone de bandeja confirmado rodando (tentativa $attempt)."
    break
  }
  Write-InstallLog "AVISO: icone de bandeja ainda nao confirmado rodando apos a tentativa $attempt."
}
if (-not $trayStarted) {
  Write-InstallLog "AVISO: o icone de bandeja nao foi confirmado rodando apos 3 tentativas nesta sessao; a chave HKLM Run ja registrada vai inicia-lo no proximo logon (deslogar/logar de novo ou reiniciar resolve)."
}

# --- Instalacao opcional do cliente RustDesk (transporte alternativo) ------
# So roda quando o instalador foi gerado com um instalador do RustDesk
# empacotado (ver installers/windows-collector/README.md e build-installer.ps1,
# variavel RustdeskInstallerPath). Falha aqui nunca derruba a instalacao do
# coletor -- so registra aviso; o transporte RustDesk fica indisponivel ate
# alguem instalar o RustDesk manualmente ou reexecutar este instalador com o
# pacote presente. O id do dispositivo criado por este install e reportado
# sozinho ao IT Guardian no primeiro heartbeat com "enableRemoteAssistance"
# ligado (ver ReportRustdeskIdIfChanged em agent/windows/ITGuardian.Windows.cs).
$rustdeskInstallerPath = Join-Path $resolvedDirectory "rustdesk-installer.exe"
if (Test-Path -LiteralPath $rustdeskInstallerPath) {
  try {
    # NOTA DE VERIFICACAO (nao testado neste ambiente): "--silent-install" e o
    # flag documentado publicamente pelo projeto RustDesk nas versoes
    # disponiveis ate a escrita deste script. O RustDesk nao e mantido pelo IT
    # Guardian -- confirme esse flag contra a versao efetivamente empacotada
    # antes de confiar nisto em producao.
    $rustdeskProcess = Start-Process `
      -FilePath $rustdeskInstallerPath `
      -ArgumentList @("--silent-install") `
      -WindowStyle Hidden `
      -Wait `
      -PassThru
    if ($rustdeskProcess.ExitCode -eq 0) {
      Write-InstallLog "Cliente RustDesk instalado silenciosamente."
    } else {
      Write-InstallLog "AVISO: instalador do RustDesk retornou codigo $($rustdeskProcess.ExitCode)."
    }
  } catch {
    Write-InstallLog "AVISO: falha ao instalar o RustDesk automaticamente. $($_.Exception.Message)"
  }
} else {
  Write-InstallLog "Instalador do RustDesk nao empacotado; transporte RustDesk permanece indisponivel nesta maquina."
}

Write-InstallLog "Instalacao finalizada com sucesso."
