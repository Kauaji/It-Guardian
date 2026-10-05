#!/usr/bin/env node
// Orcamento de tamanho do bundle do cliente. Rode depois de `npm run build`.
//
// Le client/dist/assets (e client/dist/index.html para saber o que carrega no inicio),
// mede o tamanho gzip de cada arquivo e falha (exit 1) se algum limite for excedido.
//
// Limites em kB gzip (1 kB = 1000 bytes, como o relatorio do `vite build`).
// Calibrados em 2026-10 contra o build atual com ~10% de folga:
//
//   medido hoje                              limite
//   index-*.js (entrada)        104,8        116   (pedido original: 130; apertado para 116)
//   vendor.js (react, router...) 104,0       115
//   vendor-charts (recharts)      90,5       100   (pedido original: 110)
//   vendor-three                 166,4       183   (pedido original: 190)
//   maior chunk lazy (FloorPlansModule) 53,6  60   (pedido original: 90)
//   JS inicial total (entrada + preload) 338,7 372
//   CSS total                     73,0        80   (pedido original: 110)
//
// Quando o orcamento estourar de proposito (funcionalidade nova justificada), suba o
// limite aqui no mesmo commit e explique o motivo; quando o bundle encolher, desca-o.
// Detalhes e como investigar estouros: docs/PERFORMANCE-FRONTEND.md.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";

const KB = 1000;

const BUDGET_KB = {
  entry: 116,
  initialVendor: 115,
  initialTotal: 372,
  lazyChunk: 60,
  css: 80,
  named: {
    "vendor-three": 183,
    "vendor-charts": 100
  }
};

const distDir = path.resolve(process.argv[2] ?? path.join("client", "dist"));
const assetsDir = path.join(distDir, "assets");

if (!fs.existsSync(assetsDir)) {
  console.error(`check-bundle-budget: ${assetsDir} nao existe. Rode \`npm run build\` antes.`);
  process.exit(2);
}

const gzipKb = (file) => zlib.gzipSync(fs.readFileSync(file)).length / KB;
// "vendor-three-CZFeAkhI.js" -> "vendor-three"; "index-BT7sQlTG.css" -> "index"
const chunkName = (fileName) => fileName.replace(/-[A-Za-z0-9_-]{8}\.(js|css)$/, "");

const html = fs.readFileSync(path.join(distDir, "index.html"), "utf8");
const initialFiles = new Set(
  [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((match) => match[1])
);
const entryFiles = new Set(
  [...html.matchAll(/<script[^>]+src="\/assets\/([^"]+\.js)"/g)].map((match) => match[1])
);

const files = fs.readdirSync(assetsDir);
const jsFiles = files.filter((name) => name.endsWith(".js"));
const cssFiles = files.filter((name) => name.endsWith(".css"));

const rows = [];
const failures = [];

function check(label, kind, actual, limit) {
  const ok = actual <= limit;
  rows.push({ label, kind, actual, limit, ok });
  if (!ok) {
    failures.push(`${label}: ${actual.toFixed(1)} kB gzip > limite ${limit} kB (${kind})`);
  }
}

let initialTotal = 0;
for (const name of jsFiles.sort()) {
  const size = gzipKb(path.join(assetsDir, name));
  const base = chunkName(name);
  const named = BUDGET_KB.named[base];
  const initial = initialFiles.has(name);
  if (initial) initialTotal += size;

  if (entryFiles.has(name)) check(name, "entrada", size, BUDGET_KB.entry);
  else if (named !== undefined) check(name, base, size, named);
  else if (initial) check(name, "vendor inicial", size, BUDGET_KB.initialVendor);
  else check(name, "chunk lazy", size, BUDGET_KB.lazyChunk);
}

if (entryFiles.size === 0) failures.push("index.html nao referencia nenhum script de entrada");
check("JS inicial (entrada + modulepreload)", "total", initialTotal, BUDGET_KB.initialTotal);

const cssTotal = cssFiles.reduce((sum, name) => sum + gzipKb(path.join(assetsDir, name)), 0);
check(`CSS total (${cssFiles.length} arquivos)`, "css", cssTotal, BUDGET_KB.css);

const width = Math.max(...rows.map((row) => row.label.length));
for (const row of rows) {
  const status = row.ok ? "ok  " : "FAIL";
  console.log(
    `${status} ${row.label.padEnd(width)}  ${row.actual.toFixed(1).padStart(6)} / ${String(row.limit).padStart(3)} kB gzip  [${row.kind}]`
  );
}

if (failures.length > 0) {
  console.error("\ncheck-bundle-budget: orcamento excedido");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log("\ncheck-bundle-budget: dentro do orcamento");
