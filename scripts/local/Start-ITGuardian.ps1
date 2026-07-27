[CmdletBinding()]
param(
  [switch]$Detach = $true
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envFile = Join-Path $root ".env.local"
$exampleFile = Join-Path $root ".env.local.example"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker nao foi encontrado. Instale e inicie o Docker Desktop."
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop nao esta em execucao."
}

if (-not (Test-Path -LiteralPath $envFile)) {
  Copy-Item -LiteralPath $exampleFile -Destination $envFile
  throw "O arquivo .env.local foi criado. Troque POSTGRES_PASSWORD e JWT_SECRET antes de executar novamente."
}

$localEnvironment = @{}
Get-Content -LiteralPath $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
    $localEnvironment[$matches[1].Trim()] = $matches[2].Trim()
  }
}
if (
  $localEnvironment["POSTGRES_PASSWORD"] -eq "troque-esta-senha" -or
  $localEnvironment["JWT_SECRET"] -eq "troque-por-uma-chave-com-pelo-menos-32-caracteres" -or
  [string]::IsNullOrWhiteSpace($localEnvironment["POSTGRES_PASSWORD"]) -or
  [string]::IsNullOrWhiteSpace($localEnvironment["JWT_SECRET"]) -or
  $localEnvironment["JWT_SECRET"].Length -lt 32
) {
  throw "Troque POSTGRES_PASSWORD e defina JWT_SECRET com pelo menos 32 caracteres em .env.local."
}

$arguments = @("compose", "--env-file", $envFile, "-f", (Join-Path $root "docker-compose.local.yml"), "up", "--build")
if ($Detach) { $arguments += "-d" }

& docker @arguments
if ($LASTEXITCODE -ne 0) { throw "Falha ao iniciar o IT Guardian." }

Write-Host "IT Guardian iniciado. Acesse http://localhost (ou o IP deste servidor na rede)." -ForegroundColor Green
Write-Host "Primeiro acesso: crie o administrador e um token seguindo docs\INSTALACAO-LOCAL.md." -ForegroundColor Cyan
