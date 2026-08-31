import { describe, expect, it } from "vitest";
import { formatPercentage, resolveVisualization, widgetVisualizations } from "./widgetVisualizations.js";

describe("visualizações por semântica do dado", () => {
  it("permite partes de um todo em pizza/rosca, mas não soma percentuais de CPU diferentes", () => {
    expect(widgetVisualizations("asset_availability")).toContain("pie");
    expect(widgetVisualizations("alerts_by_severity")).toContain("donut");
    expect(widgetVisualizations("top_assets_cpu")).toEqual(["columns", "bars", "list"]);
  });

  it("oferece linha/área/colunas somente para séries temporais", () => {
    expect(widgetVisualizations("metric_history_cpu")).toEqual(["line", "area", "columns"]);
    expect(widgetVisualizations("asset_availability")).not.toContain("line");
  });

  it("mantém layouts antigos sem configuração e ignora tipo visual incompatível", () => {
    expect(resolveVisualization("metric_history_ram")).toBe("line");
    expect(resolveVisualization("top_assets_cpu", "pie")).toBe("columns");
    expect(resolveVisualization("asset_availability", "pie")).toBe("pie");
  });

  it("usa uma assinatura visual diferente para cada ranking padrão", () => {
    expect(resolveVisualization("top_assets_cpu")).toBe("columns");
    expect(resolveVisualization("top_assets_ram")).toBe("radial");
    expect(resolveVisualization("top_assets_disk")).toBe("heatmap");
  });

  it("formata percentuais sem dividir por zero ou propagar dados inválidos", () => {
    expect(formatPercentage(1, 3)).toBe("33,3%");
    expect(formatPercentage(6, 6)).toBe("100%");
    expect(formatPercentage(0, 0)).toBe("0%");
    expect(formatPercentage("invalido", 6)).toBe("0%");
  });
});
