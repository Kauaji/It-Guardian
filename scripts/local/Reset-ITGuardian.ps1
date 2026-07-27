[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param([switch]$Force)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envFile = Join-Path $root ".env.local"
$targetDescription = "containers e volume de dados do perfil local em $root"

if (-not $Force -and -not $PSCmdlet.ShouldProcess($targetDescription, "Remover permanentemente")) {
  return
}

& docker compose --env-file $envFile -f (Join-Path $root "docker-compose.local.yml") down --volumes
if ($LASTEXITCODE -ne 0) { throw "Falha ao resetar o IT Guardian." }
Write-Host "Ambiente local resetado. O proximo start criara um banco vazio." -ForegroundColor Yellow
