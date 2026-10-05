import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const extensions = [".js", ".jsx", ".mjs"];
const ignoredDirectories = new Set(["node_modules", "dist", "coverage"]);
const importPattern =
  /(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']/g;
const dynamicImportPattern = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
const forbiddenServerPatterns = [
  { pattern: /\bchild_process\b/, label: "child_process" },
  { pattern: /\bexecFile\s*\(/, label: "execFile()" },
  // `regex.exec(...)` e legitimo; o exec() perigoso (child_process) ja e barrado pelo padrao child_process.
  { pattern: /(?<![.\w])exec\s*\(/, label: "exec()" },
  { pattern: /\bspawn\s*\(/, label: "spawn()" },
  { pattern: /\bshell\s*:\s*true\b/, label: "shell: true" },
  { pattern: /\bnew\s+Function\s*\(/, label: "new Function()" },
  { pattern: /\beval\s*\(/, label: "eval()" },
];

/**
 * Camadas do backend (server/src). Cada regra diz o que uma camada NAO pode
 * importar. `domain` e puro: sem banco, rede, env nem sistema de arquivos.
 * `node:crypto` e permitido no dominio.
 */
export const layerRules = {
  domain: {
    forbiddenLayers: ["repositories", "services", "controllers", "routes", "middleware"],
    // Arquivos de server/src (relativos a ele) que o dominio nao pode importar.
    forbiddenFiles: ["database.js", "config/environment.js", "config/remoteAssistanceConfig.js"],
    forbiddenBuiltins: [
      "fs", "fs/promises", "net", "http", "https", "http2", "dns", "tls", "dgram", "child_process", "worker_threads"
    ],
    reason: "domain deve ser puro (regras sem banco, rede, env ou arquivos)",
  },
  repositories: {
    forbiddenLayers: ["services", "controllers", "routes", "middleware"],
    reason: "repositories so fazem SQL e mapeamento; orquestracao pertence aos services",
  },
  services: {
    forbiddenLayers: ["controllers", "routes", "middleware"],
    reason: "services nao conhecem HTTP (controllers, routes, middleware)",
  },
  controllers: {
    forbiddenLayers: ["repositories"],
    reason: "controllers falam com services, nunca direto com repositories",
  },
};

/**
 * Excecoes conhecidas, explicitas e DECRESCENTES: cada entrada e um import de
 * camada que ja existia quando a regra foi criada. A lista e validada nos dois
 * sentidos: violacao nova (fora da lista) falha; excecao obsoleta (a violacao
 * deixou de existir) tambem falha, para a lista so poder encolher.
 *
 * Formato: { file: "server/src/...", import: "<especificador exato>" }.
 */
export const knownViolations = [];

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

function isTestFile(file) {
  return /\.test\.(js|mjs)$/.test(file);
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

/** Camada de um arquivo de server/src (primeiro diretorio) ou null. */
export function layerOf(serverSrc, file) {
  const relative = toPosix(path.relative(serverSrc, file));
  if (relative.startsWith("..")) return null;
  const [first, ...rest] = relative.split("/");
  return rest.length ? first : null;
}

function builtinName(specifier) {
  return specifier.startsWith("node:") ? specifier.slice(5) : specifier;
}

function collectSpecifiers(source) {
  const specifiers = [];
  for (const match of source.matchAll(importPattern)) specifiers.push(match[1]);
  for (const match of source.matchAll(dynamicImportPattern)) specifiers.push(match[1]);
  return [...new Set(specifiers)];
}

/** Violacoes de camada de um arquivo: lista de { file, import, message }. */
export function findLayerViolations({ root, serverSrc, file, source }) {
  const layer = layerOf(serverSrc, file);
  const rule = layer ? layerRules[layer] : null;
  if (!rule || isTestFile(file)) return [];

  const relativeFile = toPosix(path.relative(root, file));
  const violations = [];

  for (const specifier of collectSpecifiers(source)) {
    let message = null;

    if (!specifier.startsWith(".")) {
      if (rule.forbiddenBuiltins?.includes(builtinName(specifier))) {
        message = `${layer} nao pode importar "${specifier}" (${rule.reason})`;
      }
    } else {
      const target = resolveLocalImport(file, specifier);
      if (target) {
        const targetLayer = layerOf(serverSrc, target);
        const targetFile = toPosix(path.relative(serverSrc, target));
        if (targetLayer && rule.forbiddenLayers.includes(targetLayer)) {
          message = `${layer} nao pode importar ${targetLayer} ("${specifier}") - ${rule.reason}`;
        } else if (rule.forbiddenFiles?.includes(targetFile)) {
          message = `${layer} nao pode importar ${targetFile} ("${specifier}") - ${rule.reason}`;
        }
      }
    }

    if (message) violations.push({ file: relativeFile, import: specifier, message });
  }

  return violations;
}

/**
 * Analisa o repositorio: ciclos entre modulos locais, padroes proibidos no
 * servidor e dependencias entre camadas do backend.
 */
export function analyzeArchitecture({
  root = process.cwd(),
  sourceRoots = ["client/src", "server/src"],
  known = knownViolations,
} = {}) {
  const serverSrc = path.join(root, "server", "src");
  const files = sourceRoots
    .map((sourceRoot) => path.join(root, sourceRoot))
    .filter((directory) => fs.existsSync(directory))
    .flatMap((directory) => listFiles(directory));
  const graph = new Map(files.map((file) => [file, []]));
  const violations = [];
  const layerViolations = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const dependency = resolveLocalImport(file, match[1]);
      if (dependency && graph.has(dependency)) {
        graph.get(file).push(dependency);
      }
    }

    if (file.startsWith(serverSrc) && !isTestFile(file)) {
      for (const rule of forbiddenServerPatterns) {
        if (rule.pattern.test(source)) {
          violations.push(`${toPosix(path.relative(root, file))} uses forbidden ${rule.label}`);
        }
      }
      layerViolations.push(...findLayerViolations({ root, serverSrc, file, source }));
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];

  function visit(file) {
    if (visiting.has(file)) {
      const start = stack.indexOf(file);
      cycles.push([...stack.slice(start), file].map((item) => toPosix(path.relative(root, item))));
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

  const knownKeys = new Set(known.map((entry) => `${entry.file}\0${entry.import}`));
  const foundKeys = new Set(layerViolations.map((entry) => `${entry.file}\0${entry.import}`));
  const newLayerViolations = layerViolations.filter((entry) => !knownKeys.has(`${entry.file}\0${entry.import}`));
  const obsoleteExceptions = known.filter((entry) => !foundKeys.has(`${entry.file}\0${entry.import}`));

  return {
    fileCount: files.length,
    cycles,
    violations,
    layerViolations: newLayerViolations,
    tolerated: layerViolations.length - newLayerViolations.length,
    obsoleteExceptions,
  };
}

export function formatReport(result) {
  const lines = [];
  for (const cycle of result.cycles) {
    lines.push(`Circular dependency: ${cycle.join(" -> ")}`);
  }
  for (const violation of result.violations) {
    lines.push(violation);
  }
  for (const entry of result.layerViolations) {
    lines.push(`Violacao de camada: ${entry.file} -> ${entry.message}. ` +
      "Mova a chamada para a camada correta (ex.: um servico fino) ou, so se for grande demais, " +
      "registre em knownViolations (scripts/check-architecture.mjs).");
  }
  for (const entry of result.obsoleteExceptions) {
    lines.push(`Excecao obsoleta em knownViolations: ${entry.file} -> "${entry.import}" ` +
      "nao e mais uma violacao; remova-a da lista.");
  }
  return lines;
}

export function hasProblems(result) {
  return Boolean(
    result.cycles.length ||
      result.violations.length ||
      result.layerViolations.length ||
      result.obsoleteExceptions.length
  );
}

function main() {
  const result = analyzeArchitecture();
  if (hasProblems(result)) {
    for (const line of formatReport(result)) {
      console.error(line);
    }
    process.exitCode = 1;
    return;
  }

  const tolerated = result.tolerated ? ` (${result.tolerated} excecao(oes) conhecida(s) de camada)` : "";
  console.log(`Architecture check passed for ${result.fileCount} source files${tolerated}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
