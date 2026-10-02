import { describe, expect, it } from "vitest";
import { createAlertLookups } from "./alertLookups.js";
import {
  buildAutomatedPreventivePlanPayload,
  buildAutomationCreateRequest,
  buildDevicePreventiveInfo,
  buildManualPreventivePlanPayload,
  filterPreventiveOverview,
  getLastPreventiveForAsset,
  getPreventiveRowView,
  groupPreventiveOverview,
  mergeAutomationIndicators,
  orderPreventiveScripts,
  summarizePreventiveOverview
} from "./preventiveUtils.js";

const DAY = 86400000;
const NOW = Date.parse("2026-06-30T12:00:00.000Z");
const daysAgo = (days) => new Date(NOW - days * DAY).toISOString();

const devices = [
  { id: "d1", name: "PC-01", segmentId: "s1", statusLabel: "Online" },
  { id: "d2", name: "PC-02", segmentId: "s1", statusLabel: "Offline" },
  { id: "d3", name: "Servidor", segmentId: "s2", isBackup: true },
  { id: "d4", name: "Em reparo", segmentName: "Manutenção" }
];
const segments = [{ id: "s1", name: "Recepção", groupId: "g1" }, { id: "s2", name: "Servidores", groupId: "g1" }];
const lookups = createAlertLookups({ devices, segments, segmentGroups: [{ id: "g1", name: "Matriz" }], inventoryTabs: [] });

function info(device, overrides = {}) {
  return buildDevicePreventiveInfo(device, {
    lookups,
    alerts: [],
    preventivePlans: [],
    dueDays: 180,
    now: NOW,
    ...overrides
  });
}

describe("mergeAutomationIndicators", () => {
  it("combina indicadores do dispositivo com os planos da gestão, sem duplicar por plano", () => {
    const merged = mergeAutomationIndicators(
      [{ id: "d1", automationIndicators: [{ automationPlanId: "p1", planName: "antigo" }] }, { id: "d2" }],
      [{ assetId: "d1", plans: [{ id: "p1", planName: "novo" }, { id: "p2" }, {}] }]
    );

    expect(merged[0].automationIndicators).toEqual([{ id: "p1", planName: "novo" }, { id: "p2" }]);
    expect(merged[1].automationIndicators).toEqual([]);
  });

  it("aceita ausência de máquinas de gestão", () => {
    expect(mergeAutomationIndicators([{ id: "d1" }])[0].automationIndicators).toEqual([]);
  });
});

describe("getLastPreventiveForAsset", () => {
  it("devolve a preventiva mais recente e usa a data do ativo, do plano ou de criação", () => {
    const plans = [
      { id: "old", createdAt: daysAgo(100), assets: [{ assetId: "d1" }] },
      { id: "asset-date", createdAt: daysAgo(200), assets: [{ assetId: "d1", preparedAt: daysAgo(10) }] },
      { id: "other", createdAt: daysAgo(1), assets: [{ assetId: "d9" }] },
      { id: "sem-ativos", createdAt: daysAgo(1) }
    ];

    const last = getLastPreventiveForAsset(plans, "d1");

    expect(last.plan.id).toBe("asset-date");
    expect(last.date).toBe(daysAgo(10));
    expect(getLastPreventiveForAsset(plans, "nenhum")).toBeNull();
    expect(getLastPreventiveForAsset([], "d1")).toBeNull();
  });
});

