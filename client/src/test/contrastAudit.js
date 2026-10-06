// Auditoria de contraste de texto no jsdom com as folhas de estilo REAIS do app.
//
// O jsdom nao resolve `var()` nem calcula cascata/heranca de forma confiavel, e o axe-core nao
// consegue medir `color-contrast` la. Este modulo faz uma cascata propria (especificidade + ordem
// + heranca) sobre o DOM renderizado, resolve os tokens do tema ativo (`data-theme` no <html>) e
// calcula a razao WCAG de cada texto visivel contra o fundo efetivo.
//
// Limites conhecidos (documentados em docs/FRONTEND-DESIGN-SYSTEM.md): ignora `@media`, estados
// (:hover/:focus/::before), `opacity`, imagens e sobreposicoes posicionadas; fundos em gradiente
// sao avaliados contra todas as cores do gradiente (pior caso) e reportados em `gradient: true`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composite, contrastRatio, readVariableBlocks, resolveColor, toHex } from "../../../scripts/lib/contrast.mjs";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let cachedRules = null;

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function matchingBrace(css, open) {
  let depth = 1;
  let index = open + 1;
  while (index < css.length && depth > 0) {
    if (css[index] === "{") depth += 1;
    else if (css[index] === "}") depth -= 1;
    index += 1;
  }
  return index;
}

function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth -= 1;
    if (char === separator && depth === 0) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  parts.push(current);
  return parts;
}

function parseDeclarations(body) {
  const declarations = [];
  for (const part of splitTopLevel(body, ";")) {
    const index = part.indexOf(":");
    if (index < 0) continue;
    const name = part.slice(0, index).trim().toLowerCase();
    let value = part.slice(index + 1).trim();
    const important = /!important\s*$/i.test(value);
    value = value.replace(/!important\s*$/i, "").trim();
    if (name) declarations.push({ name, value, important });
  }
  return declarations;
}

// Achata o CSS em regras simples; ignora @media/@supports/@keyframes/@font-face (ver "Limites").
function parseRules(css, rules, fileOrder) {
  const source = stripComments(css);
  let position = 0;
  let buffer = "";
  while (position < source.length) {
    const char = source[position];
    if (char === "{") {
      const selector = buffer.trim();
      const end = matchingBrace(source, position);
      buffer = "";
      if (!selector.startsWith("@")) {
        rules.push({ selector, declarations: parseDeclarations(source.slice(position + 1, end - 1)), order: rules.length, fileOrder });
      }
      position = end;
    } else if (char === ";" && !buffer.includes("{")) {
      buffer = "";
      position += 1;
    } else {
      buffer += char;
      position += 1;
    }
  }
  return rules;
}

