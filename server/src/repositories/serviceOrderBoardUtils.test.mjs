import assert from "node:assert/strict";
import test from "node:test";
import {
  buildServiceOrderNumberPreview,
  getMonthValue,
  mergeServiceOrderSettings,
  normalizeSearchText,
  normalizeStatuses,
  orderBelongsToClient,
  orderBelongsToSector
} from "../../../client/src/components/serviceOrders/serviceOrderBoardUtils.js";

test("mes principal da OS deriva da data informada sem considerar fechamento", () => {
  assert.equal(getMonthValue("2026-05-31T23:00:00.000-03:00"), "2026-05");
  assert.equal(getMonthValue("valor-invalido"), "");
});

test("busca de OS ignora acentos e diferenca entre maiusculas", () => {
  assert.equal(normalizeSearchText("Manutenção Preventiva"), "manutencao preventiva");
});

test("status da OS preservam exatamente um inicial e um final", () => {
  const statuses = normalizeStatuses([
    { id: "new", name: "Nova", isInitial: true },
    { id: "doing", name: "Fazendo", isInitial: true, isFinal: true },
    { id: "done", name: "Concluida", isFinal: true }
  ]);
  assert.equal(statuses.filter((status) => status.isInitial).length, 1);
  assert.equal(statuses.filter((status) => status.isFinal).length, 1);
});

test("configuracao parcial da OS recebe defaults sem perder valores", () => {
  const settings = mergeServiceOrderSettings({
    boardLayout: "vertical",
    priorityColors: { critical: "#112233" }
  });
  assert.equal(settings.boardLayout, "vertical");
  assert.equal(settings.priorityColors.critical, "#112233");
  assert.equal(settings.priorityColors.low, "#16a34a");
  assert.ok(settings.statuses.length >= 2);
});

test("filtros de setor e cliente respeitam os identificadores", () => {
  const order = { sectorId: "finance", environmentId: "client-a" };
  assert.equal(orderBelongsToSector(order, "finance"), true);
  assert.equal(orderBelongsToSector(order, "other"), false);
  assert.equal(orderBelongsToClient(order, "client-a"), true);
  assert.equal(orderBelongsToClient(order, "client-b"), false);
});

test("preview de numero da OS inclui prefixo e sequencia", () => {
  assert.match(
    buildServiceOrderNumberPreview({ numberFormat: { prefix: "os", nextNumber: 42 } }),
    /^OS-0042$/
  );
});
