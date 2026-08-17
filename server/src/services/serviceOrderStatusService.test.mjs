import assert from "node:assert/strict";
import test from "node:test";
import {
  applyExclusiveFlags,
  sanitizeStatusPayload,
  slugifyStatusId
} from "./serviceOrderStatusService.js";

function baseStatus(overrides = {}) {
  return {
    id: "status-a",
    name: "Status A",
    isInitial: false,
    isFinal: false,
    ...overrides
  };
}

test("slugifyStatusId remove acentos via NFD e normaliza espacos para underscore", () => {
  assert.equal(slugifyStatusId("Em Configuração", "fallback"), "em_configuracao");
  assert.equal(slugifyStatusId("Serviço  Concluído", "fallback"), "servico_concluido");
});

test("slugifyStatusId usa o fallback quando o slug resultante fica vazio", () => {
  assert.equal(slugifyStatusId("", "fallback_id"), "fallback_id");
  assert.equal(slugifyStatusId("   !!!   ", "fallback_id"), "fallback_id");
});

test("sanitizeStatusPayload aplica slug ao id explicito e usa precedencia id > value > name", () => {
  assert.equal(
    sanitizeStatusPayload({ id: "Custom ID!", value: "ignored value", name: "Ignored Name" }).id,
    "custom_id"
  );
  assert.equal(sanitizeStatusPayload({ value: "Valor X", name: "Nome Y" }).id, "valor_x");
  assert.equal(sanitizeStatusPayload({ name: "Em Aberto" }).id, "em_aberto");
});

test("sanitizeStatusPayload preenche valores padrao quando o payload esta vazio", () => {
  const result = sanitizeStatusPayload({}, 5);

  assert.equal(result.name, "Novo status");
  assert.equal(result.order, 5);
  assert.equal(result.isInitial, false);
  assert.equal(result.isFinal, false);
  assert.equal(result.color, undefined);
  assert.match(result.id, /^status_\d+$/);
});

test("sanitizeStatusPayload usa label como fallback do nome e cai no padrao quando so ha espacos", () => {
  assert.equal(sanitizeStatusPayload({ name: "   " }).name, "Novo status");
  assert.equal(sanitizeStatusPayload({ label: "Rotulo Teste" }).name, "Rotulo Teste");
  assert.equal(sanitizeStatusPayload({ name: "  Nome Com Espacos  " }).name, "Nome Com Espacos");
});

test("sanitizeStatusPayload trunca o order valido e cai no fallbackOrder quando invalido", () => {
  assert.equal(sanitizeStatusPayload({ name: "X", order: "4.9" }, 0).order, 4);
  assert.equal(sanitizeStatusPayload({ name: "X", order: "abc" }, 7).order, 7);
});

test("sanitizeStatusPayload converte isInitial e isFinal para booleano estrito e preserva color", () => {
  const result = sanitizeStatusPayload({
    name: "X",
    isInitial: "yes",
    isFinal: 0,
    color: "#112233"
  });

  assert.equal(result.isInitial, true);
  assert.equal(result.isFinal, false);
  assert.equal(result.color, "#112233");
});

test("applyExclusiveFlags desmarca isInitial dos demais status sem alterar o status recebido", () => {
  const statuses = [baseStatus({ id: "a", isInitial: true }), baseStatus({ id: "b", isFinal: true })];
  const newStatus = { id: "c", isInitial: true, isFinal: false };

  const result = applyExclusiveFlags(statuses, newStatus);

  assert.deepEqual(result, [
    { id: "a", name: "Status A", isInitial: false, isFinal: false },
    { id: "b", name: "Status A", isInitial: false, isFinal: true }
  ]);
  assert.equal(result.length, statuses.length);
  assert.equal(statuses[0].isInitial, true);
  assert.equal(newStatus.isInitial, true);
});

test("applyExclusiveFlags desmarca isFinal dos demais status de forma independente de isInitial", () => {
  const statuses = [baseStatus({ id: "a", isInitial: true }), baseStatus({ id: "b", isFinal: true })];
  const newStatus = { id: "c", isInitial: false, isFinal: true };

  const result = applyExclusiveFlags(statuses, newStatus);

  assert.deepEqual(result, [
    { id: "a", name: "Status A", isInitial: true, isFinal: false },
    { id: "b", name: "Status A", isInitial: false, isFinal: false }
  ]);
});

test("applyExclusiveFlags retorna a mesma lista quando o status novo nao e inicial nem final", () => {
  const statuses = [baseStatus({ id: "a", isInitial: true }), baseStatus({ id: "b", isFinal: true })];
  const newStatus = { id: "c", isInitial: false, isFinal: false };

  const result = applyExclusiveFlags(statuses, newStatus);

  assert.equal(result, statuses);
  assert.deepEqual(result, statuses);
});
