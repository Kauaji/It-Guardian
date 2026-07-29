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

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Write-InstallLog {
  param([Parameter(Mandatory = $true)][string]$Message)
  Add-Content `
    -LiteralPath $installLogPath `
    -Value ("{0:o} {1}" -f [DateTime]::UtcNow, $Message) `
    -Encoding UTF8
}

trap {
  Write-InstallLog ("ERRO: {0}`r`n{1}" -f $_.Exception.Message, ($_ | Out-String))
  exit 1
}

Write-InstallLog "Iniciando finalizacao da instalacao."

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Configuracao do coletor nao encontrada."
}
if (-not (Test-Path -LiteralPath $collectorPath)) {
  throw "Executavel do coletor nao encontrado."
}
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

$taskScheduler = Join-Path $env:WINDIR "System32\schtasks.exe"
$taskCommand = "`"$collectorPath`" --collector --config `"$configPath`""
& $taskScheduler `
  /Create `
  /TN $taskName `
  /TR $taskCommand `
  /SC ONSTART `
  /RU SYSTEM `
  /RL HIGHEST `
  /F | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Nao foi possivel registrar a tarefa do coletor (codigo $LASTEXITCODE)."
}
Write-InstallLog "Tarefa de inicializacao registrada."

Stop-ScheduledTask -TaskName $legacyTaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $legacyTaskName -Confirm:$false -ErrorAction SilentlyContinue

New-ItemProperty `
  -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" `
  -Name "IT Guardian" `
  -PropertyType String `
  -Value "`"$collectorPath`" --tray --config `"$configPath`"" `
  -Force | Out-Null

& $collectorPath --collector --config $configPath --once
if ($LASTEXITCODE -ne 0) {
  throw "O primeiro heartbeat do coletor falhou."
}
Write-InstallLog "Primeiro heartbeat concluido."

& $taskScheduler /Run /TN $taskName | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Nao foi possivel iniciar a tarefa do coletor (codigo $LASTEXITCODE)."
}
Start-Process -FilePath $collectorPath -ArgumentList @("--tray", "--config", "`"$configPath`"")
Write-InstallLog "Instalacao finalizada com sucesso."
