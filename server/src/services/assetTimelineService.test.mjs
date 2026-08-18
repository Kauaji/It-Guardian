import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAlertEvents,
  buildBackboneEvents,
  buildRemoteAssistanceEvents,
  buildServiceOrderEvents,
  buildSummary,
  isImportant,
  resolveBackboneCategory,
  resolveBackboneSeverity,
  withinPeriod
} from "./assetTimelineService.js";

test("buildServiceOrderEvents gera evento de abertura, fechamento e pecas", () => {
  const order = {
    id: "os-1",
    number: "0001",
    title: "Computador nao liga",
    priority: "high",
    status: "closed",
    requesterName: "Maria",
    assignedTechnicianName: "Joao",
    createdAt: "2026-01-01T10:00:00.000Z",
    closedAt: "2026-01-02T10:00:00.000Z",
    items: [{ id: "item-1", productName: "Fonte ATX", quantity: 1, createdAt: "2026-01-02T09:00:00.000Z" }]
  };

  const events = buildServiceOrderEvents("asset-1", [order]);

  assert.equal(events.length, 3);
  assert.equal(events[0].type, "service_order_created");
  assert.equal(events[0].severity, "warning");
  assert.equal(events[0].relatedEntityId, "os-1");
  assert.equal(events[1].type, "service_order_closed");
  assert.equal(events[1].severity, "success");
  assert.equal(events[2].category, "part");
  assert.equal(events[2].title, "Peça registrada na OS #0001");
});

test("buildServiceOrderEvents nao gera evento de fechamento sem closedAt", () => {
  const order = {
    id: "os-2",
    number: "0002",
    priority: "low",
    createdAt: "2026-01-01T10:00:00.000Z",
    closedAt: null,
    items: []
  };

  const events = buildServiceOrderEvents("asset-1", [order]);

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "service_order_created");
});

test("buildAlertEvents gera criado, reconhecido e resolvido quando aplicavel", () => {
  const alert = {
    id: "alert-1",
    title: "Disco critico",
    severity: "critical",
    firstSeenAt: "2026-01-01T10:00:00.000Z",
    status: "resolved",
    resolvedAt: "2026-01-01T12:00:00.000Z",
    acknowledgement: {
      acknowledgedAt: "2026-01-01T11:00:00.000Z",
      note: "Verificando",
      acknowledgedBy: { name: "Joao" }
    }
  };

  const events = buildAlertEvents("asset-1", [alert]);

  assert.equal(events.length, 3);
  assert.deepEqual(events.map((event) => event.type), ["alert_created", "alert_acknowledged", "alert_resolved"]);
  assert.equal(events[0].severity, "critical");
});

test("buildRemoteAssistanceEvents traduz o tipo do evento e nunca inclui metadata bruta", () => {
  const rawEvent = {
    id: "rae-1",
    sessionId: "session-1",
    eventType: "session_started",
    message: "Sessao iniciada",
    actorName: "Kauã",
    createdAt: "2026-01-01T10:00:00.000Z",
    metadata: { requestedMode: "control" }
  };

  const [event] = buildRemoteAssistanceEvents("asset-1", [rawEvent]);

  assert.equal(event.title, "Sessão de assistência remota iniciada");
  assert.equal(event.category, "remote_assistance");
  assert.equal(event.relatedEntityId, "session-1");
  assert.deepEqual(event.metadata, {});
});

test("resolveBackboneCategory mapeia prefixos conhecidos e cai em system por padrao", () => {
  assert.equal(resolveBackboneCategory("preventive_plan_prepared"), "preventive");
  assert.equal(resolveBackboneCategory("network_topology_node_added"), "topology");
  assert.equal(resolveBackboneCategory("maintenance_started"), "maintenance");
  assert.equal(resolveBackboneCategory("alias_changed"), "system");
});

test("resolveBackboneSeverity marca eventos de manutencao como warning nas duas direcoes", () => {
  // O backend grava um unico event_type "maintenance" tanto pra entrada
  // quanto pra saida - so a mensagem muda (ver deviceService.moveDeviceToSegment).
  assert.equal(resolveBackboneSeverity("maintenance", "maintenance"), "warning");
});

test("resolveBackboneSeverity marca preventivas e topologia como info, e o resto como neutral", () => {
  assert.equal(resolveBackboneSeverity("preventive_plan_prepared", "preventive"), "info");
  assert.equal(resolveBackboneSeverity("network_topology_node_added", "topology"), "info");
  assert.equal(resolveBackboneSeverity("alias", "system"), "neutral");
});

test("buildBackboneEvents exclui prefixos ja cobertos por builders dedicados", () => {
  const rows = [
    { id: "h1", eventType: "service_order_created", message: "OS criada", createdAt: "2026-01-01T00:00:00.000Z", oldValue: null, newValue: null, userName: null },
    { id: "h2", eventType: "remote_assistance_session_started", message: "Sessao", createdAt: "2026-01-01T00:00:00.000Z", oldValue: null, newValue: null, userName: null },
    { id: "h3", eventType: "maintenance", message: "Maquina colocada em manutencao", createdAt: "2026-01-01T00:00:00.000Z", oldValue: null, newValue: null, userName: "Joao" }
  ];

  const events = buildBackboneEvents("asset-1", rows);

  assert.equal(events.length, 1);
  assert.equal(events[0].id, "asset-history-h3");
  assert.equal(events[0].category, "maintenance");
});

test("withinPeriod filtra por janela de tempo relativa a agora", () => {
  const now = Date.now();
  const recent = { occurredAt: new Date(now - 1000).toISOString() };
  const old = { occurredAt: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString() };

  assert.equal(withinPeriod(recent, "7d"), true);
  assert.equal(withinPeriod(old, "7d"), false);
  assert.equal(withinPeriod(old, "all"), true);
});

test("isImportant ignora severidades info e neutral", () => {
  assert.equal(isImportant({ severity: "critical" }), true);
  assert.equal(isImportant({ severity: "warning" }), true);
  assert.equal(isImportant({ severity: "info" }), false);
  assert.equal(isImportant({ severity: "neutral" }), false);
});

test("buildSummary agrega contagens e ultima ocorrencia a partir dos eventos ja ordenados", () => {
  const events = [
    { type: "alert_created", category: "alert", severity: "critical", occurredAt: "2026-01-03T00:00:00.000Z" },
    { type: "service_order_created", category: "service_order", severity: "info", occurredAt: "2026-01-02T00:00:00.000Z" },
    { type: "service_order_closed", category: "service_order", severity: "success", occurredAt: "2026-01-01T12:00:00.000Z" },
    { type: "maintenance_started", category: "maintenance", severity: "warning", occurredAt: "2026-01-01T00:00:00.000Z" }
  ];

  const summary = buildSummary(events, { mapCount: 2 });

  assert.equal(summary.totalEvents, 4);
  assert.equal(summary.serviceOrdersOpened, 1);
  assert.equal(summary.serviceOrdersClosed, 1);
  assert.equal(summary.criticalAlerts, 1);
  assert.equal(summary.lastMaintenanceAt, "2026-01-01T00:00:00.000Z");
  assert.equal(summary.networkTopologyMapCount, 2);
  assert.equal(summary.lastEventAt, "2026-01-03T00:00:00.000Z");
});
