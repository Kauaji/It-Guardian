import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAlertsReport,
  buildAssetsReport,
  buildMonthlyReport,
  buildRemoteAssistanceReport,
  buildScriptsReport,
  buildServiceOrdersReport,
  buildSlaReport,
  deriveServiceOrderOrigin,
  inDateRange
} from "./reportBuilders.js";

const statusSettings = {
  statuses: [
    { id: "open", name: "Aberta", isInitial: true, isFinal: false },
    { id: "closed", name: "Finalizada", isInitial: false, isFinal: true }
  ],
  sla: { low: 72, medium: 48, high: 24, critical: 4, nearDuePercent: 20, nearDueMinHours: 2 }
};
const statusById = new Map(statusSettings.statuses.map((status) => [status.id, status]));

function fakeCalculateSla(order) {
  if (!order.slaDueAt) {
    return { dueAt: null, status: "not_applicable", remainingMinutes: null, breached: false, nearDue: false };
  }
  if (order.status === "closed") {
    const late = order.closedAt && new Date(order.closedAt) > new Date(order.slaDueAt);
    return { dueAt: order.slaDueAt, status: late ? "breached" : "resolved", remainingMinutes: null, breached: late, nearDue: false };
  }
  return { dueAt: order.slaDueAt, status: "on_track", remainingMinutes: 120, breached: false, nearDue: false };
}

test("deriveServiceOrderOrigin cobre as 4 origens, na mesma ordem de prioridade do client", () => {
  assert.equal(deriveServiceOrderOrigin({ preventivePlanId: "p1", source: "alert_suggestion" }), "preventive");
  assert.equal(deriveServiceOrderOrigin({ source: "alert_suggestion" }), "alert_suggestion");
  assert.equal(deriveServiceOrderOrigin({ source: "public_support_form" }), "public_support_form");
  assert.equal(deriveServiceOrderOrigin({}), "manual");
});

test("inDateRange inclui os limites e exclui datas fora do intervalo", () => {
  assert.equal(inDateRange("2026-08-15T12:00:00Z", "2026-08-01", "2026-08-31"), true);
  assert.equal(inDateRange("2026-08-01T00:00:00Z", "2026-08-01", "2026-08-31"), true);
  assert.equal(inDateRange("2026-08-31T23:59:59Z", "2026-08-01", "2026-08-31"), true);
  assert.equal(inDateRange("2026-07-31T23:59:59Z", "2026-08-01", "2026-08-31"), false);
  assert.equal(inDateRange("2026-09-01T00:00:01Z", "2026-08-01", "2026-08-31"), false);
});

test("SLA not_applicable nunca entra em nenhum percentual/bucket de aberta ou fechada", () => {
  const serviceOrders = [
    { id: "1", number: "OS-1", title: "Legado sem SLA", priority: "medium", status: "closed", createdAt: "2026-08-01T00:00:00Z", closedAt: "2026-08-02T00:00:00Z", slaDueAt: null },
    { id: "2", number: "OS-2", title: "Fechada no prazo", priority: "medium", status: "closed", createdAt: "2026-08-01T00:00:00Z", closedAt: "2026-08-02T00:00:00Z", slaDueAt: "2026-08-03T00:00:00Z" },
    { id: "3", number: "OS-3", title: "Fechada atrasada", priority: "high", status: "closed", createdAt: "2026-08-01T00:00:00Z", closedAt: "2026-08-05T00:00:00Z", slaDueAt: "2026-08-02T00:00:00Z" }
  ];

  const { summary } = buildSlaReport({ serviceOrders, statusSettings, calculateSla: fakeCalculateSla }, {});

  assert.equal(summary.notApplicableCount, 1);
  assert.equal(summary.applicableTotal, 2);
  assert.equal(summary.closed.resolved, 1);
  assert.equal(summary.closed.breachedClosed, 1);
  assert.equal(summary.closedCompliancePercent, 50);
});

test("buildServiceOrdersReport traduz status via statusById e nunca conta not_applicable como coluna separada", () => {
  const serviceOrders = [
    { id: "1", number: "OS-1", title: "A", status: "open", priority: "high", createdAt: "2026-08-05T00:00:00Z", source: null }
  ];
  const { rows } = buildServiceOrdersReport({ serviceOrders, deviceMap: new Map(), statusById }, {});
  assert.equal(rows[0].statusLabel, "Aberta");
  assert.equal(rows[0].originLabel, "Manual");
});

test("buildAssetsReport nunca mostra 0 para metrica ausente - fica null (indisponivel na UI)", () => {
  const devices = [
    { id: "a1", name: "PC-01", status: "online", assetType: "desktop", segmentName: "TI", metrics: { cpu: 40, ram: 55, disk: 70 } },
    { id: "a2", name: "PC-02", status: "online", assetType: "desktop", segmentName: "TI", source: "ocs", metrics: {} }
  ];
  const { rows } = buildAssetsReport({ devices, alerts: [] }, {});
  const withoutMetrics = rows.find((row) => row.id === "a2");
  assert.equal(withoutMetrics.cpuPercent, null);
  assert.equal(withoutMetrics.ramPercent, null);
  assert.equal(withoutMetrics.diskPercent, null);
});

test("buildAlertsReport nunca inclui vinculo com preventiva (nao existe no schema)", () => {
  const alerts = [
    { id: "al1", hostId: "a1", severity: "high", status: "active", firstSeenAt: "2026-08-01T00:00:00Z", type: "cpu", occurrencesCount: 2 }
  ];
  const { rows } = buildAlertsReport({ alerts, deviceMap: new Map() }, {});
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0], "preventivePlan"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0], "relatedPreventive"), false);
});

test("buildScriptsReport nunca expoe o conteudo completo do script, so os campos de excerto ja truncados", () => {
  const jobs = [
    {
      id: "j1",
      assetName: "PC-01",
      scriptName: "Limpeza de disco",
      riskLevel: "low",
      status: "succeeded",
      timeoutSeconds: 120,
      createdAt: "2026-08-01T00:00:00Z",
      claimedAt: "2026-08-01T00:00:10Z",
      completedAt: "2026-08-01T00:01:00Z",
      stdoutExcerpt: "ok",
      stderrExcerpt: ""
    }
  ];
  const { rows } = buildScriptsReport({ jobs }, {});
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0], "content"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0], "scriptContent"), false);
  assert.equal(rows[0].durationMinutes, 1);
});

test("buildRemoteAssistanceReport nunca inclui reconexoes ou qualidade media (nao persistidas)", () => {
  const sessions = [
    {
      id: "s1",
      assetName: "PC-01",
      technicianName: "Joao",
      status: "ended",
      connectionMode: "webrtc",
      requestedAt: "2026-08-01T00:00:00Z",
      startedAt: "2026-08-01T00:00:05Z",
      endedAt: "2026-08-01T00:10:05Z",
      endReason: "technician_ended"
    }
  ];
  const { rows, summary } = buildRemoteAssistanceReport({ sessions }, {});
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0], "reconnectCount"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0], "averageQuality"), false);
  assert.equal(rows[0].durationMinutes, 10);
  assert.equal(summary.averageDurationMinutes, 10);
});

test("buildMonthlyReport rotula a saude da infraestrutura como situacao atual, nao como medicao do periodo", () => {
  const { warnings } = buildMonthlyReport({
    devices: [],
    alerts: [],
    serviceOrders: [],
    statusSettings,
    systemMode: "simple",
    startDate: "2026-08-01",
    endDate: "2026-08-31"
  });
  assert.ok(warnings.some((warning) => /situacao atual|nao (e|eh) uma medicao historica/i.test(warning)));
});
