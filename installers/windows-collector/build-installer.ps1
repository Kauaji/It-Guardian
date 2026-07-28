[CmdletBinding()]
param(
  [string]$ApiBaseUrl = "https://it-guardian-server.vercel.app",
  [string]$OutputDirectory = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $PSScriptRoot "output"
}

$uri = $null
if (
  -not [Uri]::TryCreate($ApiBaseUrl, [UriKind]::Absolute, [ref]$uri) -or
  $uri.Scheme -notin @("http", "https")
) {
  throw "ApiBaseUrl deve ser uma URL HTTP ou HTTPS valida."
}
if (
  $uri.Scheme -ne "https" -and
  $uri.Host -notin @("localhost", "127.0.0.1", "::1")
) {
  throw "A API cloud deve usar HTTPS. HTTP e aceito apenas para testes locais."
}

$candidates = [Collections.Generic.List[string]]::new()
if (-not [string]::IsNullOrWhiteSpace($env:INNO_SETUP_COMPILER)) {
  $candidates.Add($env:INNO_SETUP_COMPILER)
}
foreach ($root in @(${env:ProgramFiles(x86)}, $env:ProgramFiles)) {
  if (-not [string]::IsNullOrWhiteSpace($root)) {
    $candidates.Add((Join-Path $root "Inno Setup 6\ISCC.exe"))
  }
}
$compiler = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $compiler) {
  throw "Inno Setup 6 nao encontrado. Instale-o ou defina INNO_SETUP_COMPILER."
}

$requiredSources = @(
  (Join-Path $PSScriptRoot "ITGuardianCollector.iss"),
  (Join-Path $PSScriptRoot "Finalize-CollectorInstall.ps1"),
  (Join-Path $PSScriptRoot "Uninstall-Collector.ps1"),
  (Join-Path $PSScriptRoot "..\..\agent\windows\it-guardian-agent.ps1"),
  (Join-Path $PSScriptRoot "..\..\agent\windows\diagnose-agent.ps1")
)
foreach ($source in $requiredSources) {
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Arquivo obrigatorio do instalador nao encontrado: $source"
  }
}

$resolvedOutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutputDirectory | Out-Null
& $compiler `
  "/DApiBaseUrl=$($ApiBaseUrl.TrimEnd('/'))" `
  "/O$resolvedOutputDirectory" `
  (Join-Path $PSScriptRoot "ITGuardianCollector.iss")
if ($LASTEXITCODE -ne 0) {
  throw "A compilacao do instalador falhou com codigo $LASTEXITCODE."
}

Write-Host "Instalador criado em $resolvedOutputDirectory" -ForegroundColor Green
