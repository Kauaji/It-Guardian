[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$InstallDirectory,
  [Parameter(Mandatory = $true)][string]$OcsSetupPath,
  [Parameter(Mandatory = $true)][string]$ZabbixMsiPath,
  [Parameter(Mandatory = $true)][string]$OcsServerUrl,
  [Parameter(Mandatory = $true)][string]$ZabbixServer,
  [Parameter(Mandatory = $true)][string]$ZabbixServerActive
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ocsSetupSha256 = "6DD18E9A9A922A5A40DF6FF1B7A851BF012D2AB5C3DBE556732FFFB20B069018"
$zabbixMsiSha256 = "F26B781A00C1551FEA5E67EBCCB12BE05BD0AFDA13D26497A1415079780CFDBE"
$registryRoots = @(
  "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
  "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
)

function Get-UninstallEntry {
  param([Parameter(Mandatory = $true)][string]$DisplayNamePattern)

  foreach ($root in $registryRoots) {
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

function Assert-Package {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$ExpectedSha256,
    [Parameter(Mandatory = $true)][string]$PublisherPattern
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Pacote de monitoramento ausente: $Path"
  }
  $actualHash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
  if ($actualHash -ne $ExpectedSha256) {
    throw "O pacote $Path falhou na verificacao SHA-256."
  }
  $signature = Get-AuthenticodeSignature -LiteralPath $Path
  if (
    $signature.Status -ne "Valid" -or
    $signature.SignerCertificate.Subject -notmatch $PublisherPattern
  ) {
    throw "O pacote $Path nao possui a assinatura esperada."
  }
}

function Get-AgentService {
  param([Parameter(Mandatory = $true)][ValidateSet("ocs", "zabbix")][string]$Agent)

  if ($Agent -eq "zabbix") {
    return Get-Service -Name "Zabbix Agent 2" -ErrorAction SilentlyContinue
  }
  return Get-Service -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -like "*OCS*" -or $_.DisplayName -like "*OCS*Inventory*"
    } |
    Select-Object -First 1
}

$ocsUri = $null
if (
  -not [Uri]::TryCreate($OcsServerUrl, [UriKind]::Absolute, [ref]$ocsUri) -or
  $ocsUri.Scheme -notin @("http", "https") -or
  -not [string]::IsNullOrWhiteSpace($ocsUri.UserInfo)
) {
  throw "O endereco do servidor OCS deve ser uma URL HTTP ou HTTPS valida e sem credenciais."
}
foreach ($value in @($ZabbixServer, $ZabbixServerActive)) {
  if (
    [string]::IsNullOrWhiteSpace($value) -or
    $value.IndexOfAny([char[]]@("`r", "`n", '"')) -ge 0
  ) {
    throw "Informe enderecos validos para o servidor Zabbix."
  }
}

Assert-Package `
  -Path $OcsSetupPath `
  -ExpectedSha256 $ocsSetupSha256 `
  -PublisherPattern "O=FactorFX"
Assert-Package `
  -Path $ZabbixMsiPath `
  -ExpectedSha256 $zabbixMsiSha256 `
  -PublisherPattern "O=Zabbix SIA"

$ocsEntryBefore = Get-UninstallEntry -DisplayNamePattern "OCS Inventory*Agent*"
$zabbixEntryBefore = Get-UninstallEntry -DisplayNamePattern "Zabbix Agent 2*"

$ocsArguments = @(
  "/S",
  "/NOSPLASH",
  "/UPGRADE",
  "/NP",
  "/NOW",
  "/SERVER=$($ocsUri.AbsoluteUri.TrimEnd('/'))"
)
$ocsProcess = Start-Process `
  -FilePath $OcsSetupPath `
  -ArgumentList $ocsArguments `
  -Wait `
  -PassThru
if ($ocsProcess.ExitCode -notin @(0, 3010)) {
  throw "A instalacao do OCS Inventory Agent falhou com codigo $($ocsProcess.ExitCode)."
}

$zabbixArguments = @(
  "/i",
  "`"$ZabbixMsiPath`"",
  "/qn",
  "/norestart",
  "SERVER=$ZabbixServer",
  "SERVERACTIVE=$ZabbixServerActive",
  "HOSTNAME=$env:COMPUTERNAME",
  "STARTUPTYPE=automatic"
)
$zabbixProcess = Start-Process `
  -FilePath (Join-Path $env:WINDIR "System32\msiexec.exe") `
  -ArgumentList $zabbixArguments `
  -Wait `
  -PassThru
if ($zabbixProcess.ExitCode -notin @(0, 3010)) {
  throw "A instalacao do Zabbix Agent 2 falhou com codigo $($zabbixProcess.ExitCode)."
}

$ocsService = Get-AgentService -Agent "ocs"
$zabbixService = Get-AgentService -Agent "zabbix"
if (-not $ocsService) {
  throw "O servico do OCS Inventory Agent nao foi encontrado depois da instalacao."
}
if (-not $zabbixService) {
  throw "O servico Zabbix Agent 2 nao foi encontrado depois da instalacao."
}

Set-Service -Name $ocsService.Name -StartupType Automatic
Set-Service -Name $zabbixService.Name -StartupType Automatic
Start-Service -Name $ocsService.Name
Start-Service -Name $zabbixService.Name
$ocsService = Get-Service -Name $ocsService.Name
$zabbixService = Get-Service -Name $zabbixService.Name
$ocsService.WaitForStatus(
  [System.ServiceProcess.ServiceControllerStatus]::Running,
  (New-TimeSpan -Seconds 30)
)
$zabbixService.WaitForStatus(
  [System.ServiceProcess.ServiceControllerStatus]::Running,
  (New-TimeSpan -Seconds 30)
)

$marker = [ordered]@{
  installedAt = (Get-Date).ToUniversalTime().ToString("o")
  ocs = [ordered]@{
    version = "2.11.0.1"
    serverUrl = $ocsUri.AbsoluteUri.TrimEnd("/")
    serviceName = $ocsService.Name
    installedByItGuardian = -not [bool]$ocsEntryBefore
  }
  zabbix = [ordered]@{
    version = "7.0.29"
    server = $ZabbixServer
    serverActive = $ZabbixServerActive
    serviceName = $zabbixService.Name
    installedByItGuardian = -not [bool]$zabbixEntryBefore
  }
}
$markerPath = Join-Path ([IO.Path]::GetFullPath($InstallDirectory)) "monitoring-agents.json"
$marker | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $markerPath -Encoding UTF8

Remove-Item -LiteralPath $OcsSetupPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $ZabbixMsiPath -Force -ErrorAction SilentlyContinue
