[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$InstallDirectory
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

$action = New-ScheduledTaskAction `
  -Execute $collectorPath `
  -Argument "--collector --config `"$configPath`""
$triggers = @(
  (New-ScheduledTaskTrigger -AtStartup),
  (New-ScheduledTaskTrigger -AtLogOn)
)
$principal = New-ScheduledTaskPrincipal `
  -UserId "SYSTEM" `
  -LogonType ServiceAccount `
  -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 999 `
  -RestartInterval ([TimeSpan]::FromMinutes(1)) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew
Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $triggers `
  -Principal $principal `
  -Settings $settings `
  -Description "Mantem o inventario e o heartbeat do IT Guardian ativos." `
  -Force | Out-Null
Write-InstallLog "Tarefa resiliente registrada para inicializacao, logon, bateria e reinicio automatico."

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

Write-InstallLog "Instalacao finalizada com sucesso."
