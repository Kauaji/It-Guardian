[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"
$taskNames = @("IT Guardian Collector", "IT Guardian Cloud Collector")
$installDirectory = Split-Path -Parent $PSCommandPath
$monitoringMarkerPath = Join-Path $installDirectory "monitoring-agents.json"

function Get-UninstallEntry {
  param([Parameter(Mandatory = $true)][string]$DisplayNamePattern)

  foreach ($root in @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
  )) {
    if (-not (Test-Path -LiteralPath $root)) {
      continue
    }
    $entry = Get-ChildItem -LiteralPath $root |
      Get-ItemProperty |
      Where-Object { $_.DisplayName -like $DisplayNamePattern } |
      Select-Object -First 1
    if ($entry) {
      return $entry
    }
  }
  return $null
}

function Uninstall-OwnedAgent {
  param(
    [Parameter(Mandatory = $true)][string]$DisplayNamePattern,
    [Parameter(Mandatory = $true)][bool]$InstalledByItGuardian
  )

  if (-not $InstalledByItGuardian) {
    return
  }
  $entry = Get-UninstallEntry -DisplayNamePattern $DisplayNamePattern
  if (-not $entry) {
    return
  }

  $productCode = [string]$entry.PSChildName
  if ($productCode -match "^\{[0-9A-Fa-f-]{36}\}$") {
    Start-Process `
      -FilePath (Join-Path $env:WINDIR "System32\msiexec.exe") `
      -ArgumentList @("/x", $productCode, "/qn", "/norestart") `
      -Wait
    return
  }

  $command = [string]$entry.QuietUninstallString
  if ([string]::IsNullOrWhiteSpace($command)) {
    $command = [string]$entry.UninstallString
  }
  if ($command -match '^\s*"([^"]+)"\s*(.*)$') {
    $executable = $Matches[1]
    $arguments = $Matches[2]
  } else {
    $parts = $command -split "\s+", 2
    $executable = $parts[0]
    $arguments = if ($parts.Count -gt 1) { $parts[1] } else { "" }
  }
  if (Test-Path -LiteralPath $executable) {
    if ($arguments -notmatch "(?i)(/S|/silent|/quiet)") {
      $arguments = "$arguments /S".Trim()
    }
    Start-Process -FilePath $executable -ArgumentList $arguments -Wait
  }
}

foreach ($taskName in $taskNames) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
}

Remove-ItemProperty `
  -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" `
  -Name "IT Guardian" `
  -ErrorAction SilentlyContinue
Stop-Process -Name "ITGuardian" -Force -ErrorAction SilentlyContinue

if (Test-Path -LiteralPath $monitoringMarkerPath) {
  $monitoring = Get-Content -LiteralPath $monitoringMarkerPath -Raw | ConvertFrom-Json
  Uninstall-OwnedAgent `
    -DisplayNamePattern "Zabbix Agent 2*" `
    -InstalledByItGuardian ([bool]$monitoring.zabbix.installedByItGuardian)
  Uninstall-OwnedAgent `
    -DisplayNamePattern "OCS Inventory*Agent*" `
    -InstalledByItGuardian ([bool]$monitoring.ocs.installedByItGuardian)
  Remove-Item -LiteralPath $monitoringMarkerPath -Force -ErrorAction SilentlyContinue
}
