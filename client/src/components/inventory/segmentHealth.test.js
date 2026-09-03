import { describe, expect, it } from "vitest";
import { calculateSegmentHealth, describeSegmentHealth } from "./segmentHealth.js";

describe("saúde real do segmento", () => {
  it("não inventa nota quando não há telemetria", () => {
    const health = calculateSegmentHealth([{ id: "asset-1", status: "unknown", metrics: null }]);

    expect(health.score).toBeNull();
    expect(health.classification).toBe("no-data");
    expect(describeSegmentHealth(health)).toContain("Sem nota");
  });

  it("mantém nota máxima para máquinas monitoradas e saudáveis", () => {
    const health = calculateSegmentHealth([
      { id: "asset-1", status: "online", metrics: { cpu: 20, ram: 40, disk: 55 } },
      { id: "asset-2", status: "online", metrics: { cpu: 10, ram: 25, disk: 30 } }
    ]);

    expect(health.score).toBe(100);
    expect(health.classification).toBe("healthy");
    expect(health.observedAssets).toBe(2);
  });

  it("desconta indisponibilidade e métricas críticas observadas", () => {
    const health = calculateSegmentHealth([
      { id: "asset-1", status: "offline", metrics: { cpu: 10, ram: 20, disk: 95 } },
      { id: "asset-2", status: "online", metrics: { cpu: 92, ram: 20, disk: 40 } }
    ]);

    expect(health.score).toBe(75);
    expect(health.classification).toBe("attention");
    expect(health.deductions.map((item) => item.reason).join(" ")).toMatch(/offline|disco|CPU/);
  });

  it("expõe cobertura parcial sem tratar dado ausente como falha", () => {
    const health = calculateSegmentHealth([
      { id: "asset-1", status: "online", metrics: null },
      { id: "asset-2", status: "unknown", metrics: null }
    ]);

    expect(health.score).toBe(100);
    expect(health.observedAssets).toBe(1);
    expect(health.totalAssets).toBe(2);
    expect(describeSegmentHealth(health)).toContain("Cobertura: 1 de 2");
  });
});
