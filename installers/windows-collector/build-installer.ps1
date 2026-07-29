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

$iconPath = Join-Path $PSScriptRoot "it-guardian.ico"
$executablePath = Join-Path $PSScriptRoot "ITGuardian.exe"
$uninstallerExecutablePath = Join-Path $PSScriptRoot "ITGuardian-Uninstaller.exe"
$sourcePath = Join-Path $PSScriptRoot "..\..\agent\windows\ITGuardian.Windows.cs"
$uninstallerSourcePath = Join-Path $PSScriptRoot "ITGuardian.Uninstaller.cs"
$iconScriptPath = Join-Path $PSScriptRoot "New-ITGuardianIcon.ps1"
$frameworkDirectory = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319"
$csharpCompiler = Join-Path $frameworkDirectory "csc.exe"
$monitoringPackagesScript = Join-Path $PSScriptRoot "Get-OfficialMonitoringAgents.ps1"

if (-not (Test-Path -LiteralPath $csharpCompiler)) {
  throw "Compilador .NET Framework x64 nao encontrado."
}
if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Codigo-fonte do aplicativo Windows nao encontrado."
}
if (-not (Test-Path -LiteralPath $uninstallerSourcePath)) {
  throw "Codigo-fonte do desinstalador Windows nao encontrado."
}
if (-not (Test-Path -LiteralPath $monitoringPackagesScript)) {
  throw "Script de obtencao dos agentes OCS e Zabbix nao encontrado."
}

$monitoringPackages = & $monitoringPackagesScript
if (-not $monitoringPackages) {
  throw "Nao foi possivel preparar os pacotes oficiais do OCS e Zabbix."
}

& $iconScriptPath -OutputPath $iconPath
& $csharpCompiler `
  /nologo `
  /target:winexe `
  /optimize+ `
  /platform:x64 `
  "/win32icon:$iconPath" `
  "/out:$executablePath" `
  "/reference:$(Join-Path $frameworkDirectory 'System.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Drawing.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Management.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Web.Extensions.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Windows.Forms.dll')" `
  $sourcePath
if ($LASTEXITCODE -ne 0) {
  throw "A compilacao do ITGuardian.exe falhou com codigo $LASTEXITCODE."
}

& $csharpCompiler `
  /nologo `
  /target:winexe `
  /optimize+ `
  /platform:x64 `
  "/win32icon:$iconPath" `
  "/out:$uninstallerExecutablePath" `
  "/reference:$(Join-Path $frameworkDirectory 'System.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Windows.Forms.dll')" `
  $uninstallerSourcePath
if ($LASTEXITCODE -ne 0) {
  throw "A compilacao do ITGuardian-Uninstaller.exe falhou com codigo $LASTEXITCODE."
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
  (Join-Path $PSScriptRoot "Install-MonitoringAgents.ps1"),
  (Join-Path $PSScriptRoot "Uninstall-Collector.ps1"),
  $monitoringPackages.OcsSetupPath,
  $monitoringPackages.ZabbixMsiPath,
  $executablePath,
  $uninstallerExecutablePath,
  $iconPath,
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
