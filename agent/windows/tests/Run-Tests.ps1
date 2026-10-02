<#
.SYNOPSIS
  Compila e executa os testes do agente Windows com o csc.exe do .NET Framework 4.x.
.DESCRIPTION
  Mesmos fontes e mesma lista de referencias de tests/run-tests.sh (Mono), mas com o compilador
  que gera o agente real (C# 5). Compila somente Logging, Signing, Policy, Config e o proprio
  ITGuardian.Tests.cs (sem WinForms/WMI). Sai com codigo != 0 se compilar mal ou algum teste falhar.
#>
[CmdletBinding()]
param(
  [string]$OutputDirectory = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$testsDirectory = $PSScriptRoot
$agentDirectory = Split-Path -Parent $testsDirectory
$frameworkDirectory = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319"
$csc = Join-Path $frameworkDirectory "csc.exe"
if (-not (Test-Path -LiteralPath $csc)) {
  throw "csc.exe do .NET Framework x64 nao encontrado em $frameworkDirectory."
}

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path ([IO.Path]::GetTempPath()) ("itg-tests-" + [Guid]::NewGuid().ToString("N"))
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$exe = Join-Path $OutputDirectory "ITGuardian.Tests.exe"

$sources = @(
  (Join-Path $agentDirectory "ITGuardian.Logging.cs"),
  (Join-Path $agentDirectory "ITGuardian.Signing.cs"),
  (Join-Path $agentDirectory "ITGuardian.Policy.cs"),
  (Join-Path $agentDirectory "ITGuardian.Config.cs"),
  (Join-Path $testsDirectory "ITGuardian.Tests.cs")
)
foreach ($source in $sources) {
  if (-not (Test-Path -LiteralPath $source)) { throw "Fonte nao encontrado: $source" }
}

& $csc `
  /nologo `
  /target:exe `
  "/out:$exe" `
  "/reference:$(Join-Path $frameworkDirectory 'System.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Core.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Numerics.dll')" `
  "/reference:$(Join-Path $frameworkDirectory 'System.Web.Extensions.dll')" `
  @sources
if ($LASTEXITCODE -ne 0) {
  throw "A compilacao dos testes falhou com codigo $LASTEXITCODE."
}

& $exe $agentDirectory
$testExitCode = $LASTEXITCODE
if ($testExitCode -ne 0) {
  throw "Testes do agente Windows falharam (codigo $testExitCode)."
}
Write-Host "Testes do agente Windows passaram." -ForegroundColor Green
