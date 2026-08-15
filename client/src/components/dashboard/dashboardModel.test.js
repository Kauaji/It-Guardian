import { describe, expect, it } from "vitest";
import {
  buildAlertTrend,
  criticalAlertsSubtitle,
  healthSubtitle,
  isSectionEmpty,
  offlineSubtitle,
  onlineSubtitle,
  overdueSubtitle
} from "./dashboardModel.js";

describe("buildAlertTrend", () => {
  it("mantem no maximo 6 pontos, do mais antigo para o mais recente", () => {
    const history = Array.from({ length: 9 }, (_, index) => ({
      severity: index % 2 === 0 ? "critical" : "warning"
    }));
    const trend = buildAlertTrend(history);
    expect(trend).toHaveLength(6);
    expect(trend[0].label).toBe("#1");
    expect(trend[5].label).toBe("#6");
  });

  it("marca critical e warning como flags mutuamente exclusivas", () => {
    const trend = buildAlertTrend([{ severity: "critical" }, { severity: "warning" }]);
    const critical = trend.find((point) => point.critical === 1);
    const warning = trend.find((point) => point.warning === 1);
    expect(critical.warning).toBe(0);
    expect(warning.critical).toBe(0);
  });

  it("lida com historico vazio ou ausente sem lancar erro", () => {
    expect(buildAlertTrend([])).toEqual([]);
    expect(buildAlertTrend(undefined)).toEqual([]);
  });
});

describe("subtitles do dashboard", () => {
  it("retorna string vazia quando overview esta ausente", () => {
    expect(onlineSubtitle(null)).toBe("");
    expect(offlineSubtitle(null)).toBe("");
    expect(criticalAlertsSubtitle(null)).toBe("");
    expect(overdueSubtitle(null)).toBe("");
  });

  it("onlineSubtitle mostra a razao de maquinas online sobre o total", () => {
    expect(onlineSubtitle({ onlineAssets: 8, totalAssets: 10 })).toBe("8 de 10 maquinas online");
  });

  it("offlineSubtitle soma offline e critico, e trata o caso zero", () => {
    expect(offlineSubtitle({ offlineAssets: 2, criticalAssets: 1 })).toBe("3 ativo(s) sem contato recente");
    expect(offlineSubtitle({ offlineAssets: 0, criticalAssets: 0 })).toBe("Nenhum ativo sem contato recente");
  });

  it("criticalAlertsSubtitle distingue zero alertas de algum alerta", () => {
    expect(criticalAlertsSubtitle({ criticalAlerts: 0 })).toBe("Nenhum alerta critico ativo");
    expect(criticalAlertsSubtitle({ criticalAlerts: 3 })).toBe("3 alerta(s) critico(s) ativo(s)");
  });

  it("overdueSubtitle avisa quando o dado ainda nao esta disponivel", () => {
    expect(overdueSubtitle({ overdueServiceOrdersAvailable: false })).toBe(
      "Depende de prazo/SLA persistido (ainda nao disponivel)"
    );
    expect(overdueSubtitle({ overdueServiceOrdersAvailable: true, overdueServiceOrders: 4 })).toBe(
      "4 ordem(ns) vencida(s)"
    );
  });

  it("healthSubtitle e um texto fixo, sem depender de overview", () => {
    expect(healthSubtitle()).toMatch(/ativos, alertas e ordens/);
  });
});

describe("isSectionEmpty", () => {
  it("trata nao-array como vazio", () => {
    expect(isSectionEmpty(null)).toBe(true);
    expect(isSectionEmpty(undefined)).toBe(true);
    expect(isSectionEmpty("x")).toBe(true);
  });

  it("distingue array vazio de array com itens", () => {
    expect(isSectionEmpty([])).toBe(true);
    expect(isSectionEmpty([1])).toBe(false);
  });
});
