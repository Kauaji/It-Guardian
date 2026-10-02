// Verifica a documentacao: (1) links relativos de markdown apontam para arquivos existentes (e ancora, quando houver);
// (2) todo docs/*.md esta listado em docs/README.md; (3) documentos historicos exibem o aviso de instantaneo;
// (4) as variaveis de ambiente documentadas estao em paridade com o codigo (check-env-docs).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const docsDir = path.join(root, "docs");
const errors = [];

function listMarkdown(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : listMarkdown(full);
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

const slug = (heading) =>
  heading.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 _-]/g, "").trim().replace(/ +/g, "-");

function anchorsOf(file) {
  const text = fs.readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  return new Set([...text.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)].map((m) => slug(m[1].replace(/[`*_]/g, ""))));
}

const files = [path.join(root, "README.md"), path.join(root, "SECURITY.md"), path.join(root, "CONTRIBUTING.md"), ...listMarkdown(docsDir)].filter((f) => fs.existsSync(f));

for (const file of files) {
  const text = fs.readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#|data:)/.test(target)) {
      if (target.startsWith("#") && !anchorsOf(file).has(target.slice(1))) errors.push(`${path.relative(root, file)}: ancora ${target} inexistente`);
      continue;
    }
    const [relative, anchor] = target.split("#");
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(relative));
    if (!fs.existsSync(resolved)) {
      errors.push(`${path.relative(root, file)}: link quebrado -> ${target}`);
    } else if (anchor && resolved.endsWith(".md") && !anchorsOf(resolved).has(anchor)) {
      errors.push(`${path.relative(root, file)}: ancora #${anchor} inexistente em ${relative}`);
    }
  }
}

const index = fs.readFileSync(path.join(docsDir, "README.md"), "utf8");
for (const name of fs.readdirSync(docsDir).filter((n) => n.endsWith(".md") && n !== "README.md")) {
  if (!index.includes(`(${name})`)) errors.push(`docs/${name} nao esta listado em docs/README.md`);
}

const historySection = index.split("## Histórico")[1] || "";
for (const [, name] of historySection.matchAll(/\]\(([A-Z0-9-]+\.md)\)/g)) {
  const text = fs.readFileSync(path.join(docsDir, name), "utf8");
  if (!/^>\s*\*\*Documento histórico/m.test(text.split("\n").slice(0, 6).join("\n"))) {
    errors.push(`docs/${name} e historico mas nao comeca com o aviso "> **Documento histórico**"`);
  }
}

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`Documentacao ok: ${files.length} arquivos markdown verificados.\n`);
execFileSync(process.execPath, [path.join(root, "scripts", "check-env-docs.mjs")], { stdio: "inherit" });
