import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "..", "..");

async function readProjectFile(...segments) {
  return readFile(path.join(projectRoot, ...segments), "utf8");
}

test("instalador cloud nao persiste nem repassa a chave de produto", async () => {
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
  const monitoringInstall = await readProjectFile(
    "installers",
    "windows-collector",
    "Install-MonitoringAgents.ps1"
  );
  const packageDownload = await readProjectFile(
    "installers",
    "windows-collector",
    "Get-OfficialMonitoringAgents.ps1"
  );

  const configSection = setup.match(/ConfigJson :=([\s\S]*?)SaveStringToFile/)?.[1] || "";
  assert.doesNotMatch(configSection, /ProductKey|productKey/);
  assert.doesNotMatch(setup, /-ProductKey|-ActivationKey|-LicenseKey/i);
  assert.match(setup, /ProductKeyPage\.Values\[0\] := ''/);
  assert.match(setup, /Abrir chamado - IT Guardian/);
  assert.match(setup, /\/api\/collector\/activate/);
  assert.doesNotMatch(setup, /MonitoringPage/);
  assert.doesNotMatch(setup, /Informe os servidores OCS e Zabbix/);
  assert.match(setup, /JsonStringValue\(ResponseBody, 'ocsServerUrl'\)/);
  assert.match(setup, /JsonStringValue\(ResponseBody, 'zabbixServer'\)/);
  assert.match(setup, /JsonStringValue\(ResponseBody, 'zabbixServerActive'\)/);
  assert.doesNotMatch(setup, /configuracao completa do OCS e Zabbix/);
  assert.match(setup, /FinalizeParameters :=/);
  assert.match(
    setup,
    /if\s+\(OcsServerUrl <> ''\) and\s+\(ZabbixServer <> ''\) and\s+\(ZabbixServerActive <> ''\)/
  );

  assert.match(postInstall, /New-ScheduledTaskPrincipal/);
  assert.match(postInstall, /-UserId "SYSTEM"/);
  assert.match(postInstall, /New-ScheduledTaskTrigger -AtStartup/);
  assert.match(postInstall, /ITGuardian\.exe/);
  assert.match(postInstall, /--collector/);
  assert.match(postInstall, /--once/);
  assert.match(postInstall, /CurrentVersion\\Run/);
  assert.match(postInstall, /--tray/);
  assert.match(postInstall, /configuredMonitoringValues\.Count -eq 3/);
  assert.match(postInstall, /configuracao de OCS e Zabbix recebida esta incompleta/);
  assert.match(setup, /SetupIconFile=it-guardian\.ico/);
  assert.match(setup, /UninstallDisplayIcon=\{app\}\\ITGuardian\.exe/);
  assert.match(setup, /Uninstallable=yes/);
  assert.match(setup, /Desinstalar IT Guardian/);
  assert.match(setup, /Filename: "\{uninstallexe\}"/);
  assert.match(uninstall, /Unregister-ScheduledTask/);
  assert.match(uninstall, /Stop-Process -Name "ITGuardian"/);
  assert.match(setup, /OCS-Windows-Agent-Setup-x64\.exe/);
  assert.match(setup, /zabbix_agent2-7\.0\.29-windows-amd64-openssl\.msi/);
  assert.match(setup, /OcsServerUrl/);
  assert.match(setup, /ZabbixServerActive/);
  assert.match(monitoringInstall, /STARTUPTYPE=automatic/);
  assert.match(monitoringInstall, /monitoring-agents\.json/);
  assert.match(monitoringInstall, /Get-AuthenticodeSignature/);
  assert.match(packageDownload, /Get-FileHash/);
  assert.match(packageDownload, /Get-AuthenticodeSignature/);
  assert.match(uninstall, /installedByItGuardian/);
});

test("coletor nao introduz primitivas de execucao remota", async () => {
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

  const nativeCollector = await readProjectFile(
    "agent",
    "windows",
    "ITGuardian.Windows.cs"
  );
  const nativeForbidden = [
    /\bProcess\.Start\b/,
    /\bcmd\.exe\b/i,
    /\bpowershell(?:\.exe)?\b/i,
    /\bCreateProcess\b/i,
    /\bShellExecute\b/i
  ];

  for (const pattern of nativeForbidden) {
    assert.doesNotMatch(nativeCollector, pattern);
  }
  assert.match(nativeCollector, /AssemblyProduct\("IT Guardian"\)/);
  assert.match(nativeCollector, /NotifyIcon/);
  assert.match(nativeCollector, /Text = "IT Guardian ativo"/);
});
