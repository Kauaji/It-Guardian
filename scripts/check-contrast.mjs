#!/usr/bin/env node
// Verifica o contraste (WCAG 2.x) dos pares texto/fundo declarados no design system, nos temas
// claro e escuro, SEM navegador: le os tokens de client/src/styles/tokens.css (`:root` e
// `:root[data-theme="dark"]`), resolve var()/color-mix()/transparencia e compara a razao com o
// minimo (4.5 texto normal; 3.0 texto grande e componentes de interface, WCAG 1.4.3 e 1.4.11).
//
// Complementa o teste vitest `client/src/a11y/contrast.a11y.test.jsx`, que mede os textos reais
// renderizados das telas com as folhas de estilo completas. Aqui ficam os pares "de contrato":
// se um token de cor de texto ou de superficie mudar, o par abaixo precisa continuar passando.
//
// Uso: node scripts/check-contrast.mjs [--verbose]
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { composite, contrastRatio, readVariableBlocks, resolveColor, toHex } from "./lib/contrast.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tokensFile = process.env.CONTRAST_TOKENS_FILE || path.join(root, "client", "src", "styles", "tokens.css");
const tokensCss = fs.readFileSync(tokensFile, "utf8");
const light = readVariableBlocks(tokensCss, /^:root$/);
const themes = {
  claro: light,
  escuro: { ...light, ...readVariableBlocks(tokensCss, /^:root\[data-theme="dark"\]$/) }
};

const NORMAL = 4.5;
const LARGE_OR_UI = 3.0;
const SURFACES = ["--surface", "--surface-soft", "--surface-muted", "--app-bg"];

// Pares explicitos: [rotulo, texto, fundo, minimo, (opcional) "sobre" = fundo opaco sob um fundo translucido].
const pairs = [];
const add = (label, fg, bg, min = NORMAL, over) => pairs.push({ label, fg, bg, min, over });
const tok = (name) => `var(${name})`;

// Texto principal, secundario, muted/eyebrow e soft (subtitulo da topbar) sobre pagina, card e superficies.
const textTokens = [
  ["texto principal", "--text"],
  ["texto forte", "--text-strong"],
  ["texto muted", "--text-muted"],
  ["texto soft (eyebrow/subtitulo, placeholder)", "--text-soft"]
];
for (const [label, name] of textTokens) {
  for (const surface of SURFACES) add(`${label} sobre ${surface.slice(2)}`, tok(name), tok(surface));
}
add("subtitulo da topbar (.topbar p) sobre a pagina", tok("--text-soft"), tok("--app-bg"));
add("placeholder (--text-soft) sobre campo", tok("--text-soft"), tok("--surface"));

// Links, acentos e textos de estado.
for (const [label, name] of [
  ["link/acento", "--accent"],
  ["acento forte", "--accent-strong"],
  ["texto info", "--text-info"],
  ["texto ok", "--text-ok"],
  ["texto aviso", "--text-warn"],
  ["texto erro", "--text-danger"]
]) {
  for (const surface of SURFACES) add(`${label} sobre ${surface.slice(2)}`, tok(name), tok(surface));
}
add("marca (--brand-ink) sobre card", tok("--brand-ink"), tok("--surface"));
add("marca (--brand-ink) sobre controle segmentado", tok("--brand-ink"), tok("--surface-muted"));

// Fundos tingidos usados com texto (abas ativas, pilulas, mensagens).
add("acento forte sobre aba ativa (12% acento)", tok("--accent-strong"), "color-mix(in srgb, var(--accent) 12%, var(--surface))");
add("texto info sobre mensagem info (8%)", tok("--text-info"), "color-mix(in srgb, var(--status-info) 8%, var(--surface))");
add("texto forte sobre mensagem info (8%)", tok("--text-strong"), "color-mix(in srgb, var(--status-info) 8%, var(--surface))");
add("texto forte sobre mensagem de erro (9%)", tok("--text-strong"), "color-mix(in srgb, var(--status-danger) 9%, var(--surface))");
add("texto erro sobre mensagem de erro (9%)", tok("--text-danger"), "color-mix(in srgb, var(--status-danger) 9%, var(--surface))");
add("texto soft sobre cartao tingido de aviso (14%)", tok("--text-warn"), "rgba(217, 119, 6, 0.14)", NORMAL, tok("--surface"));
add("texto ok sobre metrica ok (11%)", tok("--text-ok"), "rgba(22, 163, 74, 0.11)", NORMAL, tok("--surface-soft"));
add("texto erro sobre metrica erro (12%)", tok("--text-danger"), "rgba(220, 38, 38, 0.12)", NORMAL, tok("--surface-soft"));
add("texto aviso sobre metrica aviso (13%)", tok("--text-warn"), "rgba(217, 119, 6, 0.13)", NORMAL, tok("--surface-soft"));
add("texto muted sobre dia fora do mes/passado (agenda)", tok("--text-muted"), "color-mix(in srgb, var(--text-strong) 12%, var(--surface-soft))");
add("texto soft sobre cartao com gradiente suave", tok("--text-soft"), "color-mix(in srgb, var(--accent) 8%, var(--surface))");

