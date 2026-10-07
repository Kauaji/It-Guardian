import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeArchitecture, formatReport, hasProblems } from "./check-architecture.mjs";

// Cada teste monta uma arvore temporaria com server/src e analisa so ela.

function makeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "itg-arch-"));
  for (const [relative, content] of Object.entries(files)) {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

function analyze(files, known = []) {
  const root = makeTree(files);
  try {
    const result = analyzeArchitecture({ root, sourceRoots: ["server/src"], known });
    return { result, report: formatReport(result) };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const empty = "export const x = 1;\n";

test("arvore valida passa e conta os arquivos", () => {
  const { result } = analyze({
    "server/src/domain/rule.js": 'import { createHash } from "node:crypto";\nexport const x = createHash;\n',
    "server/src/repositories/repo.js": 'import { rule } from "../domain/rule.js";\nexport const r = rule;\n',
    "server/src/services/svc.js": 'import "../repositories/repo.js";\nexport const s = 1;\n',
    "server/src/controllers/ctrl.js": 'import "../services/svc.js";\nexport const c = 1;\n',
    "server/src/domain/rule.test.mjs": 'import "../repositories/repo.js";\n'
  });
  assert.equal(hasProblems(result), false);
  assert.equal(result.fileCount, 5);
  assert.equal(result.layerViolations.length, 0);
});

test("domain nao pode importar repositories, services, controllers, routes e middleware", () => {
  for (const layer of ["repositories", "services", "controllers", "routes", "middleware"]) {
    const { result, report } = analyze({
      "server/src/domain/rule.js": `import { x } from "../${layer}/a.js";\nexport const y = x;\n`,
      [`server/src/${layer}/a.js`]: empty
    });
    assert.equal(result.layerViolations.length, 1, layer);
    assert.match(report[0], new RegExp(`domain nao pode importar ${layer}`));
    assert.match(report[0], /server\/src\/domain\/rule\.js/);
  }
});

test("domain nao pode importar database.js nem config/environment.js", () => {
  const { result } = analyze({
    "server/src/domain/a.js": 'import { query } from "../database.js";\nexport const q = query;\n',
    "server/src/domain/b.js": 'import { getJwtSecret } from "../config/environment.js";\nexport const j = getJwtSecret;\n',
    "server/src/database.js": empty,
    "server/src/config/environment.js": empty
  });
  assert.deepEqual(result.layerViolations.map((entry) => entry.file).sort(), ["server/src/domain/a.js", "server/src/domain/b.js"]);
  assert.match(result.layerViolations[0].message, /database\.js|config\/environment\.js/);
});

test("domain nao pode usar fs, net, http nem child_process (com ou sem prefixo node:), mas crypto e permitido", () => {
  const { result } = analyze({
    "server/src/domain/a.js": 'import fs from "node:fs";\nimport { request } from "http";\nexport const a = [fs, request];\n',
    "server/src/domain/b.js": 'import net from "node:net";\nexport const b = net;\n',
    "server/src/domain/c.js": 'import { readFile } from "node:fs/promises";\nexport const c = readFile;\n',
    "server/src/domain/ok.js": 'import { randomUUID, createHash } from "node:crypto";\nexport const ok = [randomUUID, createHash];\n'
  });
  const flagged = result.layerViolations.map((entry) => `${entry.file}:${entry.import}`).sort();
  assert.deepEqual(flagged, [
    "server/src/domain/a.js:http",
    "server/src/domain/a.js:node:fs",
    "server/src/domain/b.js:node:net",
    "server/src/domain/c.js:node:fs/promises"
  ]);
});

test("importacao dinamica tambem e verificada", () => {
  const { result } = analyze({
    "server/src/domain/lazy.js": 'export async function f() { return import("../repositories/a.js"); }\n',
    "server/src/repositories/a.js": empty
  });
  assert.equal(result.layerViolations.length, 1);
  assert.equal(result.layerViolations[0].import, "../repositories/a.js");
});

test("repositories nao importa services, controllers, routes nem middleware", () => {
  for (const layer of ["services", "controllers", "routes", "middleware"]) {
    const { result } = analyze({
      "server/src/repositories/r.js": `export { x } from "../${layer}/a.js";\n`,
      [`server/src/${layer}/a.js`]: "export const x = 1;\n"
    });
    assert.equal(result.layerViolations.length, 1, layer);
    assert.match(result.layerViolations[0].message, new RegExp(`repositories nao pode importar ${layer}`));
  }
  const allowed = analyze({
    "server/src/repositories/r.js": 'import "../domain/d.js";\nimport "../database.js";\nimport "../config/environment.js";\n',
    "server/src/domain/d.js": empty,
    "server/src/database.js": empty,
    "server/src/config/environment.js": empty
  });
  assert.equal(allowed.result.layerViolations.length, 0);
});

test("services nao importa controllers, routes nem middleware, mas pode importar repositories e domain", () => {
  for (const layer of ["controllers", "routes", "middleware"]) {
    const { result } = analyze({
      "server/src/services/s.js": `import "../${layer}/a.js";\n`,
      [`server/src/${layer}/a.js`]: empty
    });
    assert.equal(result.layerViolations.length, 1, layer);
  }
  const allowed = analyze({
    "server/src/services/s.js": 'import "../repositories/r.js";\nimport "../domain/d.js";\nimport "../config/environment.js";\n',
    "server/src/repositories/r.js": empty,
    "server/src/domain/d.js": empty,
    "server/src/config/environment.js": empty
  });
  assert.equal(allowed.result.layerViolations.length, 0);
});

test("controllers nao importa repositories diretamente", () => {
  const { result, report } = analyze({
    "server/src/controllers/c.js": 'import { find } from "../repositories/r.js";\nexport const c = find;\n',
    "server/src/repositories/r.js": "export const find = 1;\n"
  });
  assert.equal(result.layerViolations.length, 1);
  assert.match(report[0], /controllers nao pode importar repositories/);
  assert.match(report[0], /knownViolations/);
  assert.equal(
    analyze({
      "server/src/controllers/c.js": 'import "../services/s.js";\n',
      "server/src/services/s.js": empty
    }).result.layerViolations.length,
    0
  );
});

test("arquivos de teste nao sao sujeitos as regras de camada", () => {
  const { result } = analyze({
    "server/src/domain/rule.test.mjs": 'import fs from "node:fs";\nimport "../repositories/r.js";\n',
    "server/src/repositories/r.js": empty
  });
  assert.equal(result.layerViolations.length, 0);
});

test("excecao conhecida e tolerada, violacao nova falha e excecao obsoleta falha", () => {
  const files = {
    "server/src/repositories/legacy.js": 'import "../services/old.js";\n',
    "server/src/services/old.js": empty,
    "server/src/repositories/fresh.js": empty
  };
  const known = [{ file: "server/src/repositories/legacy.js", import: "../services/old.js" }];

  const tolerated = analyze(files, known);
  assert.equal(hasProblems(tolerated.result), false);
  assert.equal(tolerated.result.tolerated, 1);

  const withNew = analyze({ ...files, "server/src/repositories/fresh.js": 'import "../services/old.js";\n' }, known);
  assert.equal(hasProblems(withNew.result), true);
  assert.deepEqual(
    withNew.result.layerViolations.map((entry) => entry.file),
    ["server/src/repositories/fresh.js"]
  );

  const obsolete = analyze({ ...files, "server/src/repositories/legacy.js": empty }, known);
  assert.equal(hasProblems(obsolete.result), true);
  assert.equal(obsolete.result.obsoleteExceptions.length, 1);
  assert.match(obsolete.report[0], /Excecao obsoleta em knownViolations: server\/src\/repositories\/legacy\.js/);
});

test("ciclos e primitivas proibidas continuam sendo detectados", () => {
  const cycle = analyze({
    "server/src/services/a.js": 'import "./b.js";\n',
    "server/src/services/b.js": 'import "./a.js";\n'
  });
  assert.equal(cycle.result.cycles.length, 1);
  assert.match(cycle.report[0], /Circular dependency: server\/src\/services\/(a|b)\.js -> /);

  const forbidden = analyze({
    "server/src/services/x.js": 'import { execFile } from "node:child_process";\nexport const x = execFile("ls");\n'
  });
  assert.equal(forbidden.result.violations.length >= 1, true);
  assert.match(forbidden.report.join("\n"), /child_process/);
});

test("o repositorio real passa na verificacao (sem excecoes pendentes)", () => {
  const result = analyzeArchitecture({ root: path.resolve(import.meta.dirname, "..") });
  assert.deepEqual(formatReport(result), []);
});
