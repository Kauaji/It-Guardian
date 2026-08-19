import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateServiceOrderSla,
  computeServiceOrderSlaDueAt,
  defaultServiceOrderStatuses,
  SLA_STATUSES
} from "./serviceOrderRepository.js";

const settings = {
  statuses: defaultServiceOrderStatuses,
  sla: { low: 72, medium: 48, high: 24, critical: 4, nearDuePercent: 20, nearDueMinHours: 2 }
};

function isoHoursFromNow(hours, now = new Date()) {
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

test("computeServiceOrderSlaDueAt soma as horas configuradas para a prioridade ao inicio informado", () => {
  const start = "2026-08-18T10:00:00.000Z";
  assert.equal(computeServiceOrderSlaDueAt("critical", settings, start), "2026-08-18T14:00:00.000Z");
  assert.equal(computeServiceOrderSlaDueAt("low", settings, start), "2026-08-21T10:00:00.000Z");
});

test("computeServiceOrderSlaDueAt retorna null sem prazo configurado ou data invalida", () => {
  const semSla = { statuses: defaultServiceOrderStatuses, sla: { ...settings.sla, critical: 0 } };
  assert.equal(computeServiceOrderSlaDueAt("critical", semSla, "2026-08-18T10:00:00.000Z"), null);
  assert.equal(computeServiceOrderSlaDueAt("critical", settings, "data-invalida"), null);
});

test("calculateServiceOrderSla retorna not_applicable quando a OS nao tem sla_due_at", () => {
  const order = { status: "open", priority: "critical", slaDueAt: null };
  const sla = calculateServiceOrderSla(order, settings);
  assert.equal(sla.status, SLA_STATUSES.NOT_APPLICABLE);
  assert.equal(sla.breached, false);
  assert.equal(sla.nearDue, false);
  assert.equal(sla.remainingMinutes, null);
});

test("calculateServiceOrderSla marca on_track quando falta bem mais que a janela de proximidade", () => {
  const now = new Date("2026-08-18T10:00:00.000Z");
  const order = { status: "open", priority: "low", slaDueAt: isoHoursFromNow(70, now) };
  const sla = calculateServiceOrderSla(order, settings, now);
  assert.equal(sla.status, SLA_STATUSES.ON_TRACK);
  assert.equal(sla.remainingMinutes, 70 * 60);
});

test("calculateServiceOrderSla aplica a regra dos 20% do prazo restante", () => {
  const now = new Date("2026-08-18T10:00:00.000Z");
  // Prazo total de 72h (baixa); 20% disso = 14.4h restantes ja conta como near_due.
  const order = { status: "open", priority: "low", slaDueAt: isoHoursFromNow(14, now) };
  const sla = calculateServiceOrderSla(order, settings, now);
  assert.equal(sla.status, SLA_STATUSES.NEAR_DUE);
  assert.equal(sla.nearDue, true);
  assert.equal(sla.breached, false);
});

test("calculateServiceOrderSla aplica a regra de menos de nearDueMinHours para alta/critica mesmo fora dos 20%", () => {
  const now = new Date("2026-08-18T10:00:00.000Z");
  // Prazo critico de 4h; restam 1.5h (< 2h configuradas), mas isso e > 20% de 4h (0.8h) --
  // e a regra de horas minimas para alta/critica que precisa capturar este caso.
  const order = { status: "open", priority: "critical", slaDueAt: isoHoursFromNow(1.5, now) };
  const sla = calculateServiceOrderSla(order, settings, now);
  assert.equal(sla.status, SLA_STATUSES.NEAR_DUE);
});

test("calculateServiceOrderSla nao aplica a regra de horas minimas para prioridade baixa/media", () => {
  const now = new Date("2026-08-18T10:00:00.000Z");
  // Prazo de 5h para media (20% = 1h) - com 1.5h restantes a regra percentual
  // nao dispara (1.5h > 1h) e a regra de horas minimas (2h) so vale para
  // alta/critica, entao esta OS deve continuar on_track.
  const customSettings = { statuses: defaultServiceOrderStatuses, sla: { ...settings.sla, medium: 5 } };
  const order = { status: "open", priority: "medium", slaDueAt: isoHoursFromNow(1.5, now) };
  const sla = calculateServiceOrderSla(order, customSettings, now);
  assert.equal(sla.status, SLA_STATUSES.ON_TRACK);
});

test("calculateServiceOrderSla marca breached quando o prazo ja passou", () => {
  const now = new Date("2026-08-18T10:00:00.000Z");
  const order = { status: "open", priority: "critical", slaDueAt: isoHoursFromNow(-1, now) };
  const sla = calculateServiceOrderSla(order, settings, now);
  assert.equal(sla.status, SLA_STATUSES.BREACHED);
  assert.equal(sla.breached, true);
  assert.equal(sla.nearDue, false);
});

test("calculateServiceOrderSla respeita slaBreachedAt persistido mesmo que o prazo calculado ainda nao tenha passado", () => {
  const now = new Date("2026-08-18T10:00:00.000Z");
  const order = {
    status: "open",
    priority: "critical",
    slaDueAt: isoHoursFromNow(2, now),
    slaBreachedAt: "2026-08-18T09:00:00.000Z"
  };
  const sla = calculateServiceOrderSla(order, settings, now);
  assert.equal(sla.status, SLA_STATUSES.BREACHED);
});

test("calculateServiceOrderSla marca resolved para OS finalizada dentro do prazo", () => {
  const order = {
    status: "closed",
    priority: "critical",
    slaDueAt: "2026-08-18T14:00:00.000Z",
    closedAt: "2026-08-18T12:00:00.000Z"
  };
  const sla = calculateServiceOrderSla(order, settings);
  assert.equal(sla.status, SLA_STATUSES.RESOLVED);
  assert.equal(sla.breached, false);
  assert.equal(sla.remainingMinutes, null);
});

test("calculateServiceOrderSla marca breached para OS finalizada apos o prazo", () => {
  const order = {
    status: "closed",
    priority: "critical",
    slaDueAt: "2026-08-18T14:00:00.000Z",
    closedAt: "2026-08-18T15:30:00.000Z"
  };
  const sla = calculateServiceOrderSla(order, settings);
  assert.equal(sla.status, SLA_STATUSES.BREACHED);
  assert.equal(sla.breached, true);
});
