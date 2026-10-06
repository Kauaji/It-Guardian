import { describe, expect, it } from "vitest";
import {
  buildActiveAlerts,
  buildMetricAlert,
  buildResolvedAlerts,
  formatBytes,
  formatDate,
  formatDuration,
  getDiskHealth,
  getMemoryModules,
  getVisibleTabs,
  isMaintenanceSegmentName,
  normalizeSoftware
} from "./machineDetailsModel.js";

describe("machineDetailsModel", () => {
  it("formata datas, bytes e duração com fallback", () => {
    expect(formatDate(null)).toBe("Não informado");
    expect(formatDate("2026-01-02T10:00:00")).toMatch(/02\/01\/2026/);
    expect(formatBytes("x")).toBe("Não informado");
    expect(formatBytes(-1)).toBe("Não informado");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024 ** 3 * 2)).toBe("2.0 GB");
    expect(formatDuration(undefined)).toBe("Não informado");
    expect(formatDuration(null)).toBe("0 h");
    expect(formatDuration("abc")).toBe("Não informado");
    expect(formatDuration(3600 * 5)).toBe("5 h");
    expect(formatDuration(86400 * 2 + 7200)).toBe("2 d 2 h");
  });

  it("classifica alertas de métrica por limite", () => {
    expect(buildMetricAlert({ metric: "cpu", label: "CPU", value: null })).toBeNull();
    expect(buildMetricAlert({ metric: "cpu", label: "CPU", value: 69 })).toBeNull();
    expect(buildMetricAlert({ metric: "cpu", label: "CPU", value: 75 })).toMatchObject({ severity: "Atenção", limit: "70%" });
    expect(buildMetricAlert({ metric: "ram", label: "RAM", value: 90 })).toMatchObject({ severity: "Crítico", limit: "85%", id: "metric-ram" });
  });

  it("monta alertas ativos de métricas, ping, monitoramento e status de problema", () => {
    expect(buildActiveAlerts(null)).toEqual([]);
    const alerts = buildActiveAlerts({
      status: "offline", lastPingAt: "2026-01-01T00:00:00Z", metrics: { cpu: 90, ram: 10, disk: 80 },
      alerts: [{ id: "a", status: "active", severity: "critical", title: "T" }, { id: "b", status: "active", severity: "warning" }, { id: "c", status: "closed" }]
    });
    expect(alerts.map((alert) => alert.id)).toEqual(["metric-cpu", "metric-disk", "ping-offline", "a", "b"]);
    expect(alerts[3]).toMatchObject({ severity: "Crítico", description: "T", metric: "Monitoramento" });
    expect(alerts[4].severity).toBe("Atenção");
    expect(buildActiveAlerts({ status: "problem" })[0].id).toBe("monitoring-problem");
    expect(buildActiveAlerts({ status: "problem", metrics: { cpu: 99 } }).map((alert) => alert.id)).toEqual(["metric-cpu"]);
    expect(buildActiveAlerts({ status: "online" })).toEqual([]);
  });

  it("deriva alertas resolvidos do histórico", () => {
    const resolved = buildResolvedAlerts(
      { assetHistory: [{ id: "x", change: "Voltou ao normal", detectedAt: "d", field: "cpu", newValue: "10", oldValue: "90" }, { message: "outra coisa" }] },
      { changeHistory: [{ createdAt: "c", message: "Restaurado" }] }
    );
    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toMatchObject({ id: "x", metric: "cpu", value: "10", limit: "90", status: "Resolvido" });
    expect(resolved[1]).toMatchObject({ id: "c-Restaurado", metric: "Ativo", value: "Normal", limit: "Anterior", description: "Restaurado" });
    expect(buildResolvedAlerts(null, undefined)).toEqual([]);
  });

  it("normaliza softwares", () => {
    expect(normalizeSoftware("Chrome")).toEqual({ name: "Chrome", version: null, manufacturer: null, installedAt: null });
    expect(normalizeSoftware({ title: "Z", publisher: "P", installDate: "d", version: "1" })).toEqual({ name: "Z", version: "1", manufacturer: "P", installedAt: "d" });
    expect(normalizeSoftware(null).name).toBe("Software sem nome");
  });

  it("resolve a saúde do disco", () => {
    expect(getDiskHealth()).toBe("Não disponível");
    expect(getDiskHealth({ diskHealth: "OK" })).toBe("OK");
    expect(getDiskHealth({ smartHealth: { status: "Boa" } })).toBe("Boa");
    expect(getDiskHealth({ storageHealth: { value: "V" } })).toBe("V");
    expect(getDiskHealth({ smartStatus: { health: "H" } })).toBe("H");
    expect(getDiskHealth({ smartStatus: {} })).toBe("Não disponível");
    expect(getDiskHealth({ disks: [{ label: "x" }] })).toBe("Não disponível");
    expect(getDiskHealth({ disks: [{ healthPercent: 80 }] })).toBe("80%");
    expect(getDiskHealth({ disks: [{ health: "Boa" }] })).toBe("Boa");
    expect(getDiskHealth({ disks: [{ smartStatus: "S" }] })).toBe("S");
    expect(getDiskHealth({ disks: [{ status: "St" }] })).toBe("St");
  });

  it("detecta o segmento de manutenção sem acentos e filtra abas", () => {
    expect(isMaintenanceSegmentName("  Manutenção ")).toBe(true);
    expect(isMaintenanceSegmentName("Escritório")).toBe(false);
    expect(isMaintenanceSegmentName()).toBe(false);
    expect(getVisibleTabs(0, 0).map((tab) => tab.id)).not.toContain("alerts");
    expect(getVisibleTabs(1, 0).map((tab) => tab.id)).toContain("alerts");
    expect(getVisibleTabs(0, 2).map((tab) => tab.id)).toContain("alerts");
  });

  it("escolhe a lista de módulos de memória", () => {
    expect(getMemoryModules({ memoryModules: [1] })).toEqual([1]);
    expect(getMemoryModules({ memoryHealth: { moduleDetails: [2] } })).toEqual([2]);
    expect(getMemoryModules({})).toEqual([]);
  });
});
