import { describe, expect, it } from "vitest";
import { formatLength, metersToPx, pxToMeters } from "./unitConversion.js";

const PLAN = { gridSize: 25, metersPerGridCell: 0.5 };

describe("pxToMeters / metersToPx", () => {
  it("25px equivale a 0,5m na escala padrao (25px de grade = 0,5m)", () => {
    expect(pxToMeters(25, PLAN)).toBeCloseTo(0.5, 5);
    expect(metersToPx(0.5, PLAN)).toBeCloseTo(25, 5);
  });

  it("ida e volta preserva o valor original", () => {
    const originalPx = 137;
    expect(metersToPx(pxToMeters(originalPx, PLAN), PLAN)).toBeCloseTo(originalPx, 5);
  });

  it("sem plan, cai nos padroes (grid 25px, 0.5m por celula)", () => {
    expect(pxToMeters(25)).toBeCloseTo(0.5, 5);
  });

  it("escala diferente (1m por celula) resulta em conversao proporcional", () => {
    const doubleScalePlan = { gridSize: 25, metersPerGridCell: 1 };
    expect(pxToMeters(25, doubleScalePlan)).toBeCloseTo(1, 5);
  });
});

describe("formatLength", () => {
  it("abaixo de 1 metro, formata em centimetros arredondados", () => {
    expect(formatLength(0.85)).toBe("85 cm");
    expect(formatLength(0.3)).toBe("30 cm");
  });

  it("a partir de 1 metro, formata em metros com virgula decimal pt-BR", () => {
    expect(formatLength(3.2)).toBe("3,20 m");
    expect(formatLength(1)).toBe("1,00 m");
  });
});
