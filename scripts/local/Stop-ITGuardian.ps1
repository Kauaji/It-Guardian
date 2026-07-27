$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envFile = Join-Path $root ".env.local"
& docker compose --env-file $envFile -f (Join-Path $root "docker-compose.local.yml") down
if ($LASTEXITCODE -ne 0) { throw "Falha ao parar o IT Guardian." }
Write-Host "IT Guardian parado. Os dados foram preservados." -ForegroundColor Green
