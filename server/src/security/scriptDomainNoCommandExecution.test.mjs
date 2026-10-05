import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const srcRoot = fileURLToPath(new URL("..", import.meta.url));

// Modulos do dominio de scripts de manutencao e da fila do agente. O servidor
// nunca executa o conteudo dos scripts: so os cadastra, analisa e enfileira.
const scannedPaths = [
  "domain/maintenanceScripts",
  "domain/agentScriptJobs.js",
  "domain/agentPayload.js",
  "domain/agentPresence.js",
  "repositories/maintenanceScripts",
  "repositories/agentScriptJobs",
  "repositories/agents",
  "repositories/agentRepository.js",
  "services/maintenanceScripts",
  "services/maintenanceScriptService.js",
  "services/maintenanceScriptRecommendationService.js",
  "services/agentScriptJobService.js",
  "services/agentJobRollupService.js",
  "services/agentInventoryService.js",
  "services/agentService.js"
];

function collectSources(relativePath) {
  const absolute = join(srcRoot, relativePath);
  if (statSync(absolute).isFile()) return [absolute];
  return readdirSync(absolute)
    .filter((name) => name.endsWith(".js"))
    .map((name) => join(absolute, name));
}

const forbidden = [
  /\bchild_process\b/,
  /\bexec\s*\(/,
  /\bexecFile\s*\(/,
  /\bexecSync\s*\(/,
  /\bspawn\s*\(/,
  /shell\s*:\s*true/,
  /\beval\s*\(/,
  /new\s+Function\b|\bFunction\s*\(/
];

test("dominio de scripts e fila do agente nao usam primitivas de execucao de comandos", () => {
  const files = scannedPaths.flatMap(collectSources);
  assert.ok(files.length > 30, "o teste deve enxergar todos os modulos do dominio");

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${file} usa ${pattern}`);
    }
  }
});

test("SQL do dominio nao interpola valores em template literals", () => {
  const sqlDirectories = ["repositories/maintenanceScripts", "repositories/agentScriptJobs", "repositories/agents"];
  for (const file of sqlDirectories.flatMap(collectSources)) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\$\{/, `${file} interpola valores dentro de SQL`);
  }
});
