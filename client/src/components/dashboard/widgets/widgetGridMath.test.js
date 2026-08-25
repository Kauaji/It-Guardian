import { describe, expect, it } from "vitest";
import { heightRows, reindexWidgetPositions, sortWidgetsByPosition, widgetGridStyle, widthColumns } from "./widgetGridMath.js";

describe("widthColumns / heightRows", () => {
  it("mapeia cada tier discreto para um numero de colunas/linhas fixo", () => {
    expect(widthColumns("s")).toBe(3);
    expect(widthColumns("m")).toBe(4);
    expect(widthColumns("l")).toBe(6);
    expect(widthColumns("xl")).toBe(12);
    expect(heightRows("s")).toBe(2);
    expect(heightRows("m")).toBe(4);
    expect(heightRows("l")).toBe(6);
  });

  it("cai num tier padrao seguro para um valor desconhecido, nunca quebra", () => {
    expect(widthColumns("gigante")).toBe(widthColumns("m"));
    expect(widthColumns(undefined)).toBe(widthColumns("m"));
    expect(heightRows("gigante")).toBe(heightRows("s"));
  });
});

describe("widgetGridStyle", () => {
  it("gera o span de coluna/linha a partir dos tiers do widget", () => {
    expect(widgetGridStyle({ w: "l", h: "m" })).toEqual({ gridColumn: "span 6", gridRow: "span 4" });
  });

  it("nao quebra com um widget sem w/h definidos", () => {
    expect(widgetGridStyle({})).toEqual({ gridColumn: "span 4", gridRow: "span 2" });
  });
});

describe("sortWidgetsByPosition", () => {
  it("ordena por y crescente, com x como desempate", () => {
    const widgets = [
      { id: "c", x: 0, y: 2 },
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 1, y: 0 }
    ];
    expect(sortWidgetsByPosition(widgets).map((w) => w.id)).toEqual(["a", "b", "c"]);
  });

  it("nao muta o array original", () => {
    const widgets = [{ id: "b", x: 0, y: 1 }, { id: "a", x: 0, y: 0 }];
    const sorted = sortWidgetsByPosition(widgets);
    expect(sorted).not.toBe(widgets);
    expect(widgets[0].id).toBe("b");
  });

  it("lida com uma lista vazia ou ausente", () => {
    expect(sortWidgetsByPosition([])).toEqual([]);
    expect(sortWidgetsByPosition(undefined)).toEqual([]);
  });
});

describe("reindexWidgetPositions", () => {
  it("reindexa y sequencialmente preservando a ordem recebida, com x sempre 0", () => {
    const widgets = [{ id: "a", x: 3, y: 9 }, { id: "b", x: 1, y: 4 }];
    expect(reindexWidgetPositions(widgets)).toEqual([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 0, y: 1 }
    ]);
  });
});