function specificity(selector) {
  let text = selector.replace(/"[^"]*"|'[^']*'/g, "");
  let ids = 0;
  let classes = 0;
  let elements = 0;
  text = text.replace(/:where\([^)]*\)/g, "");
  text = text.replace(/:(?:not|is|has)\(([^)]*)\)/g, (_, inner) => {
    const nested = specificity(inner);
    ids += Math.floor(nested / 10000);
    classes += Math.floor((nested % 10000) / 100);
    elements += nested % 100;
    return "";
  });
  ids += (text.match(/#[\w-]+/g) || []).length;
  classes += (text.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+(?:\([^)]*\))?/g) || []).length;
  text = text.replace(/#[\w-]+|\.[\w-]+|\[[^\]]*\]|::?[\w-]+(?:\([^)]*\))?/g, " ");
  elements += (text.match(/(?:^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length;
  return ids * 10000 + classes * 100 + elements;
}

const stateful = /:(hover|focus|focus-visible|focus-within|active|visited|target|checked|indeterminate|placeholder-shown|first-letter|first-line)|::/;

function walkCss(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walkCss(full, files);
    else if (entry.name.endsWith(".css")) files.push(full);
  }
  return files;
}

export function loadAppStyles() {
  if (cachedRules) return cachedRules;
  const stylesDir = path.join(srcDir, "styles");
  const index = fs.readFileSync(path.join(stylesDir, "index.css"), "utf8");
  const ordered = [...index.matchAll(/@import "\.\/(.+?)";/g)].map((match) => path.join(stylesDir, match[1]));
  const components = walkCss(path.join(srcDir, "components")).sort();
  const rules = [];
  [...ordered, ...components].forEach((file, fileOrder) => parseRules(fs.readFileSync(file, "utf8"), rules, fileOrder));
  const tokens = fs.readFileSync(path.join(stylesDir, "tokens.css"), "utf8");
  const light = readVariableBlocks(tokens, /^:root$/);
  // Variaveis locais de componentes (ex.: --calendar-blue) entram como padrao global; os tokens vencem.
  const localVars = {};
  for (const file of components) Object.assign(localVars, readVariableBlocks(fs.readFileSync(file, "utf8"), /./));
  for (const [name, value] of Object.entries(localVars)) if (light[name] === undefined) light[name] = value;
  const expanded = [];
  for (const rule of rules) {
    for (const part of splitTopLevel(rule.selector, ",")) {
      const selector = part.trim().replace(/\s+/g, " ");
      if (!selector || stateful.test(selector)) continue;
      expanded.push({ ...rule, selector, specificity: specificity(selector) });
    }
  }
  const dark = { ...light, ...readVariableBlocks(tokens, /^:root\[data-theme="dark"\]$/) };
  cachedRules = { rules: expanded, light, dark };
  return cachedRules;
}

function rootPart(selector) {
  const parts = selector.split(/[\s>+~]+/).filter(Boolean);
  return parts[parts.length - 1] || selector;
}

const interesting = new Set(["color", "background", "background-color", "font-size", "font-weight", "display", "visibility"]);
const isInteresting = (name) => interesting.has(name) || name.startsWith("--");

function hasInterestingDeclaration(rule) {
  return rule.declarations.some((d) => isInteresting(d.name));
}

function lastCompoundMightMatch(selector, doc) {
  const compound = rootPart(selector);
  const classes = compound.match(/\.[\w-]+/g) || [];
  return classes.every((cls) => doc.querySelector(cls.replace(/([^\w.-])/g, "\\$1")) !== null);
}

function cascadeFor(element, styles) {
  const cached = styles.cache.get(element);
  if (cached) return cached;
  const winners = new Map();
  const consider = (name, value, important, spec, order) => {
    const key = name === "background-color" ? "background" : name;
    const rank = (important ? 1e12 : 0) + spec * 1e6 + order;
    const current = winners.get(key);
    if (!current || rank >= current.rank) winners.set(key, { value, rank, name });
  };
  for (const rule of styles.applicable) {
    let matches;
    try {
      matches = element.matches(rule.selector);
    } catch {
      continue;
    }
    if (!matches) continue;
    for (const d of rule.declarations) {
      if (isInteresting(d.name)) consider(d.name, d.value, d.important, rule.specificity, rule.order + rule.fileOrder * 1e5);
    }
  }
  const inline = element.getAttribute("style");
  if (inline) {
    for (const d of parseDeclarations(inline)) if (isInteresting(d.name)) consider(d.name, d.value, true, 99999, 1e9);
  }
  styles.cache.set(element, winners);
  return winners;
}

function prepare(doc, theme) {
  const { rules, light, dark } = loadAppStyles();
  const vars = theme === "dark" ? dark : light;
  const applicable = rules
    .filter((rule) => hasInterestingDeclaration(rule) && lastCompoundMightMatch(rule.selector, doc))
    .sort((a, b) => a.order + a.fileOrder * 1e5 - (b.order + b.fileOrder * 1e5));
  return { applicable, vars, cache: new WeakMap(), varCache: new WeakMap() };
}

function pixelSize(value, parentPx) {
  const text = String(value).trim();
  const number = parseFloat(text);
  if (/px$/.test(text)) return number;
  if (/rem$/.test(text)) return number * 16;
  if (/em$/.test(text)) return number * parentPx;
  if (/%$/.test(text)) return (number / 100) * parentPx;
  if (text.includes("calc(") || text.includes("var(")) return parentPx;
  return { small: 13, "x-small": 10, large: 18, medium: 16 }[text] || parentPx;
}

// Mapa de variaveis CSS efetivo de um elemento: tokens globais + `--x` herdados/declarados nos ancestrais.
function varsFor(element, styles) {
  const cached = styles.varCache.get(element);
  if (cached) return cached;
  const parent = element.parentElement && element.parentElement.nodeType === 1 ? varsFor(element.parentElement, styles) : styles.vars;
  let result = parent;
  for (const [key, winner] of cascadeFor(element, styles)) {
    if (!key.startsWith("--")) continue;
    if (result === parent) result = { ...parent };
    result[key] = winner.value;
  }
  styles.varCache.set(element, result);
  return result;
}

function resolveVarsInText(value, vars) {
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (full, name, fallback) => {
    if (vars[name] !== undefined) return resolveVarsInText(vars[name], vars);
    if (fallback !== undefined) return resolveVarsInText(fallback, vars);
    return full;
  });
}

function textColorOf(element, styles, state) {
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    const winner = cascadeFor(node, styles).get("color");
    if (!winner) continue;
    const value = winner.value.trim();
    if (value === "inherit" || value === "currentcolor") continue;
    try {
      return resolveColor(value, varsFor(node, styles));
    } catch {
      state.unresolved.add(`color: ${value}`);
      return null;
    }
  }
  return resolveColor("#000", styles.vars);
}

