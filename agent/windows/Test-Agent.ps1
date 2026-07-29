$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "it-guardian-agent.ps1") -ImportOnly

$config = [pscustomobject]@{
  serverUrl = "http://127.0.0.1"
  agentToken = "itg_test"
  intervalSeconds = 300
  machineId = "machine-test"
  machineAlias = "Laboratorio"
  environment = "Teste"
  group = "TI"
  segment = "Bancada"
  includeLoggedUser = $false
}
$snapshot = @{
  machineId = "ignored"
  hostname = "PC-TESTE"
  operatingSystem = "Windows 11 Pro"
  osArchitecture = "64-bit"
  windowsVersion = "10.0.26100"
  localIp = "192.168.1.20"
  macAddress = "AA:BB:CC:DD:EE:FF"
  cpuModel = "CPU Teste"
  cpuUsagePercent = 32
  memoryTotalBytes = 8589934592
  memoryUsedBytes = 4294967296
  memoryFreeBytes = 4294967296
  diskTotalBytes = 256000000000
  diskFreeBytes = 128000000000
  deviceManufacturer = "Fabricante Teste"
  deviceModel = "Modelo Teste"
  serialNumber = "SERIAL-TESTE"
  uptimeSeconds = 3600
}

$payload = New-InventoryPayload -Config $config -Snapshot $snapshot
if ($payload.machineId -ne "machine-test") { throw "machineId nao foi preservado." }
if ($payload.hostname -ne "PC-TESTE") { throw "hostname nao foi coletado." }
if ($payload.Contains("loggedUser")) { throw "loggedUser foi coletado sem consentimento." }
if ($payload.PSObject.Properties.Name -contains "files") { throw "Campo proibido detectado." }
Write-Host "Testes do agente passaram." -ForegroundColor Green
