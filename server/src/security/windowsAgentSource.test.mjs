import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const agentSource = await readFile(
  path.join(repositoryRoot, "agent/windows/it-guardian-agent.ps1"),
  "utf8"
);

test("agente Windows nao contem primitivas de execucao remota ou coleta invasiva", () => {
  const forbiddenPatterns = [
    /\bInvoke-Expression\b/i,
    /\bStart-Process\b/i,
    /\bAdd-Type\b/i,
    /\bGet-Clipboard\b/i,
    /\bGet-ChildItem\b/i,
    /\bGet-Content\s+.*Users/i,
    /\bSystem\.Windows\.Forms\b/i,
    /\bSendKeys\b/i,
    /\bDownloadString\b/i,
    /\bWebClient\b/i
  ];

  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(agentSource, pattern);
  }
  assert.match(agentSource, /Invoke-RestMethod/);
  assert.match(agentSource, /Get-CimInstance Win32_OperatingSystem/);
});
