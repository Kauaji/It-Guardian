[CmdletBinding()]
param(
  [string]$InstallDirectory = (Join-Path $env:ProgramData "ITGuardianAgent")
)

$ErrorActionPreference = "Continue"
$taskName = "IT Guardian Agent"
$configPath = Join-Path $InstallDirectory "config.json"
$logPath = Join-Path $InstallDirectory "logs\agent.log"

Write-Host "IT Guardian Agent - diagnostico" -ForegroundColor Cyan
Write-Host "Diretorio: $InstallDirectory"
Write-Host "Configuracao: $(if (Test-Path -LiteralPath $configPath) { 'OK' } else { 'AUSENTE' })"

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
  $info = Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction SilentlyContinue
  Write-Host "Tarefa: $($task.State)"
  Write-Host "Ultima execucao: $($info.LastRunTime)"
  Write-Host "Ultimo resultado: $($info.LastTaskResult)"
} else {
  Write-Host "Tarefa: AUSENTE" -ForegroundColor Yellow
}

if (Test-Path -LiteralPath $configPath) {
  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  Write-Host "Servidor: $($config.serverUrl)"
  Write-Host "Intervalo: $($config.intervalSeconds) segundos"
  Write-Host "Token configurado: $(if ([string]::IsNullOrWhiteSpace($config.agentToken)) { 'NAO' } else { 'SIM (oculto)' })"
}

if (Test-Path -LiteralPath $logPath) {
  Write-Host "Ultimas linhas do log:"
  Get-Content -LiteralPath $logPath -Tail 10
} else {
  Write-Host "Log ainda nao criado."
}
