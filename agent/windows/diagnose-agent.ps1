[CmdletBinding()]
param(
  [string]$InstallDirectory = (Join-Path $env:ProgramData "ITGuardian")
)

$ErrorActionPreference = "Continue"
$taskName = "IT Guardian Collector"
$configPath = Join-Path $InstallDirectory "config.json"
$logPath = Join-Path $InstallDirectory "logs\agent.log"
$executablePath = Join-Path $InstallDirectory "ITGuardian.exe"

Write-Host "IT Guardian - diagnostico" -ForegroundColor Cyan
Write-Host "Diretorio: $InstallDirectory"
Write-Host "Aplicativo: $(if (Test-Path -LiteralPath $executablePath) { 'OK' } else { 'AUSENTE' })"
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
