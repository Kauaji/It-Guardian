[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot "config.json"),
  [switch]$Once,
  [switch]$ImportOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$script:AgentVersion = "1.0.0"

function Write-AgentLog {
  param([string]$Message, [ValidateSet("INFO", "WARN", "ERROR")][string]$Level = "INFO")
  $logDirectory = Join-Path $PSScriptRoot "logs"
  New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
  $logFile = Join-Path $logDirectory "agent.log"
  if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -gt 2MB) {
    Move-Item -LiteralPath $logFile -Destination (Join-Path $logDirectory "agent.previous.log") -Force
  }
  Add-Content -LiteralPath $logFile -Value ("{0:o} [{1}] {2}" -f (Get-Date), $Level, $Message)
}

function Get-AgentConfig {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { throw "Arquivo de configuracao nao encontrado: $Path" }
  $config = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace($config.serverUrl)) { throw "serverUrl e obrigatorio." }
  if ([string]::IsNullOrWhiteSpace($config.agentToken)) { throw "agentToken e obrigatorio." }
  $uri = $null
  if (-not [Uri]::TryCreate($config.serverUrl, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -notin @("http", "https")) {
    throw "serverUrl deve ser uma URL HTTP ou HTTPS valida."
  }
  $interval = if ($null -eq $config.intervalSeconds) { 300 } else { [int]$config.intervalSeconds }
  if ($interval -lt 30 -or $interval -gt 86400) { throw "intervalSeconds deve estar entre 30 e 86400." }
  return $config
}

function Get-SystemSnapshot {
  $os = Get-CimInstance Win32_OperatingSystem
  $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
  $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
  $network = Get-CimInstance Win32_NetworkAdapterConfiguration |
    Where-Object { $_.IPEnabled -and $_.IPAddress } |
    Select-Object -First 1
  $machineGuid = (Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\Microsoft\Cryptography").MachineGuid

  return [ordered]@{
    machineId = [string]$machineGuid
    hostname = [Environment]::MachineName
    operatingSystem = [string]$os.Caption
    osArchitecture = [string]$os.OSArchitecture
    windowsVersion = [string]$os.Version
    localIp = [string]($network.IPAddress | Where-Object { $_ -match '^\d+\.' } | Select-Object -First 1)
    macAddress = [string]$network.MACAddress
    cpuModel = [string]$cpu.Name
    memoryTotalBytes = [int64]$os.TotalVisibleMemorySize * 1KB
    diskTotalBytes = [int64]$disk.Size
    diskFreeBytes = [int64]$disk.FreeSpace
    uptimeSeconds = [int64]((Get-Date) - $os.LastBootUpTime).TotalSeconds
  }
}

function New-InventoryPayload {
  param(
    [Parameter(Mandatory = $true)]$Config,
    [hashtable]$Snapshot = (Get-SystemSnapshot)
  )
  $machineId = if ([string]::IsNullOrWhiteSpace($Config.machineId)) { $Snapshot.machineId } else { $Config.machineId }
  $payload = [ordered]@{
    machineId = [string]$machineId
    hostname = [string]$Snapshot.hostname
    machineAlias = [string]$Config.machineAlias
    operatingSystem = [string]$Snapshot.operatingSystem
    osArchitecture = [string]$Snapshot.osArchitecture
    windowsVersion = [string]$Snapshot.windowsVersion
    localIp = [string]$Snapshot.localIp
    macAddress = [string]$Snapshot.macAddress
    cpuModel = [string]$Snapshot.cpuModel
    memoryTotalBytes = [int64]$Snapshot.memoryTotalBytes
    diskTotalBytes = [int64]$Snapshot.diskTotalBytes
    diskFreeBytes = [int64]$Snapshot.diskFreeBytes
    uptimeSeconds = [int64]$Snapshot.uptimeSeconds
    agentVersion = $script:AgentVersion
    collectedAt = (Get-Date).ToUniversalTime().ToString("o")
    intervalSeconds = if ($null -eq $Config.intervalSeconds) { 300 } else { [int]$Config.intervalSeconds }
    environment = [string]$Config.environment
    group = [string]$Config.group
    segment = [string]$Config.segment
  }
  if ($Config.includeLoggedUser -eq $true) {
    $payload.loggedUser = [Environment]::UserName
  }
  return $payload
}

function Send-Inventory {
  param([Parameter(Mandatory = $true)]$Config)
  $payload = New-InventoryPayload -Config $Config
  $endpoint = "{0}/api/agents/heartbeat" -f $Config.serverUrl.TrimEnd("/")
  Invoke-RestMethod -Uri $endpoint -Method Post -Headers @{
    Authorization = "Bearer $($Config.agentToken)"
  } -ContentType "application/json" -Body ($payload | ConvertTo-Json -Depth 4) | Out-Null
  Write-AgentLog -Message ("Inventario enviado para {0}; maquina {1}." -f $Config.serverUrl, $payload.hostname)
}

function Start-AgentLoop {
  param([string]$Path, [switch]$RunOnce)
  $config = Get-AgentConfig -Path $Path
  Write-AgentLog -Message ("Agente v{0} iniciado; servidor {1}." -f $script:AgentVersion, $config.serverUrl)
  do {
    try {
      Send-Inventory -Config $config
    } catch {
      Write-AgentLog -Level "ERROR" -Message $_.Exception.Message
      if ($RunOnce) { throw }
    }
    if (-not $RunOnce) {
      $sleepSeconds = if ($null -eq $config.intervalSeconds) { 300 } else { [int]$config.intervalSeconds }
      Write-AgentLog -Message ("Proximo envio em {0} segundos." -f $sleepSeconds)
      Start-Sleep -Seconds $sleepSeconds
    }
  } while (-not $RunOnce)
}

if (-not $ImportOnly) {
  Start-AgentLoop -Path $ConfigPath -RunOnce:$Once
}