// Gradientes radiais costumam ter o pico de cor fora da caixa e dissipar antes de chegar ao texto:
// o pico entra com metade da opacidade (premissa documentada; linear usa todas as paradas por inteiro).
function extractGradientColors(value, vars, radial = false) {
  const resolved = resolveVarsInText(value, vars);
  const colors = [];
  const pattern = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|color-mix\((?:[^()]|\([^()]*\))*\)|\b(?:white|black)\b/g;
  for (const match of resolved.matchAll(pattern)) {
    try {
      const color = resolveColor(match[0], vars);
      colors.push(radial && color.a < 1 ? { ...color, a: color.a / 2 } : color);
    } catch {
      /* ignora */
    }
  }
  return colors;
}

// Fundo efetivo: lista de cores candidatas (1 = chapado; varias = gradiente).
function backgroundOf(element, styles, state) {
  const layers = [];
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    const winner = cascadeFor(node, styles).get("background");
    if (!winner) continue;
    const value = winner.value.trim();
    if (!value || value === "none" || value === "transparent" || value === "inherit") continue;
    const nodeVars = varsFor(node, styles);
    const resolvedText = resolveVarsInText(value, nodeVars);
    if (/gradient\(/.test(resolvedText) || /url\(/.test(resolvedText)) {
      const colors = extractGradientColors(value, nodeVars, /radial-gradient/.test(resolvedText));
      if (colors.length) {
        layers.push({ gradient: true, colors, node });
        if (colors.every((c) => c.a >= 0.99)) break;
        continue;
      }
      continue;
    }
    let color = null;
    try {
      const flat = /(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|color-mix\((?:[^()]|\([^()]*\))*\)|^[a-z]+$)/.exec(resolvedText);
      color = flat ? resolveColor(flat[1], nodeVars) : null;
    } catch {
      state.unresolved.add(`background: ${value}`);
    }
    if (!color || color.a === 0) continue;
    layers.push({ gradient: false, colors: [color], node });
    if (color.a >= 0.99) break;
  }
  // compoe de baixo para cima sobre o canvas branco
  let bases = [{ r: 255, g: 255, b: 255, a: 1 }];
  let gradient = false;
  for (const layer of layers.reverse()) {
    gradient ||= layer.gradient;
    const next = [];
    for (const color of layer.colors) for (const base of bases) next.push(composite(color, base));
    bases = next.length > 12 ? next.slice(0, 12) : next;
  }
  return { colors: bases, gradient };
}

function fontOf(element, styles) {
  const chain = [];
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) chain.unshift(node);
  let size = 16;
  let weight = 400;
  for (const node of chain) {
    const winners = cascadeFor(node, styles);
    const sizeWin = winners.get("font-size");
    if (sizeWin && sizeWin.value !== "inherit") size = pixelSize(resolveVarsInText(sizeWin.value, varsFor(node, styles)), size);
    const weightWin = winners.get("font-weight");
    if (weightWin && weightWin.value !== "inherit") {
      const raw = weightWin.value.trim();
      weight = raw === "bold" ? 700 : raw === "normal" ? 400 : parseInt(raw, 10) || weight;
    }
  }
  return { size, weight };
}

