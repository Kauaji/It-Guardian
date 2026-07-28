[CmdletBinding()]
param(
  [string]$VendorDirectory = (Join-Path $PSScriptRoot "vendor")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ocsVersion = "2.11.0.1"
$ocsArchiveName = "OCS-Windows-Agent-$($ocsVersion)_x64.zip"
$ocsArchiveUrl = "https://github.com/OCSInventory-NG/WindowsAgent/releases/download/$ocsVersion/$ocsArchiveName"
$ocsArchiveSha256 = "50273E19EDDD63EB235DFBA9114411E16A38EA6F5FDB96CEC151A3769C449D01"
$ocsSetupSha256 = "6DD18E9A9A922A5A40DF6FF1B7A851BF012D2AB5C3DBE556732FFFB20B069018"

$zabbixVersion = "7.0.29"
$zabbixMsiName = "zabbix_agent2-$zabbixVersion-windows-amd64-openssl.msi"
$zabbixMsiUrl = "https://cdn.zabbix.com/zabbix/binaries/stable/7.0/$zabbixVersion/$zabbixMsiName"
$zabbixMsiSha256 = "F26B781A00C1551FEA5E67EBCCB12BE05BD0AFDA13D26497A1415079780CFDBE"

function Assert-FileHash {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$ExpectedSha256
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Pacote obrigatorio nao encontrado: $Path"
  }
  $actualHash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
  if ($actualHash -ne $ExpectedSha256) {
    throw "Hash SHA-256 invalido para $Path. Esperado $ExpectedSha256; recebido $actualHash."
  }
}

function Assert-TrustedSignature {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$PublisherPattern
  )

  $signature = Get-AuthenticodeSignature -LiteralPath $Path
  if ($signature.Status -ne "Valid") {
    throw "Assinatura Authenticode invalida para ${Path}: $($signature.Status)."
  }
  if ($signature.SignerCertificate.Subject -notmatch $PublisherPattern) {
    throw "Publicador inesperado para ${Path}: $($signature.SignerCertificate.Subject)."
  }
}

function Get-VerifiedDownload {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][string]$ExpectedSha256
  )

  $needsDownload = $true
  if (Test-Path -LiteralPath $Destination) {
    $needsDownload = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash -ne $ExpectedSha256
  }
  if ($needsDownload) {
    Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing
  }
  Assert-FileHash -Path $Destination -ExpectedSha256 $ExpectedSha256
}

New-Item -ItemType Directory -Force -Path $VendorDirectory | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ocsArchivePath = Join-Path $VendorDirectory $ocsArchiveName
$ocsExtractDirectory = Join-Path $VendorDirectory "ocs-extracted"
$ocsSetupPath = Join-Path $ocsExtractDirectory "$([IO.Path]::GetFileNameWithoutExtension($ocsArchiveName))\OCS-Windows-Agent-Setup-x64.exe"
$zabbixMsiPath = Join-Path $VendorDirectory $zabbixMsiName

Get-VerifiedDownload `
  -Url $ocsArchiveUrl `
  -Destination $ocsArchivePath `
  -ExpectedSha256 $ocsArchiveSha256

$extractOcs = $true
if (Test-Path -LiteralPath $ocsSetupPath) {
  $extractOcs = (Get-FileHash -LiteralPath $ocsSetupPath -Algorithm SHA256).Hash -ne $ocsSetupSha256
}
if ($extractOcs) {
  if (Test-Path -LiteralPath $ocsExtractDirectory) {
    Remove-Item -LiteralPath $ocsExtractDirectory -Recurse -Force
  }
  Expand-Archive -LiteralPath $ocsArchivePath -DestinationPath $ocsExtractDirectory -Force
}
Assert-FileHash -Path $ocsSetupPath -ExpectedSha256 $ocsSetupSha256
Assert-TrustedSignature -Path $ocsSetupPath -PublisherPattern "O=FactorFX"

Get-VerifiedDownload `
  -Url $zabbixMsiUrl `
  -Destination $zabbixMsiPath `
  -ExpectedSha256 $zabbixMsiSha256
Assert-TrustedSignature -Path $zabbixMsiPath -PublisherPattern "O=Zabbix SIA"

[pscustomobject]@{
  OcsVersion = $ocsVersion
  OcsSetupPath = $ocsSetupPath
  ZabbixVersion = $zabbixVersion
  ZabbixMsiPath = $zabbixMsiPath
}
