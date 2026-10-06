import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { composite, contrastRatio, resolveColor } from "../../../scripts/lib/contrast.mjs";
import { auditContrast } from "./contrastAudit.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

afterEach(() => {
  document.body.innerHTML = "";
  delete document.documentElement.dataset.theme;
});

describe("scripts/lib/contrast.mjs", () => {
  it("calcula a razao WCAG conhecida (preto/branco = 21, cinza #767676 sobre branco ~ 4.54)", () => {
    expect(contrastRatio(resolveColor("#000"), resolveColor("#fff"))).toBeCloseTo(21, 5);
    expect(contrastRatio(resolveColor("#767676"), resolveColor("#fff"))).toBeCloseTo(4.54, 2);
  });

  it("resolve var(), color-mix() e transparencia", () => {
    const vars = { "--a": "#ff0000", "--b": "var(--a)" };
    expect(resolveColor("var(--b)", vars)).toMatchObject({ r: 255, g: 0, b: 0, a: 1 });
    const mixed = resolveColor("color-mix(in srgb, #000000 25%, #ffffff)", {});
    expect(Math.round(mixed.r)).toBe(191);
    expect(composite(resolveColor("rgba(0,0,0,0.5)"), resolveColor("#fff")).r).toBeCloseTo(127.5, 1);
  });

  it("falha explicitamente com variavel inexistente (nunca ignora em silencio)", () => {
    expect(() => resolveColor("var(--nao-existe)", {})).toThrow(/sem valor/);
  });
});

describe("auditContrast (cascata real no jsdom)", () => {
  it("reprova texto abaixo de 4.5:1 e aprova o restante, por tema", () => {
    document.body.innerHTML = `
      <section style="background:#ffffff">
        <p id="ruim" style="color:#999999">Texto cinza claro</p>
        <p id="bom" style="color:#222222">Texto escuro</p>
      </section>`;
    const { failures, measured } = auditContrast(document.body, { theme: "light" });
    expect(measured.length).toBe(2);
    expect(failures.map((f) => f.text)).toEqual(["Texto cinza claro"]);
    expect(failures[0].ratio).toBeLessThan(4.5);
  });

  it("usa os tokens do tema ativo (texto soft sobre a pagina)", () => {
    document.body.innerHTML = `<header class="topbar"><div><p>Última atualização: 10:00</p></div></header>`;
    for (const theme of ["light", "dark"]) {
      const { failures, measured } = auditContrast(document.body, { theme });
      expect(measured).toHaveLength(1);
      expect(failures).toEqual([]);
      expect(measured[0].ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("texto grande aceita 3:1", () => {
    document.body.innerHTML = `<h2 style="color:#808080;background:#fff;font-size:30px">Titulo grande</h2>`;
    const { failures, measured } = auditContrast(document.body, { theme: "light" });
    expect(measured[0].required).toBe(3);
    expect(failures).toEqual([]);
  });
});

describe("scripts/check-contrast.mjs", () => {
  it("passa com os tokens atuais", () => {
    const output = execFileSync("node", ["scripts/check-contrast.mjs"], { cwd: repoRoot, encoding: "utf8" });
    expect(output).toMatch(/check-contrast: OK/);
  });
});
