[CmdletBinding()]
param([string]$ProjectDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path)

$ErrorActionPreference = "Stop"
$root = [IO.Path]::GetFullPath($ProjectDirectory)
& (Join-Path $root "scripts\local\Start-ITGuardian.ps1")
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "1. Crie o administrador com o comando documentado em docs\INSTALACAO-LOCAL.md."
Write-Host "2. Gere um token de enrollment para os computadores Windows."
Write-Host "3. Instale o agente conforme docs\AGENTE-WINDOWS.md."
