[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"
$taskName = "IT Guardian Cloud Collector"

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
