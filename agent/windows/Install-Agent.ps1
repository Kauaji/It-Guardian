[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ServerUrl,
  [Parameter(Mandatory = $true)][string]$AgentToken,
  [int]$IntervalSeconds = 300,
  [string]$MachineAlias = "",
  [string]$Environment = "",
  [string]$Group = "",
  [string]$Segment = "",
  [bool]$IncludeLoggedUser = $false,
  [bool]$EnableRemoteScriptExecution = $false,
  [bool]$EnableRemoteAssistance = $false
)

$ErrorActionPreference = "Stop"
$taskName = "IT Guardian Agent"
$installDirectory = Join-Path $env:ProgramData "ITGuardianAgent"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]$identity
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Execute este instalador como administrador."
}
if ($IntervalSeconds -lt 30 -or $IntervalSeconds -gt 86400) {
  throw "IntervalSeconds deve estar entre 30 e 86400."
}

New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "it-guardian-agent.ps1") -Destination $installDirectory -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "Uninstall-Agent.ps1") -Destination $installDirectory -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "diagnose-agent.ps1") -Destination $installDirectory -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "test-heartbeat.ps1") -Destination $installDirectory -Force

[ordered]@{
  serverUrl = $ServerUrl.TrimEnd("/")
  agentToken = $AgentToken
  intervalSeconds = $IntervalSeconds
  machineId = ""
  machineAlias = $MachineAlias
  environment = $Environment
  group = $Group
  segment = $Segment
  includeLoggedUser = [bool]$IncludeLoggedUser
  enableRemoteScriptExecution = [bool]$EnableRemoteScriptExecution
  enableRemoteAssistance = [bool]$EnableRemoteAssistance
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $installDirectory "config.json") -Encoding UTF8

$configPath = Join-Path $installDirectory "config.json"
$configAcl = New-Object System.Security.AccessControl.FileSecurity
$configAcl.SetAccessRuleProtection($true, $false)
foreach ($sidValue in @("S-1-5-18", "S-1-5-32-544")) {
  $sid = New-Object System.Security.Principal.SecurityIdentifier($sidValue)
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, "FullControl", "Allow")
  $configAcl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $configPath -AclObject $configAcl

$agentScript = Join-Path $installDirectory "it-guardian-agent.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$agentScript`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 3650)
$taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $taskPrincipal -Description "Coleta inventario basico e envia heartbeat ao IT Guardian." -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

$logPath = Join-Path $installDirectory "logs\agent.log"
$uninstallScript = Join-Path $installDirectory "Uninstall-Agent.ps1"

Write-Host "Agente instalado em $installDirectory e registrado no Agendador de Tarefas." -ForegroundColor Green
Write-Host "Heartbeat imediato solicitado pela tarefa agendada." -ForegroundColor Green
Write-Host "Logs: Get-Content `"$logPath`" -Tail 50"
Write-Host "Diagnostico: & `"$installDirectory\diagnose-agent.ps1`""
Write-Host "Desinstalar: & `"$uninstallScript`""
