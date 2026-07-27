[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param([switch]$Force)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
& (Join-Path $root "scripts\local\Reset-ITGuardian.ps1") -Force:$Force