describe("buildDevicePreventiveInfo", () => {
  it("marca máquinas sem preventiva", () => {
    const result = info(devices[0]);

    expect(result).toMatchObject({
      preventiveStatus: "no_preventive",
      preventiveStatusLabel: "Sem preventiva",
      urgency: 70,
      isOverdue: false,
      daysSinceLastPreventive: null,
      nextPreventiveDueAt: null,
      location: { groupName: "Matriz", segmentName: "Recepção" }
    });
    expect(result.badges).toEqual([{ label: "Sem preventiva", tone: "warning" }]);
  });

  it("calcula dias desde a última, vencimento e status em dia", () => {
    const result = info(devices[0], { preventivePlans: [{ id: "p", createdAt: daysAgo(30), assets: [{ assetId: "d1" }] }] });

    expect(result).toMatchObject({ preventiveStatus: "up_to_date", daysSinceLastPreventive: 30, urgency: 10, isOverdue: false });
    expect(result.nextPreventiveDueAt).toBe(new Date(NOW - 30 * DAY + 180 * DAY).toISOString());
    expect(result.badges[0]).toEqual({ label: "Preventiva em dia", tone: "ok" });
  });

  it("marca preventiva vencida quando passa do prazo", () => {
    const plans = [{ id: "p", createdAt: daysAgo(181), assets: [{ assetId: "d1" }] }];

    expect(info(devices[0], { preventivePlans: plans })).toMatchObject({ preventiveStatus: "overdue", isOverdue: true, urgency: 82 });
    expect(info(devices[0], { preventivePlans: plans, dueDays: 365 }).isOverdue).toBe(false);
  });

  it("eleva a urgência com avisos e marca crítica com aviso crítico", () => {
    const upToDate = [{ id: "p", createdAt: daysAgo(5), assets: [{ assetId: "d1" }] }];
    const warning = info(devices[0], { preventivePlans: upToDate, alerts: [{ id: "a", assetId: "d1", status: "active", severity: "warning" }] });
    const critical = info(devices[0], { preventivePlans: upToDate, alerts: [{ id: "a", assetId: "d1", status: "active", severity: "critical" }] });
    const resolved = info(devices[0], { preventivePlans: upToDate, alerts: [{ id: "a", assetId: "d1", status: "resolved" }] });

    expect(warning).toMatchObject({ urgency: 62, activeAlertsCount: 1, criticalAlertsCount: 0 });
    expect(warning.badges).toEqual([{ label: "Preventiva em dia", tone: "ok" }, { label: "1 aviso", tone: "warning" }]);
    expect(critical).toMatchObject({ preventiveStatus: "critical", preventiveStatusLabel: "Crítica", urgency: 100 });
    expect(critical.badges).toEqual([{ label: "Crítica", tone: "danger" }, { label: "1 aviso", tone: "danger" }]);
    expect(resolved.activeAlertsCount).toBe(0);
  });

  it("trata manutenção e backup", () => {
    const maintenance = info(devices[3]);
    const backup = info(devices[2]);
    const backupInMaintenance = info({ ...devices[2], maintenanceActive: true });

    expect(maintenance).toMatchObject({ isInMaintenance: true, urgency: 90 });
    expect(maintenance.badges).toContainEqual({ label: "Em manutenção", tone: "warning" });
    expect(backup).toMatchObject({ isBackup: true, urgency: 20 });
    expect(backup.badges).toContainEqual({ label: "Backup", tone: "neutral" });
    expect(backupInMaintenance.urgency).toBe(90);
    expect(info({ ...devices[0], maintenanceStatus: "active" }).isInMaintenance).toBe(true);
  });
});