// Botoes de acao primaria (texto sobre o acento) e sidebar.
add("texto de botao primario (--on-accent) sobre acento", tok("--on-accent"), tok("--primary-button-bg"));
add("texto de botao primario sobre hover", tok("--on-accent"), tok("--primary-button-hover"));
add("texto do toast de erro (branco sobre #c93d3d)", "#ffffff", "#c93d3d");
for (const bg of ["--sidebar-bg", "--sidebar-bg-2"]) {
  add(`sidebar: texto sobre ${bg.slice(2)}`, tok("--sidebar-text"), tok(bg));
  add(`sidebar: texto secundario sobre ${bg.slice(2)}`, tok("--sidebar-muted"), tok(bg));
}
add("skip-link (branco sobre slate-950)", "#ffffff", tok("--slate-950"));

// Componentes de interface e foco (>= 3:1, WCAG 1.4.11 e 2.4.11).
for (const surface of SURFACES) add(`anel de foco sobre ${surface.slice(2)}`, tok("--focus-outline"), tok(surface), LARGE_OR_UI);
for (const bg of ["--sidebar-bg", "--sidebar-bg-2"]) add(`anel de foco na sidebar (${bg.slice(2)})`, tok("--focus-outline-on-dark"), tok(bg), LARGE_OR_UI);
add("anel de foco do skip-link", tok("--focus-outline-on-dark"), tok("--slate-950"), LARGE_OR_UI);
add("borda de campo de formulario sobre card", tok("--control-border"), tok("--surface"), LARGE_OR_UI);
add("borda de campo de formulario sobre pagina", tok("--control-border"), tok("--app-bg"), LARGE_OR_UI);
add("icone/acento sobre card", tok("--accent"), tok("--surface"), LARGE_OR_UI);
add("icone info sobre card", tok("--status-info"), tok("--surface"), LARGE_OR_UI);
add("icone erro sobre card", tok("--status-danger"), tok("--surface"), LARGE_OR_UI);

const verbose = process.argv.includes("--verbose");
const failures = [];
let checked = 0;

function resolveWithOver(spec, vars, over) {
  const color = resolveColor(spec, vars);
  if (color.a >= 1) return color;
  const base = resolveColor(over || "var(--surface)", vars);
  return composite(color, base);
}

for (const [themeName, vars] of Object.entries(themes)) {
  for (const pair of pairs) {
    let ratio;
    let fgHex;
    let bgHex;
    try {
      const bg = resolveWithOver(pair.bg, vars, pair.over);
      const fg = resolveWithOver(pair.fg, vars, undefined);
      const flatFg = fg.a < 1 ? composite(fg, bg) : fg;
      ratio = contrastRatio(flatFg, bg);
      fgHex = toHex(flatFg);
      bgHex = toHex(bg);
    } catch (error) {
      failures.push(`[${themeName}] ${pair.label}: nao foi possivel resolver (${error.message})`);
      continue;
    }
    checked += 1;
    const ok = ratio >= pair.min;
    if (!ok) failures.push(`[${themeName}] ${pair.label}: ${ratio.toFixed(2)}:1 < ${pair.min}:1 (${fgHex} sobre ${bgHex})`);
    if (verbose || !ok) console.log(`${ok ? "ok  " : "FALHA"} [${themeName}] ${ratio.toFixed(2).padStart(5)} (min ${pair.min}) ${pair.label}  ${fgHex} / ${bgHex}`);
  }
}

if (failures.length > 0) {
  console.error(`\ncheck-contrast: ${failures.length} par(es) abaixo do minimo WCAG:`);
  for (const message of failures) console.error(` - ${message}`);
  process.exit(1);
}
console.log(`check-contrast: OK. ${checked} verificacoes (${pairs.length} pares x ${Object.keys(themes).length} temas) em ${path.relative(root, tokensFile)}.`);
