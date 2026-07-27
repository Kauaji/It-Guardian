[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ServerUrl,
  [Parameter(Mandatory = $true)][Alias("Token")][string]$AgentToken
)

$ErrorActionPreference = "Stop"
$baseUrl = $ServerUrl.TrimEnd("/")

try {
  $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -TimeoutSec 10
} catch {
  $health = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method Get -TimeoutSec 10
}
if ($health.ok -ne $true) {
  throw "A API respondeu, mas o healthcheck nao esta saudavel."
}

$payload = [ordered]@{
  machineId = "diagnostic-$([Environment]::MachineName.ToLowerInvariant())"
  hostname = [Environment]::MachineName
  operatingSystem = "Windows heartbeat diagnostic"
  osArchitecture = if ([Environment]::Is64BitOperatingSystem) { "64-bit" } else { "32-bit" }
  windowsVersion = [Environment]::OSVersion.Version.ToString()
  localIp = "127.0.0.1"
  macAddress = "00-00-00-00-00-00"
  cpuModel = "Diagnostic payload"
  memoryTotalBytes = 1
  diskTotalBytes = 1
  diskFreeBytes = 1
  uptimeSeconds = 0
  agentVersion = "diagnostic"
  collectedAt = (Get-Date).ToUniversalTime().ToString("o")
  intervalSeconds = 300
  environment = "Diagnostico"
  group = ""
  segment = ""
}

$response = Invoke-RestMethod -Uri "$baseUrl/api/agents/heartbeat" -Method Post -Headers @{
  Authorization = "Bearer $AgentToken"
} -ContentType "application/json" -Body ($payload | ConvertTo-Json -Depth 3) -TimeoutSec 15

Write-Host "Healthcheck: OK" -ForegroundColor Green
Write-Host "Heartbeat aceito para o ativo $($response.assetId)." -ForegroundColor Green
Write-Host "O token foi utilizado somente no cabecalho e nao foi exibido." -ForegroundColor DarkGray
