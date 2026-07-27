[CmdletBinding()]
param([switch]$Foreground)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
& (Join-Path $root "scripts\local\Start-ITGuardian.ps1") -Detach:(-not $Foreground)
