[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$InstallDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$taskName = "IT Guardian Cloud Collector"
$resolvedDirectory = [IO.Path]::GetFullPath($InstallDirectory)
$configPath = Join-Path $resolvedDirectory "config.json"
$collectorPath = Join-Path $resolvedDirectory "it-guardian-agent.ps1"

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Configuracao do coletor nao encontrada."
}
if (-not (Test-Path -LiteralPath $collectorPath)) {
  throw "Executavel do coletor nao encontrado."
}

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

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$collectorPath`" -ConfigPath `"$configPath`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
  -RestartCount 5 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal `
  -UserId "SYSTEM" `
  -LogonType ServiceAccount `
  -RunLevel Highest

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Coleta inventario e heartbeat para o IT Guardian Cloud." `
  -Force | Out-Null

& powershell.exe `
  -NoProfile `
  -ExecutionPolicy Bypass `
  -File $collectorPath `
  -ConfigPath $configPath `
  -Once
if ($LASTEXITCODE -ne 0) {
  throw "O primeiro heartbeat do coletor falhou."
}

Start-ScheduledTask -TaskName $taskName
