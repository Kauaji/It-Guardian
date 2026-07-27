[CmdletBinding()]
param([string]$ServerUrl = "http://localhost")

$ErrorActionPreference = "Continue"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envFile = Join-Path $root ".env.local"
$composeFile = Join-Path $root "docker-compose.local.yml"
$webPort = 80
$apiPort = 4000

function Get-LocalIpv4 {
  if (Get-Command Get-NetIPConfiguration -ErrorAction SilentlyContinue) {
    $configurations = Get-NetIPConfiguration -ErrorAction SilentlyContinue |
      Where-Object {
        $_.NetAdapter.Status -eq "Up" -and
        $_.IPv4Address.IPAddress -and
        $_.IPv4Address.IPAddress -notlike "127.*" -and
        $_.IPv4Address.IPAddress -notlike "169.254.*"
      } |
      Sort-Object -Property InterfaceMetric
    $configuration = $configurations |
      Where-Object { $_.IPv4DefaultGateway.NextHop } |
      Select-Object -First 1
    if (-not $configuration) {
      $configuration = $configurations | Select-Object -First 1
    }
    if ($configuration) {
      return $configuration.IPv4Address.IPAddress
    }
  }

  if (Get-Command Get-NetIPAddress -ErrorAction SilentlyContinue) {
    $address = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.AddressState -eq "Preferred"
      } |
      Sort-Object -Property InterfaceMetric |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($address) {
      return $address
    }
  }

  $hostnameAddress = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
    Where-Object {
      $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
      $_.IPAddressToString -notlike "127.*" -and
      $_.IPAddressToString -notlike "169.254.*"
    } |
    Select-Object -First 1
  if ($hostnameAddress) {
    return $hostnameAddress.IPAddressToString
  }

  return "IP-DO-SERVIDOR"
}

if (Test-Path -LiteralPath $envFile) {
  foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match "^WEB_PORT=(\d+)$") {
      $webPort = [int]$Matches[1]
    }
    if ($line -match "^API_PORT=(\d+)$") {
      $apiPort = [int]$Matches[1]
    }
  }
}

Write-Host "IT Guardian Local - diagnostico" -ForegroundColor Cyan
Write-Host "Projeto: $root"
Write-Host "Docker CLI: $(if (Get-Command docker -ErrorAction SilentlyContinue) { 'OK' } else { 'AUSENTE' })"
Write-Host ".env.local: $(if (Test-Path -LiteralPath $envFile) { 'OK' } else { 'AUSENTE' })"
Write-Host "Portas: frontend $webPort; API $apiPort"

if ((Get-Command docker -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath $envFile)) {
  docker info *> $null
  Write-Host "Docker Engine: $(if ($LASTEXITCODE -eq 0) { 'OK' } else { 'INDISPONIVEL' })"
  if ($LASTEXITCODE -eq 0) {
    & docker compose --env-file $envFile -f $composeFile ps
  }
}

try {
  $health = Invoke-RestMethod -Uri "$($ServerUrl.TrimEnd('/'))/health" -TimeoutSec 10
  Write-Host "API: $($health.status); banco: $($health.database)" -ForegroundColor Green
} catch {
  Write-Host "API: indisponivel - $($_.Exception.Message)" -ForegroundColor Yellow
}

$frontendUrl = $ServerUrl.TrimEnd("/")
try {
  $frontendResponse = Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 10
  Write-Host "Frontend: HTTP $($frontendResponse.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "Frontend: indisponivel - $($_.Exception.Message)" -ForegroundColor Yellow
}

$localIp = Get-LocalIpv4
$recommendedUrl = if ($webPort -eq 80) { "http://$localIp" } else { "http://$($localIp):$webPort" }
Write-Host "IP local: $localIp"
Write-Host "Acesso recomendado em outro PC: $recommendedUrl" -ForegroundColor Cyan
Write-Host "Nenhum segredo de .env.local foi exibido." -ForegroundColor DarkGray
