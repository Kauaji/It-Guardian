import test from "node:test";
import assert from "node:assert/strict";
import { validateCalendarEvent, validateCalendarPeriod } from "../src/domain/calendarEvent.js";

test("valida um agendamento completo", () => {
  const event = validateCalendarEvent({ title: "Visita ao datacenter", eventType: "technical_visit", startAt: "2026-09-03T12:00:00.000Z", endAt: "2026-09-03T13:00:00.000Z" });
  assert.equal(event.status, "scheduled");
  assert.equal(event.priority, "normal");
});

test("rejeita tipo e status invalidos", () => {
  assert.throws(() => validateCalendarEvent({ title: "Teste válido", eventType: "meeting", startAt: new Date().toISOString() }), /Tipo de evento inválido/);
  assert.throws(() => validateCalendarEvent({ title: "Teste válido", eventType: "other", status: "open", startAt: new Date().toISOString() }), /Status do evento inválido/);
});

test("rejeita termino anterior ao inicio", () => {
  assert.throws(() => validateCalendarEvent({ title: "Teste válido", eventType: "other", startAt: "2026-09-03T13:00:00.000Z", endAt: "2026-09-03T12:00:00.000Z" }), /posterior ao início/);
});

test("limita consultas a 93 dias", () => {
  assert.throws(() => validateCalendarPeriod("2026-01-01", "2026-06-01"), /período máximo/);
});
