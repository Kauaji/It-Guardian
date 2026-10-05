#!/usr/bin/env node
// Prova que a divisao de client/src/styles.css em client/src/styles/*.css preservou
// o conteudo e a ordem da cascata byte a byte.
//
// Como funciona:
//   1. client/src/styles.css deve conter apenas `@import "./styles/index.css";`.
//   2. client/src/styles/index.css lista `@import "./x.css";` na ordem de concatenacao.
//   3. A concatenacao crua (sem separadores) dos arquivos, nessa ordem, deve ter o mesmo
//      SHA-256 e tamanho do styles.css monolitico original (commit 99ece40).
//   4. Todo arquivo .css da pasta deve estar importado exatamente uma vez e ter chaves
//      balanceadas (nenhum bloco ou @media atravessa um corte).
//
// Ao editar CSS de proposito depois da divisao, o passo 3 deixa de valer. Atualize
// ORIGINAL_SHA256/ORIGINAL_BYTES apenas se essa for a intencao, ou remova a verificacao
// byte a byte e mantenha os passos 1, 2 e 4.
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ORIGINAL_COMMIT = "99ece40";
const ORIGINAL_SHA256 = "92782732eefb7dba4b8e896803c7a145ed86629f804431d4c18f336f06a5463b";
const ORIGINAL_BYTES = 440381;

const root = process.cwd();
const clientSrc = path.join(root, "client", "src");
const stylesDir = path.join(clientSrc, "styles");
const failures = [];
const fail = (message) => failures.push(message);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// Conta chaves ignorando strings e comentarios; devolve null se o balanco estiver correto.
function braceProblem(source) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      if (end < 0) return "comentario sem fechamento";
      i = end + 1;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth < 0) return "chave de fechamento sem abertura";
    }
  }
  return depth === 0 ? null : `${depth} chave(s) abertas no fim do arquivo`;
}

const entry = fs.readFileSync(path.join(clientSrc, "styles.css"), "utf8");
if (entry.trim() !== '@import "./styles/index.css";') {
  fail('client/src/styles.css deve conter apenas `@import "./styles/index.css";`');
}

const index = fs.readFileSync(path.join(stylesDir, "index.css"), "utf8");
const importLines = index.split("\n").filter((line) => line.trim() !== "");
const imported = [];
for (const line of importLines) {
  const match = line.match(/^@import "\.\/([\w.-]+\.css)";$/);
  if (!match) {
    fail(`index.css: linha inesperada: ${line}`);
    continue;
  }
  imported.push(match[1]);
}
if (new Set(imported).size !== imported.length) fail("index.css: arquivo importado mais de uma vez");

const onDisk = fs
  .readdirSync(stylesDir)
  .filter((name) => name.endsWith(".css") && name !== "index.css");
for (const name of onDisk) {
  if (!imported.includes(name)) fail(`${name} existe em styles/ mas nao esta em index.css`);
}

const parts = [];
for (const name of imported) {
  const file = path.join(stylesDir, name);
  if (!fs.existsSync(file)) {
    fail(`index.css importa ${name}, que nao existe`);
    continue;
  }
  const buffer = fs.readFileSync(file);
  const problem = braceProblem(buffer.toString("utf8"));
  if (problem) fail(`${name}: ${problem} (um bloco atravessa o corte)`);
  parts.push(buffer);
}

const joined = Buffer.concat(parts);
if (joined.length !== ORIGINAL_BYTES) {
  fail(`tamanho concatenado ${joined.length} != original ${ORIGINAL_BYTES}`);
}
if (sha256(joined) !== ORIGINAL_SHA256) {
  fail(`SHA-256 concatenado ${sha256(joined)} != original ${ORIGINAL_SHA256}`);
}

// Confirmacao extra contra o git, quando o commit de referencia estiver disponivel.
let gitChecked = false;
try {
  const original = execFileSync("git", ["show", `${ORIGINAL_COMMIT}:client/src/styles.css`], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"]
  });
  gitChecked = true;
  if (sha256(original) !== ORIGINAL_SHA256) fail("o hash fixado nao confere com o git");
  if (!original.equals(joined)) fail(`concatenacao difere de git show ${ORIGINAL_COMMIT}:client/src/styles.css`);
} catch {
  // Clone raso ou historico reescrito: o SHA-256 fixado continua sendo a prova.
}

if (failures.length > 0) {
  console.error("verify-css-split: FALHOU");
  for (const message of failures) console.error(` - ${message}`);
  process.exit(1);
}

console.log(
  `verify-css-split: IGUAL. ${imported.length} arquivos, ${joined.length} bytes, sha256 ${sha256(joined)}` +
    (gitChecked ? ` (conferido com git show ${ORIGINAL_COMMIT})` : " (git indisponivel, so hash fixado)")
);
