import { describe, expect, it } from "vitest";
import { resolveVisualization, widgetVisualizations } from "./widgetVisualizations.js";

describe("visualizações por semântica do dado", () => {
  it("permite partes de um todo em pizza/rosca, mas não soma percentuais de CPU diferentes", () => {
    expect(widgetVisualizations("asset_availability")).toContain("pie");
    expect(widgetVisualizations("alerts_by_severity")).toContain("donut");
    expect(widgetVisualizations("top_assets_cpu")).toEqual(["bars", "columns", "list"]);
  });

  it("oferece linha/área/colunas somente para séries temporais", () => {
    expect(widgetVisualizations("metric_history_cpu")).toEqual(["line", "area", "columns"]);
    expect(widgetVisualizations("asset_availability")).not.toContain("line");
  });

  it("mantém layouts antigos sem configuração e ignora tipo visual incompatível", () => {
    expect(resolveVisualization("metric_history_ram")).toBe("line");
    expect(resolveVisualization("top_assets_cpu", "pie")).toBe("bars");
    expect(resolveVisualization("asset_availability", "pie")).toBe("pie");
  });
});
