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

  const configSection = setup.match(/ConfigJson :=([\s\S]*?)SaveStringToFile/)?.[1] || "";
  assert.doesNotMatch(configSection, /ProductKey|productKey/);
  assert.doesNotMatch(setup, /-ProductKey|-ActivationKey|-LicenseKey/i);
  assert.match(setup, /ProductKeyPage\.Values\[0\] := ''/);
  assert.match(setup, /Abrir chamado - IT Guardian/);
  assert.match(setup, /\/api\/collector\/activate/);

  assert.match(postInstall, /New-ScheduledTaskPrincipal/);
  assert.match(postInstall, /-UserId "SYSTEM"/);
  assert.match(postInstall, /New-ScheduledTaskTrigger -AtStartup/);
  assert.match(postInstall, /-Once/);
  assert.match(uninstall, /Unregister-ScheduledTask/);
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
});
