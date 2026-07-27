[CmdletBinding()]
param([string]$Destination)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
& (Join-Path $root "scripts\local\Backup-ITGuardian.ps1") -Destination $Destination
