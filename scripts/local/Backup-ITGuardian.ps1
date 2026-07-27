[CmdletBinding()]
param([string]$Destination)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envFile = Join-Path $root ".env.local"
$backupDir = Join-Path $root "backups"
if (-not $Destination) {
  $Destination = Join-Path $backupDir ("it-guardian-{0}.dump" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
}
$resolvedDestination = [IO.Path]::GetFullPath($Destination)
New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($resolvedDestination)) | Out-Null

$containerFile = "/tmp/it-guardian-backup.dump"
& docker compose --env-file $envFile -f (Join-Path $root "docker-compose.local.yml") exec -T db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/it-guardian-backup.dump'
if ($LASTEXITCODE -ne 0) { throw "Falha ao gerar o backup no PostgreSQL." }
& docker compose --env-file $envFile -f (Join-Path $root "docker-compose.local.yml") cp "db:$containerFile" $resolvedDestination
if ($LASTEXITCODE -ne 0) { throw "Falha ao copiar o backup." }
Write-Host "Backup criado em $resolvedDestination" -ForegroundColor Green
