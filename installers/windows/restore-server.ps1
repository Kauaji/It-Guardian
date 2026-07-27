[CmdletBinding(SupportsShouldProcess, ConfirmImpact = "High")]
param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
& (Join-Path $root "scripts\local\Restore-ITGuardian.ps1") -BackupFile $BackupFile -Force:$Force
