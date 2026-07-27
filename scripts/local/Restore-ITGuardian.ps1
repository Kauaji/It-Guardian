[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envFile = Join-Path $root ".env.local"
$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path

if (-not $Force -and -not $PSCmdlet.ShouldProcess($resolvedBackup, "Substituir o banco local pelo backup")) {
  return
}

$containerFile = "/tmp/it-guardian-restore.dump"
& docker compose --env-file $envFile -f (Join-Path $root "docker-compose.local.yml") cp $resolvedBackup "db:$containerFile"
if ($LASTEXITCODE -ne 0) { throw "Falha ao copiar o backup para o container." }
& docker compose --env-file $envFile -f (Join-Path $root "docker-compose.local.yml") exec -T db sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/it-guardian-restore.dump'
if ($LASTEXITCODE -ne 0) { throw "Falha ao restaurar o backup." }
Write-Host "Backup restaurado com sucesso." -ForegroundColor Green