describe("resumo, filtro e agrupamento", () => {
  const plans = [
    { id: "recent", name: "Plano recente", createdAt: daysAgo(5), assets: [{ assetId: "d1" }] },
    { id: "old", name: "Plano antigo", createdAt: daysAgo(400), assets: [{ assetId: "d2" }] }
  ];
  const alerts = [{ id: "a", assetId: "d1", status: "active", severity: "warning" }];
  const overview = devices.map((device) => info(device, { preventivePlans: plans, alerts }));

  it("resume as situações preventivas", () => {
    expect(summarizePreventiveOverview(overview)).toEqual({ withoutPreventive: 2, overdue: 1, upToDate: 1, withAlerts: 1 });
    expect(summarizePreventiveOverview([])).toEqual({ withoutPreventive: 0, overdue: 0, upToDate: 0, withAlerts: 0 });
  });

  it("filtra por status e ordena por urgência e nome", () => {
    const all = filterPreventiveOverview(overview, { search: "", filter: "all" });

    expect(all.map((item) => item.device.id)).toEqual(["d4", "d2", "d1", "d3"]);
    expect(filterPreventiveOverview(overview, { search: "", filter: "overdue" }).map((item) => item.device.id)).toEqual(["d2"]);
    expect(filterPreventiveOverview(overview, { search: "", filter: "up_to_date" }).map((item) => item.device.id)).toEqual(["d1"]);
    expect(filterPreventiveOverview(overview, { search: "", filter: "no_preventive" }).map((item) => item.device.id)).toEqual(["d4", "d3"]);
    expect(filterPreventiveOverview(overview, { search: "", filter: "alerts" }).map((item) => item.device.id)).toEqual(["d1"]);
    expect(filterPreventiveOverview(overview, { search: "", filter: "maintenance" }).map((item) => item.device.id)).toEqual(["d4"]);
    expect(filterPreventiveOverview(overview, { search: "", filter: "backup" }).map((item) => item.device.id)).toEqual(["d3"]);
  });

  it("busca sem diferenciar acentos ou caixa em nome, local, status e plano", () => {
    const ids = (search) => filterPreventiveOverview(overview, { search, filter: "all" }).map((item) => item.device.id);

    expect(ids("recepcao")).toEqual(["d2", "d1"]);
    expect(ids("PLANO ANTIGO")).toEqual(["d2"]);
    expect(ids("servidor")).toEqual(["d3"]);
    expect(ids("vencida")).toEqual(["d2"]);
    expect(ids("zzz")).toEqual([]);
  });

  it("agrupa por ambiente, grupo e segmento preservando a ordem", () => {
    const groups = groupPreventiveOverview(filterPreventiveOverview(overview, { search: "", filter: "all" }));

    expect(groups.map((group) => [group.groupName, group.segmentName, group.devices.length])).toEqual([
      ["Sem grupo", "Manutenção", 1],
      ["Matriz", "Recepção", 2],
      ["Matriz", "Servidores", 1]
    ]);
    expect(groups[1].devices.map((item) => item.device.id)).toEqual(["d2", "d1"]);
    expect(groupPreventiveOverview([])).toEqual([]);
  });
});

describe("getPreventiveRowView", () => {
  it("monta a última preventiva e o texto do próximo vencimento", () => {
    const view = getPreventiveRowView(
      info(devices[0], { preventivePlans: [{ id: "p", name: "Plano", createdAt: daysAgo(5), assets: [{ assetId: "d1" }] }] }),
      180
    );

    expect(view.lastPreventive).toMatchObject({ id: "p", name: "Plano", preparedAt: daysAgo(5), createdAt: daysAgo(5) });
    expect(view.nextPreventiveLabel).toMatch(/^Próxima sugerida: /);
    expect(view.hasPreventiveError).toBe(false);
  });

  it("explica o prazo quando não há preventiva anterior", () => {
    const view = getPreventiveRowView(info(devices[0]), 90);

    expect(view.lastPreventive).toBeNull();
    expect(view.nextPreventiveLabel).toBe("Vence após 90 dia(s) da primeira preventiva");
  });

  it("sinaliza erro por aviso crítico, selo de perigo ou status offline/erro", () => {
    const critical = info(devices[0], { alerts: [{ id: "a", assetId: "d1", status: "active", severity: "critical" }] });

    expect(getPreventiveRowView(critical, 180).hasPreventiveError).toBe(true);
    expect(getPreventiveRowView(info(devices[1]), 180).hasPreventiveError).toBe(true);
    expect(getPreventiveRowView(info({ id: "d9", status: "Erro de coleta" }), 180).hasPreventiveError).toBe(true);
    expect(getPreventiveRowView(info(devices[2]), 180).hasPreventiveError).toBe(false);
  });
});

