// Valida os workflows do GitHub Actions e demais YAML operacionais sem precisar rodar no GitHub:
//  1. todo YAML relevante parseia;
//  2. todo `npm run <script>` / `npm test` citado em um `run:` existe no package.json da raiz;
//  3. todo `node scripts/<arquivo>` citado existe;
//  4. cada job tem runs-on ou uses.
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const errors = [];
const rootScripts = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts || {};

const yamlFiles = [
  ...fs.readdirSync(path.join(root, ".github", "workflows")).map((name) => path.join(".github", "workflows", name)),
  ".github/dependabot.yml",
  "docker-compose.yml",
  "docker-compose.local.yml",
  "ops/prometheus/alerts.yml"
].filter((file) => fs.existsSync(path.join(root, file)));

for (const file of yamlFiles) {
  let doc;
  try {
    doc = parse(fs.readFileSync(path.join(root, file), "utf8"));
  } catch (error) {
    errors.push(`${file}: YAML invalido (${error.message.split("\n")[0]})`);
    continue;
  }
  if (!file.startsWith(".github/workflows/")) continue;

  for (const [jobName, job] of Object.entries(doc.jobs || {})) {
    if (!job["runs-on"] && !job.uses) errors.push(`${file}: job ${jobName} sem runs-on/uses`);
    for (const step of job.steps || []) {
      for (const line of String(step.run || "").split("\n")) {
        const npm = /\bnpm run ([\w:.-]+)/.exec(line);
        if (npm && !line.includes("--workspace") && !(npm[1] in rootScripts))
          errors.push(`${file}: job ${jobName} usa "npm run ${npm[1]}" que nao existe no package.json`);
        const script = /\bnode (scripts\/[\w./-]+\.m?js)/.exec(line);
        if (script && !fs.existsSync(path.join(root, script[1]))) errors.push(`${file}: job ${jobName} usa ${script[1]} que nao existe`);
      }
    }
  }
}

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`Workflows e YAML ok: ${yamlFiles.length} arquivos verificados.\n`);