function isHidden(element, styles) {
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    if (node.hasAttribute("hidden")) return true;
    const winners = cascadeFor(node, styles);
    if (winners.get("display")?.value.trim() === "none") return true;
    const visibility = winners.get("visibility")?.value.trim();
    if (visibility === "hidden") return true;
    if (node.classList.contains("sr-only") || node.classList.contains("visually-hidden")) return true;
  }
  return false;
}

function describe(element) {
  const parts = [];
  for (let node = element; node && node.nodeType === 1 && parts.length < 3; node = node.parentElement) {
    const classes = [...node.classList].slice(0, 2).map((c) => `.${c}`).join("");
    parts.unshift(`${node.localName}${classes}`);
  }
  return parts.join(" > ");
}

/**
 * Mede o contraste de todo texto visivel dentro de `root` para o tema `theme` ("light"|"dark").
 * Retorna as falhas (ratio < minimo: 4.5, ou 3.0 para texto grande) e a lista completa medida.
 */
export function auditContrast(root = document.body, { theme = "light" } = {}) {
  const doc = root.ownerDocument;
  doc.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  const styles = prepare(doc, theme);
  const state = { unresolved: new Set() };
  const measured = [];
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const seen = new Set();
  for (let textNode = walker.nextNode(); textNode; textNode = walker.nextNode()) {
    const text = textNode.nodeValue.trim();
    const element = textNode.parentElement;
    if (!text || !element || seen.has(element)) continue;
    if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName)) continue;
    if (element.disabled || element.closest("[disabled]")) continue;
    if (isHidden(element, styles)) continue;
    seen.add(element);
    const fg = textColorOf(element, styles, state);
    if (!fg) continue;
    const background = backgroundOf(element, styles, state);
    const font = fontOf(element, styles);
    const large = font.size >= 24 || (font.size >= 18.66 && font.weight >= 700);
    const required = large ? 3 : 4.5;
    let worst = Infinity;
    let worstBg = background.colors[0];
    for (const bg of background.colors) {
      const ratio = contrastRatio(fg, bg);
      if (ratio < worst) {
        worst = ratio;
        worstBg = bg;
      }
    }
    measured.push({
      element: describe(element),
      text: text.slice(0, 48),
      fg: toHex(composite(fg, worstBg)),
      bg: toHex(worstBg),
      ratio: Math.round(worst * 100) / 100,
      required,
      gradient: background.gradient
    });
  }
  const failures = measured.filter((item) => item.ratio < item.required);
  return { failures, measured, unresolved: [...state.unresolved] };
}

export function resetContrastAuditCache() {
  cachedRules = null;
}

export function formatContrastFailures(failures) {
  return failures.map((f) => `${f.ratio} < ${f.required}${f.gradient ? " (gradiente)" : ""} ${f.fg} sobre ${f.bg} :: ${f.element} :: "${f.text}"`);
}
