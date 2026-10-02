// Garante que toda variavel de ambiente lida pelo servidor esta documentada em server/.env.example
// (como `NOME=` ou em comentario `# NOME`). Variavel nova sem documentacao quebra o CI.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const sourceDir = path.join(root, "server", "src");
const examplePath = path.join(root, "server", ".env.example");

// Fornecidas pela plataforma/ferramentas, nao configuradas pelo operador.
const platformProvided = new Set([
  "NODE_ENV", "VERCEL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_REGION", "CI", "HOME", "PATH", "TZ", "USERPROFILE",
  "npm_package_version", "npm_lifecycle_event"
]);

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return /\.(js|mjs)$/.test(entry.name) && !/\.test\.(js|mjs)$/.test(entry.name) ? [full] : [];
  });
}

const used = new Map();
for (const file of listFiles(sourceDir)) {
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(/\b(?:process\.env|env)\??\.([A-Z][A-Z0-9_]{2,})\b/g)) {
    if (!used.has(match[1])) used.set(match[1], path.relative(root, file));
  }
  for (const match of text.matchAll(/\b(?:process\.env|env)\[\s*["']([A-Z][A-Z0-9_]{2,})["']\s*\]/g)) {
    if (!used.has(match[1])) used.set(match[1], path.relative(root, file));
  }
}

const example = fs.readFileSync(examplePath, "utf8");
const documented = new Set([...example.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]{2,})\s*=/gm)].map((m) => m[1]));
for (const match of example.matchAll(/#.*?\b([A-Z][A-Z0-9_]{3,})\b/g)) documented.add(match[1]);

const missing = [...used].filter(([name]) => !platformProvided.has(name) && !documented.has(name));
if (missing.length) {
  process.stderr.write("Variaveis de ambiente lidas pelo servidor e ausentes de server/.env.example:\n");
  for (const [name, file] of missing) process.stderr.write(`  - ${name} (${file})\n`);
  process.exit(1);
}
process.stdout.write(`Variaveis de ambiente documentadas: ${used.size} verificadas.\n`);
