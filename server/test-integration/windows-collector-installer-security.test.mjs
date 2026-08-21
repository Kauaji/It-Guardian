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
  assert.match(setup, /O que voce deseja fazer\?/);
  assert.match(setup, /RepairModePage\.Add\('Instalar o IT Guardian'\)/);
  assert.match(setup, /RepairModePage\.Add\('Reparar o IT Guardian/);
  assert.match(setup, /RepairModePage\.Add\('Trocar a chave de produto/);
  assert.match(setup, /RepairModePage\.Add\('Desinstalar o IT Guardian'\)/);
  assert.match(setup, /IsRepairInstall/);
  assert.match(setup, /IsUninstallMode/);
  assert.match(setup, /LaunchExistingUninstaller/);
  assert.match(setup, /ExistingInstallDetected/);
  assert.match(setup, /ITGuardian-install-finalize\.log/);
  assert.match(setup, /JsonConfigStringValue\(ExistingConfig, 'agentToken'\)/);
  assert.match(setup, /if IsRepairInstall\(\) and ExistingConfigAvailable then/);
  assert.doesNotMatch(setup, /Install-MonitoringAgents|monitoring-agents\.json/);

  // A bandeja so consegue mostrar o dialogo de consentimento se o coletor
  // hospedar o pipe local, o que so acontece com enableRemoteAssistance
  // ligado -- sem uma forma de ligar essa flag pelo instalador, todo pedido
  // de assistencia remota ficava preso em "aguardando" sem nenhum aviso
  // aparecer na maquina (achado real, corrigido nesta rodada).
  assert.match(setup, /RemoteAssistancePage := CreateInputOptionPage/);
  assert.match(setup, /RemoteAssistancePage\.Add\('Habilitar assistencia remota nesta maquina \(enableRemoteAssistance\)'\)/);
  assert.match(setup, /\{param:EnableRemoteAssistance\|0\}/);
  assert.match(setup, /ShouldSkipRemoteAssistancePage/);
  assert.match(setup, /PreservedEnableRemoteAssistance := RemoteAssistancePage\.Values\[0\]/);
  assert.doesNotMatch(setup, /PreservedEnableRemoteAssistance := False;/);

  // "Trocar a chave de produto" reativa o token, mas nao pode reescrever config.json do
  // zero por cima de customizacoes locais (alias, ambiente, grupo, segmento, flags).
  assert.match(setup, /PreserveCustomization := \(SelectedMode\(\) = ModeChangeKey\) and ExistingConfigAvailable/);
  assert.match(setup, /JsonConfigStringValue\(ExistingConfig, 'machineAlias'\)/);
  assert.match(setup, /JsonConfigStringValue\(ExistingConfig, 'environment'\)/);
  assert.match(setup, /JsonConfigStringValue\(ExistingConfig, 'group'\)/);
  assert.match(setup, /JsonConfigStringValue\(ExistingConfig, 'segment'\)/);
  assert.match(setup, /JsonConfigBooleanValue\(ExistingConfig, 'includeLoggedUser', False\)/);
  assert.match(setup, /JsonConfigBooleanValue\(ExistingConfig, 'enableRemoteScriptExecution', False\)/);
  assert.match(setup, /JsonConfigBooleanValue\(ExistingConfig, 'enableRemoteAssistance', False\)/);
  assert.doesNotMatch(configSection, /"machineAlias": "",/);
  assert.doesNotMatch(configSection, /"includeLoggedUser": false,/);

  assert.match(postInstall, /New-ScheduledTaskTrigger -AtStartup/);
  assert.match(postInstall, /New-ScheduledTaskTrigger -AtLogOn/);
  // Uma rodada anterior tentou rodar o coletor sob uma conta de servico
  // dedicada (Administradores, nao SYSTEM) para reduzir superficie. Em teste
  // real numa maquina Windows real, tanto Register-ScheduledTask quanto
  // schtasks.exe falharam de forma persistente ao resolver essa conta local
  // recem-criada (HRESULT 0x80070534/ERROR_NONE_MAPPED), mesmo apos retries
  // com espera crescente e um reboot completo. Revertido para SYSTEM (a
  // configuracao anterior, ja validada em producao) ate a causa ser
  // diagnosticada com acesso administrativo mais profundo -- funcionar de
  // verdade importa mais agora do que a reducao de superficie.
  assert.doesNotMatch(postInstall, /New-LocalUser/);
  assert.doesNotMatch(postInstall, /\$collectorAccountName/);
  assert.match(postInstall, /Register-ScheduledTask/);
  assert.match(postInstall, /New-ScheduledTaskPrincipal/);
  assert.match(postInstall, /-UserId "SYSTEM"/);
  assert.match(postInstall, /-LogonType ServiceAccount/);
  assert.match(postInstall, /-RunLevel Highest/);
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
  assert.match(postInstall, /durableInstallLogPath/);
  assert.match(postInstall, /for \(\$attempt = 1; \$attempt -le 3; \$attempt\+\+\)/);
  assert.match(postInstall, /Start-Process[\s\S]*-Wait[\s\S]*-PassThru/);
  assert.match(postInstall, /\$heartbeatProcess\.ExitCode/);
  assert.doesNotMatch(postInstall, /if \(\$LASTEXITCODE -eq 0\)/);
  assert.match(postInstall, /S-1-5-32-545/);
  assert.match(postInstall, /ContainerInherit,ObjectInherit/);
  assert.match(postInstall, /A tarefa resiliente continuara tentando sem cancelar a instalacao/);
  assert.doesNotMatch(postInstall, /throw "O primeiro heartbeat do coletor falhou\."/);
  assert.match(uninstall, /Unregister-ScheduledTask/);
  assert.match(uninstall, /Stop-Process -Name "ITGuardian"/);
  assert.match(uninstall, /Remove-LocalUser -Name \$collectorAccountName/);
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

test("pipe local da assistencia remota nao aceita qualquer usuario autenticado da maquina", async () => {
  const remoteAssistance = await readProjectFile(
    "agent",
    "windows",
    "ITGuardian.RemoteAssistance.cs"
  );
  assert.doesNotMatch(remoteAssistance, /WellKnownSidType\.AuthenticatedUserSid/);
  assert.match(remoteAssistance, /WellKnownSidType\.InteractiveSid/);
  assert.match(remoteAssistance, /WellKnownSidType\.LocalSystemSid,\s*null\),\s*\n\s*PipeAccessRights\.FullControl/);
  assert.match(remoteAssistance, /WellKnownSidType\.BuiltinAdministratorsSid,\s*null\),\s*\n\s*PipeAccessRights\.FullControl/);
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
  assert.match(nativeCollector, /AgentVersion = "1\.6\.3"/);
  assert.match(nativeCollector, /Falhas de telemetria local nunca podem encerrar o coletor/);
});
