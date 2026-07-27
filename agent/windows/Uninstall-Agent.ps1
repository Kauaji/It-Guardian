[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param([switch]$Force)

$ErrorActionPreference = "Stop"
$taskName = "IT Guardian Agent"
$installDirectory = [IO.Path]::GetFullPath((Join-Path $env:ProgramData "ITGuardianAgent"))
$programDataRoot = [IO.Path]::GetFullPath($env:ProgramData).TrimEnd("\") + "\"

if (-not $installDirectory.StartsWith($programDataRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Diretorio de instalacao recusado por seguranca: $installDirectory"
}

if (-not $Force -and -not $PSCmdlet.ShouldProcess(
  "tarefa agendada '$taskName' e dados em $installDirectory",
  "Remover permanentemente o agente"
)) {
  return
}

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
if (Test-Path -LiteralPath $installDirectory) {
  Remove-Item -LiteralPath $installDirectory -Recurse -Force
}
Write-Host "Agente IT Guardian removido." -ForegroundColor Green
