// Utilitarios de cor para a verificacao de contraste (WCAG 2.x) sem navegador.
// Cobrem o que os tokens do app usam: #hex, rgb()/rgba(), var(--x), color-mix(in srgb, ...) e
// transparencia composta sobre um fundo. Nao e um motor de CSS completo; valores que nao sabe
// interpretar geram erro explicito (para o par ser corrigido, nunca ignorado em silencio).

const NAMED = { white: "#ffffff", black: "#000000", transparent: "rgba(0,0,0,0)" };

export function parseHex(hex) {
  let value = hex.replace("#", "");
  if (value.length === 3 || value.length === 4) value = [...value].map((c) => c + c).join("");
  if (value.length !== 6 && value.length !== 8) throw new Error(`cor hex invalida: ${hex}`);
  const n = (i) => parseInt(value.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: value.length === 8 ? n(6) / 255 : 1 };
}

function splitArgs(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Resolve `value` para {r,g,b,a}. `vars` mapeia "--nome" -> valor CSS cru.
export function resolveColor(value, vars = {}, depth = 0) {
  if (depth > 20) throw new Error(`referencia circular em ${value}`);
  const text = String(value).trim();
  const lower = text.toLowerCase();
  if (NAMED[lower]) return resolveColor(NAMED[lower], vars, depth + 1);
  if (lower.startsWith("#")) return parseHex(lower);
  const varMatch = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(text);
  if (varMatch) {
    const [, name, fallback] = varMatch;
    if (vars[name] !== undefined) return resolveColor(vars[name], vars, depth + 1);
    if (fallback !== undefined) return resolveColor(fallback, vars, depth + 1);
    throw new Error(`variavel ${name} sem valor`);
  }
  const rgb = /^rgba?\((.+)\)$/i.exec(text);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
    const channel = (part) => (part.endsWith("%") ? (parseFloat(part) / 100) * 255 : parseFloat(part));
    const alpha = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    return { r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: alpha };
  }
  const mix = /^color-mix\(\s*in\s+srgb\s*,(.+)\)$/i.exec(text);
  if (mix) {
    const [first, second] = splitArgs(mix[1]).map((arg) => {
      const match = /^(.*?)(?:\s+(\d+(?:\.\d+)?)%)?$/.exec(arg.trim());
      return { color: resolveColor(match[1], vars, depth + 1), pct: match[2] === undefined ? undefined : parseFloat(match[2]) };
    });
    let p1 = first.pct;
    let p2 = second.pct;
    if (p1 === undefined && p2 === undefined) p1 = p2 = 50;
    else if (p1 === undefined) p1 = 100 - p2;
    else if (p2 === undefined) p2 = 100 - p1;
    const total = p1 + p2;
    const w1 = p1 / total;
    const w2 = p2 / total;
    const alpha = first.color.a * w1 + second.color.a * w2;
    const mixChannel = (key) => (first.color[key] * first.color.a * w1 + second.color[key] * second.color.a * w2) / (alpha || 1);
    return { r: mixChannel("r"), g: mixChannel("g"), b: mixChannel("b"), a: alpha * (total > 100 ? 1 : total / 100) };
  }
  throw new Error(`cor nao suportada: ${value}`);
}

// Compoe `fg` (pode ter alpha) sobre um fundo opaco.
export function composite(fg, bg) {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1
  };
}

function linear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance({ r, g, b }) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(fg, bg) {
  const opaqueBg = bg.a < 1 ? composite(bg, { r: 255, g: 255, b: 255, a: 1 }) : bg;
  const opaqueFg = fg.a < 1 ? composite(fg, opaqueBg) : fg;
  const l1 = luminance(opaqueFg);
  const l2 = luminance(opaqueBg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function toHex({ r, g, b }) {
  const part = (v) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

// --- leitura de blocos de variaveis do CSS -------------------------------------------------

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Retorna as declaracoes `--x: valor` do(s) bloco(s) cujo seletor casa `selectorPattern`
// (comparado ao seletor normalizado, sem espacos extras). Blocos repetidos se acumulam em ordem.
export function readVariableBlocks(css, selectorPattern) {
  const vars = {};
  const source = stripComments(css);
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of source.matchAll(blockRe)) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    if (!selectorPattern.test(selector)) continue;
    for (const decl of match[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) vars[decl[1]] = decl[2].trim();
  }
  return vars;
}
