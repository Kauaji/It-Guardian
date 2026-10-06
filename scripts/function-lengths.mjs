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
//   --max-file N   lista arquivos com mais de N linhas (padrao 700); ignora testes,
//                  migracoes, schema legado congelado e barris (so `export ... from`)
//   --fail-file N  sai com codigo 1 se existir arquivo (nao ignorado) acima de N linhas
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const roots = [];
let over = 150;
let failOver = null;
let asJson = false;
let maxFile = 700;
let failFile = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--max-file") maxFile = Number(args[++i]);
  else if (args[i] === "--fail-file") failFile = Number(args[++i]);
  else if (args[i] === "--over") over = Number(args[++i]);
  else if (args[i] === "--fail-over") failOver = Number(args[++i]);
  else if (args[i] === "--json") asJson = true;
  else roots.push(args[i]);
}
if (!roots.length) roots.push("server/src", "client/src");

const results = [];
const fileResults = [];
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

// Barril: arquivo cujo codigo e so reexportacao (`export ... from`), alem de comentarios.
function isBarrel(source) {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .trim();
  if (!code) return false;
  return code
    .split(/;\s*\n|;\s*$/)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .every((statement) => /^export\s+(\*|\{[^}]*\})\s*(as\s+\w+\s*)?from\s+["'][^"']+["']$/.test(statement));
}

function isExcludedFromFileLimit(file, source) {
  const normalized = file.split(path.sep).join("/");
  return (
    /\/migrations\//.test(normalized) ||
    /\/schema\/legacy\//.test(normalized) ||
    isBarrel(source)
  );
}

function scan(file) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");
  if (!isExcludedFromFileLimit(file, content)) {
    fileResults.push({ file, lines: content.endsWith("\n") ? lines.length - 1 : lines.length });
  }
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
fileResults.sort((a, b) => b.lines - a.lines);
const bigFiles = fileResults.filter((r) => r.lines > maxFile);

if (asJson) {
  console.log(JSON.stringify({ analyzed: results.length, over, offenders, maxFile, bigFiles }, null, 2));
} else {
  console.log(`funcoes analisadas: ${results.length} | acima de ${over} linhas: ${offenders.length}`);
  for (const r of offenders) {
    console.log(`${String(r.length).padStart(5)}  ${r.name.padEnd(40)} ${r.file}:${r.line}`);
  }
  console.log(`\narquivos analisados: ${fileResults.length} | acima de ${maxFile} linhas: ${bigFiles.length}`);
  for (const r of bigFiles) {
    console.log(`${String(r.lines).padStart(5)}  ${r.file}`);
  }
}

if (failOver !== null && results.some((r) => r.length > failOver)) {
  console.error(`\nExistem funcoes com mais de ${failOver} linhas.`);
  process.exit(1);
}

if (failFile !== null && fileResults.some((r) => r.lines > failFile)) {
  console.error(`\nExistem arquivos com mais de ${failFile} linhas.`);
  process.exit(1);
}
