import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "..", "..");

async function readProjectFile(...segments) {
  return readFile(path.join(projectRoot, ...segments), "utf8");
}

test("instalador cloud usa apenas a chave e instala o coletor nativo", async () => {
  const setup = await readProjectFile(
    "installers",
    "windows-collector",
    "ITGuardianCollector.iss"
  );
  const postInstall = await readProjectFile(
    "installers",
    "windows-collector",
    "Finalize-CollectorInstall.ps1"
  );
  const uninstall = await readProjectFile(
    "installers",
    "windows-collector",
    "Uninstall-Collector.ps1"
  );
  const buildInstaller = await readProjectFile(
    "installers",
    "windows-collector",
    "build-installer.ps1"
  );

  const configSection = setup.match(/ConfigJson :=([\s\S]*?)SaveStringToFile/)?.[1] || "";
  assert.doesNotMatch(configSection, /ProductKey|productKey/);
  assert.doesNotMatch(setup, /-ProductKey|-ActivationKey|-LicenseKey/i);
  assert.match(setup, /ProductKeyPage\.Values\[0\] := ''/);
  assert.match(setup, /Abrir chamado - IT Guardian/);
  assert.match(setup, /\/api\/collector\/activate/);
  assert.doesNotMatch(setup, /MonitoringPage/);
  assert.doesNotMatch(setup, /Informe os servidores OCS e Zabbix/);
  assert.doesNotMatch(setup, /ocsServerUrl|zabbixServer|OcsServerUrl|ZabbixServer/);
  assert.match(setup, /FinalizeParameters :=/);
  assert.match(setup, /Reparar ou atualizar a instalacao existente/);
  assert.match(setup, /IsRepairInstall/);
  assert.match(setup, /JsonConfigStringValue\(ExistingConfig, 'agentToken'\)/);
  assert.match(setup, /if IsRepairInstall\(\) then/);
  assert.doesNotMatch(setup, /Install-MonitoringAgents|monitoring-agents\.json/);

  assert.match(postInstall, /New-ScheduledTaskTrigger -AtStartup/);
  assert.match(postInstall, /New-ScheduledTaskTrigger -AtLogOn/);
  assert.match(postInstall, /New-ScheduledTaskPrincipal/);
  assert.match(postInstall, /-UserId "SYSTEM"/);
  assert.match(postInstall, /-AllowStartIfOnBatteries/);
  assert.match(postInstall, /-DontStopIfGoingOnBatteries/);
  assert.match(postInstall, /-StartWhenAvailable/);
  assert.match(postInstall, /-RestartCount 999/);
  assert.match(postInstall, /ITGuardian\.exe/);
  assert.match(postInstall, /--collector/);
  assert.match(postInstall, /--once/);
  assert.match(postInstall, /CurrentVersion\\Run/);
  assert.match(postInstall, /--tray/);
  assert.match(postInstall, /Coletor nativo selecionado/);
  assert.doesNotMatch(postInstall, /OcsServerUrl|ZabbixServer|Install-MonitoringAgents/);
  assert.match(setup, /SetupIconFile=it-guardian\.ico/);
  assert.match(setup, /UninstallDisplayIcon=\{app\}\\ITGuardian\.exe/);
  assert.match(setup, /Uninstallable=yes/);
  assert.match(setup, /Desinstalar IT Guardian/);
  assert.match(setup, /ITGuardian-Uninstaller\.exe/);
  assert.match(postInstall, /install-finalize\.log/);
  assert.match(uninstall, /Unregister-ScheduledTask/);
  assert.match(uninstall, /Stop-Process -Name "ITGuardian"/);
  assert.doesNotMatch(setup, /OCS-Windows-Agent|zabbix_agent|vendor\\ocs|vendor\\zabbix/);
  assert.doesNotMatch(buildInstaller, /Get-OfficialMonitoringAgents|OCS-Windows-Agent|zabbix_agent/);
  await assert.rejects(
    access(path.join(projectRoot, "installers", "windows-collector", "Get-OfficialMonitoringAgents.ps1"))
  );
  await assert.rejects(
    access(path.join(projectRoot, "installers", "windows-collector", "Install-MonitoringAgents.ps1"))
  );
  assert.match(uninstall, /installedByItGuardian/);
});

test("coletor PowerShell permanece restrito a inventario", async () => {
  const collector = await readProjectFile(
    "agent",
    "windows",
    "it-guardian-agent.ps1"
  );
  const forbidden = [
    /\bInvoke-Expression\b/i,
    /\biex\b/i,
    /\bStart-Process\b/i,
    /\bcmd\.exe\b/i,
    /\bInvoke-Command\b/i,
    /\bEnter-PSSession\b/i,
    /\bNew-PSSession\b/i,
    /\bScriptBlock\.Create\b/i
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(collector, pattern);
  }

});

test("agente nativo mantem trabalhos remotos bloqueados por padrao e controlados", async () => {
  const nativeCollector = await readProjectFile(
    "agent",
    "windows",
    "ITGuardian.Windows.cs"
  );
  const nativeForbidden = [
    /\bCreateProcess\b/i,
    /UseShellExecute\s*=\s*true/i,
    /\bInvoke-Expression\b/i,
    /\bScriptBlock\.Create\b/i
  ];

  for (const pattern of nativeForbidden) {
    assert.doesNotMatch(nativeCollector, pattern);
  }
  assert.match(nativeCollector, /\/api\/agents\/jobs\/.*\/result/);
  assert.match(nativeCollector, /Authorization.*Bearer/);
  assert.match(nativeCollector, /type != "bat".*type != "cmd".*type != "powershell"/s);
  assert.match(nativeCollector, /SpecialFolder\.System[\s\S]*"cmd\.exe"/);
  assert.match(nativeCollector, /SpecialFolder\.System[\s\S]*"powershell\.exe"/);
  assert.match(nativeCollector, /UseShellExecute\s*=\s*false/);
  assert.match(nativeCollector, /Math\.Max\(15,\s*Math\.Min\(600,\s*job\.timeoutSeconds\)\)/);
  assert.match(nativeCollector, /MaximumOutputLength\s*=\s*65536/);
  assert.match(nativeCollector, /MaxInventoryPayloadBytes\s*=\s*1024 \* 1024/);
  assert.match(nativeCollector, /body\.Length > MaxInventoryPayloadBytes/);
  assert.match(nativeCollector, /remoteScriptExecutionEnabled && config\.enableRemoteScriptExecution/);
  assert.match(nativeCollector, /requiresAdmin[\s\S]*IsAdministrator/);
  assert.match(nativeCollector, /requiresLoggedUser[\s\S]*Environment\.UserInteractive/);
  assert.match(nativeCollector, /AssemblyProduct\("IT Guardian"\)/);
  assert.match(nativeCollector, /NotifyIcon/);
  assert.match(nativeCollector, /Text = "IT Guardian ativo"/);
  assert.match(nativeCollector, /WaitForNextHeartbeat/);
  assert.match(nativeCollector, /DateTime\.UtcNow/);
  assert.match(nativeCollector, /config = ReadConfig\(configPath\)/);
  assert.match(nativeCollector, /CollectOfficeFromUninstallRegistry/);
  assert.match(nativeCollector, /RegistryHive\.Users/);
  assert.match(nativeCollector, /Microsoft 365|Microsoft Office/);
  assert.match(nativeCollector, /AgentVersion = "1\.6\.1"/);
});
