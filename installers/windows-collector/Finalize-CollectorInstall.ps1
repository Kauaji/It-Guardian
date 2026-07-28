[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$InstallDirectory,
  [AllowEmptyString()][string]$OcsServerUrl = "",
  [AllowEmptyString()][string]$ZabbixServer = "",
  [AllowEmptyString()][string]$ZabbixServerActive = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$taskName = "IT Guardian Collector"
$legacyTaskName = "IT Guardian Cloud Collector"
$resolvedDirectory = [IO.Path]::GetFullPath($InstallDirectory)
$configPath = Join-Path $resolvedDirectory "config.json"
$collectorPath = Join-Path $resolvedDirectory "ITGuardian.exe"
$monitoringInstallerPath = Join-Path $resolvedDirectory "Install-MonitoringAgents.ps1"
$ocsSetupPath = Join-Path $resolvedDirectory "packages\OCS-Windows-Agent-Setup-x64.exe"
$zabbixMsiPath = Join-Path $resolvedDirectory "packages\zabbix_agent2-7.0.29-windows-amd64-openssl.msi"

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Configuracao do coletor nao encontrada."
}
if (-not (Test-Path -LiteralPath $collectorPath)) {
  throw "Executavel do coletor nao encontrado."
}
$monitoringValues = @($OcsServerUrl, $ZabbixServer, $ZabbixServerActive)
$configuredMonitoringValues = @($monitoringValues | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

if ($configuredMonitoringValues.Count -gt 0 -and $configuredMonitoringValues.Count -lt 3) {
  throw "A configuracao de OCS e Zabbix recebida esta incompleta."
}

if ($configuredMonitoringValues.Count -eq 3) {
  if (-not (Test-Path -LiteralPath $monitoringInstallerPath)) {
    throw "Instalador dos agentes OCS e Zabbix nao encontrado."
  }

  & $monitoringInstallerPath `
    -InstallDirectory $resolvedDirectory `
    -OcsSetupPath $ocsSetupPath `
    -ZabbixMsiPath $zabbixMsiPath `
    -OcsServerUrl $OcsServerUrl `
    -ZabbixServer $ZabbixServer `
    -ZabbixServerActive $ZabbixServerActive
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
  -Execute $collectorPath `
  -Argument "--collector --config `"$configPath`""
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

Start-ScheduledTask -TaskName $taskName
Start-Process -FilePath $collectorPath -ArgumentList @("--tray", "--config", "`"$configPath`"")