describe("scripts e payloads", () => {
  const active = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("coloca as recomendadas primeiro e remove duplicatas", () => {
    expect(orderPreventiveScripts({ recommended: [{ id: "b" }], others: [{ id: "a" }, { id: "b" }] }, active).map((s) => s.id)).toEqual(["b", "a"]);
    expect(orderPreventiveScripts({ recommended: [], others: [] }, active).map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(orderPreventiveScripts({}, active)).toHaveLength(3);
  });

  it("monta o payload do plano manual", () => {
    expect(buildManualPreventivePlanPayload({ name: "Plano", assetIds: ["d1"], scriptIds: ["a"], riskAcknowledged: true })).toEqual({
      name: "Plano",
      description: "Plano preventivo registrado pela tela de Avisos.",
      source: "manual",
      notes: "",
      riskAcknowledged: true,
      assetIds: ["d1"],
      scriptIds: ["a"]
    });
  });

  it("monta o pedido do assistente de automação com resumo e contexto", () => {
    const request = buildAutomationCreateRequest({
      devices: [{ id: "d2", name: "PC-02" }, { id: "d1", hostname: "host-1" }],
      scripts: [{ id: "b", name: "B" }, { id: "a" }],
      riskScripts: [{ id: "b" }],
      planName: "",
      id: 7
    });

    expect(request.id).toBe(7);
    expect(request.defaults).toMatchObject({
      name: "Plano preventivo automatizado",
      description: "Automação criada a partir da seleção preventiva: PC-02, host-1.",
      defaultScriptIds: ["b", "a"],
      scopeType: "asset_list",
      scopeId: "",
      assetIds: ["d2", "d1"],
      context: { selectionKey: "d1:d2:|:a:b", assetCount: 2, assetNames: ["PC-02", "host-1"], scriptNames: ["B", "a"], riskCount: 1 }
    });
  });

  it("abrevia a descrição com mais de seis máquinas e trata seleção vazia", () => {
    const many = Array.from({ length: 8 }, (_, index) => ({ id: `d${index}`, name: `PC-${index}` }));

    expect(buildAutomationCreateRequest({ devices: many, scripts: [], riskScripts: [], planName: "X" }).defaults.description).toMatch(/PC-5\.\.\.\.$/);
    expect(buildAutomationCreateRequest({ devices: [], scripts: [], riskScripts: [], planName: "X" }).defaults.description).toBe(
      "Automação criada a partir do fluxo de preventivas."
    );
    expect(typeof buildAutomationCreateRequest({ devices: [], scripts: [], riskScripts: [], planName: "X" }).id).toBe("number");
  });

  it("monta o payload do plano automatizado sobrescrevendo escopo e scripts", () => {
    const payload = buildAutomatedPreventivePlanPayload({
      automationPayload: { name: "", description: "Desc", scopeType: "all", scopeId: "x", recurrenceType: "weekly" },
      planName: "Plano da seleção",
      devices: [{ id: "d1" }, {}],
      scripts: [{ id: "a" }]
    });

    expect(payload).toMatchObject({
      name: "Plano da seleção",
      description: "Desc",
      source: "automated",
      notes: "Desc",
      status: "prepared",
      riskAcknowledged: true,
      assetIds: ["d1"],
      scriptIds: ["a"]
    });
    expect(payload.automation).toMatchObject({
      enabled: true,
      name: "Plano da seleção",
      scopeType: "asset_list",
      scopeId: null,
      assetIds: ["d1"],
      defaultScriptIds: ["a"],
      recurrenceType: "weekly"
    });
    expect(
      buildAutomatedPreventivePlanPayload({ automationPayload: {}, planName: "", devices: [], scripts: [] }).name
    ).toBe("Plano preventivo automatizado");
  });
});
