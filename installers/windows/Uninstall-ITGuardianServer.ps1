[CmdletBinding()]
param(
  [string]$ProjectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [switch]$RemoveData
)

$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath($ProjectDirectory)
if ($RemoveData) {
  & (Join-Path $root "scripts\local\Reset-ITGuardian.ps1")
} else {
  & (Join-Path $root "scripts\local\Stop-ITGuardian.ps1")
}
