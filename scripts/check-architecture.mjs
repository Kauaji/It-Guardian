import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceRoots = ["client/src", "server/src"];
const extensions = [".js", ".jsx", ".mjs"];
const ignoredDirectories = new Set(["node_modules", "dist", "coverage"]);
const importPattern =
  /(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']/g;
const forbiddenServerPatterns = [
  { pattern: /\bchild_process\b/, label: "child_process" },
  { pattern: /\bexecFile\s*\(/, label: "execFile()" },
  { pattern: /\bexec\s*\(/, label: "exec()" },
  { pattern: /\bspawn\s*\(/, label: "spawn()" },
  { pattern: /\bshell\s*:\s*true\b/, label: "shell: true" },
  { pattern: /\bnew\s+Function\s*\(/, label: "new Function()" },
  { pattern: /\beval\s*\(/, label: "eval()" },
];

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) {
      return [];
    }

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listFiles(absolutePath);
    }

    return extensions.includes(path.extname(entry.name)) ? [absolutePath] : [];
  });
}

function resolveLocalImport(importer, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const candidate = path.resolve(path.dirname(importer), specifier);
  const candidates = [
    candidate,
    ...extensions.map((extension) => `${candidate}${extension}`),
    ...extensions.map((extension) => path.join(candidate, `index${extension}`)),
  ];
  return candidates.find((file) => fs.existsSync(file) && fs.statSync(file).isFile()) ?? null;
}

const files = sourceRoots.flatMap((sourceRoot) => listFiles(path.join(root, sourceRoot)));
const graph = new Map(files.map((file) => [file, []]));
const violations = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(importPattern)) {
    const dependency = resolveLocalImport(file, match[1]);
    if (dependency && graph.has(dependency)) {
      graph.get(file).push(dependency);
    }
  }

  if (
    file.startsWith(path.join(root, "server", "src")) &&
    !file.endsWith(".test.js") &&
    !file.endsWith(".test.mjs")
  ) {
    for (const rule of forbiddenServerPatterns) {
      if (rule.pattern.test(source)) {
        violations.push(`${path.relative(root, file)} uses forbidden ${rule.label}`);
      }
    }
  }
}

const visiting = new Set();
const visited = new Set();
const stack = [];
const cycles = [];

function visit(file) {
  if (visiting.has(file)) {
    const start = stack.indexOf(file);
    cycles.push([...stack.slice(start), file].map((item) => path.relative(root, item)));
    return;
  }
  if (visited.has(file)) {
    return;
  }

  visiting.add(file);
  stack.push(file);
  for (const dependency of graph.get(file) ?? []) {
    visit(dependency);
  }
  stack.pop();
  visiting.delete(file);
  visited.add(file);
}

for (const file of files) {
  visit(file);
}

if (cycles.length || violations.length) {
  for (const cycle of cycles) {
    console.error(`Circular dependency: ${cycle.join(" -> ")}`);
  }
  for (const violation of violations) {
    console.error(violation);
  }
  process.exitCode = 1;
} else {
  console.log(`Architecture check passed for ${files.length} source files.`);
}
