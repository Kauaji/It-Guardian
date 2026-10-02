#!/usr/bin/env node
// Mede o tamanho das funcoes JS/JSX (declaracoes `function`, arrow functions
// atribuidas a const e metodos de classe/objeto sao ignorados de proposito: o
// objetivo e achar "funcoes deus", nao policiar estilo).
//
// Uso:
//   node scripts/function-lengths.mjs [--over N] [--json] [--fail-over N] [caminho ...]
//   --over N       lista funcoes com mais de N linhas (padrao 150)
//   --fail-over N  sai com codigo 1 se existir funcao maior que N
//   --json         saida JSON
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const roots = [];
let over = 150;
let failOver = null;
let asJson = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--over") over = Number(args[++i]);
  else if (args[i] === "--fail-over") failOver = Number(args[++i]);
  else if (args[i] === "--json") asJson = true;
  else roots.push(args[i]);
}
if (!roots.length) roots.push("server/src", "client/src");

const results = [];
const declaration =
  /^\s*(export\s+)?(default\s+)?(async\s+)?function\s*\*?\s*([A-Za-z0-9_$]*)\s*\(/;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    scan(dir);
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) scan(full);
  }
}

function scan(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(declaration);
    if (!match) continue;
    let depth = 0;
    let started = false;
    let end = i;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") {
          depth++;
          started = true;
        } else if (ch === "}") depth--;
      }
      if (started && depth <= 0) {
        end = j;
        break;
      }
    }
    results.push({ file, name: match[4] || "(anonima)", line: i + 1, length: end - i + 1 });
  }
}

roots.forEach(walk);
results.sort((a, b) => b.length - a.length);
const offenders = results.filter((r) => r.length > over);

if (asJson) {
  console.log(JSON.stringify({ analyzed: results.length, over, offenders }, null, 2));
} else {
  console.log(`funcoes analisadas: ${results.length} | acima de ${over} linhas: ${offenders.length}`);
  for (const r of offenders) {
    console.log(`${String(r.length).padStart(5)}  ${r.name.padEnd(40)} ${r.file}:${r.line}`);
  }
}

if (failOver !== null && results.some((r) => r.length > failOver)) {
  console.error(`\nExistem funcoes com mais de ${failOver} linhas.`);
  process.exit(1);
}
