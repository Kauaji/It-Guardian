import assert from "node:assert/strict";
import test from "node:test";
import { formatItemsForHistory, itemsSignature, normalizeServiceOrderItems, sumServiceOrderItems, toMoneyValue, toQuantityValue } from "./serviceOrderItems.js";
import {
  buildServiceOrderChanges,
  calculateServiceOrderTotals,
  hasAssignedTechniciansPayload,
  hasItemsPayload,
  hasSectorPayload,
  hasServicePayload,
  resolveAssignedTechnicianNames,
  resolveCreateServiceValue,
  resolveUpdateServiceValue
} from "./serviceOrderPayload.js";
import { buildNewServiceOrderRow, buildUpdatedServiceOrderRow, resolveClosedAt } from "./serviceOrderRows.js";

test("valores monetarios aceitam formato brasileiro e descartam negativos/invalidos", () => {
  assert.equal(toMoneyValue("1.234,50"), 1234.5);
  assert.equal(toMoneyValue("R$ 10,999"), 11);
  assert.equal(toMoneyValue("12.5"), 12.5);
  assert.equal(toMoneyValue("-4"), 0);
  assert.equal(toMoneyValue("abc"), 0);
  assert.equal(toMoneyValue(null), 0);
  assert.equal(toQuantityValue("2,5"), 2.5);
  assert.equal(toQuantityValue("0"), 1);
  assert.equal(toQuantityValue(undefined), 1);
});

test("itens: normaliza, descarta sem nome, soma subtotais e gera assinatura estavel", () => {
  const items = normalizeServiceOrderItems([
    { productName: " SSD ", quantity: "2", unitPrice: "100,10", notes: " nota " },
    { name: "Cabo", quantity: 1, unit_price: 5 },
    { productName: "  ", quantity: 3, unitPrice: 9 }
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].productName, "SSD");
  assert.equal(items[0].subtotal, 200.2);
  assert.equal(items[0].notes, "nota");
  assert.ok(items[0].id);
  assert.equal(sumServiceOrderItems(items), 205.2);
  assert.equal(normalizeServiceOrderItems("nao-lista").length, 0);

  const again = normalizeServiceOrderItems(items);
  assert.equal(itemsSignature(items), itemsSignature(again), "ids novos nao alteram a assinatura");
  assert.notEqual(itemsSignature(items), itemsSignature(items.slice(0, 1)));
  assert.equal(formatItemsForHistory(items), "SSD x2 - R$ 200,20\nCabo x1 - R$ 5,00");
  assert.equal(formatItemsForHistory([]), "");
});

test("deteccao de campos presentes no payload", () => {
  assert.equal(hasSectorPayload({ sectorName: "x" }), true);
  assert.equal(hasSectorPayload({ title: "x" }), false);
  assert.equal(hasServicePayload({ serviceCode: undefined }), true);
  assert.equal(hasItemsPayload({ serviceItems: [] }), true);
  assert.equal(hasItemsPayload({}), false);
  assert.equal(hasAssignedTechniciansPayload({ assignedTechnicianName: null }), true);
  assert.equal(hasAssignedTechniciansPayload(null), false);
});

test("tecnicos responsaveis: lista, nome unico, atual e limite de 12", () => {
  assert.deepEqual(resolveAssignedTechnicianNames({ assignedTechnicianNames: [" Ana ", "", "Ana", "Bia"] }), ["Ana", "Bia"]);
  assert.deepEqual(resolveAssignedTechnicianNames({ assignedTechnicianName: "Caio" }), ["Caio"]);
  assert.deepEqual(resolveAssignedTechnicianNames({ assignedTechnicianName: null }), []);
  assert.deepEqual(resolveAssignedTechnicianNames({}, { assignedTechnicianNames: ["Dani"] }), ["Dani"]);
  assert.deepEqual(resolveAssignedTechnicianNames({}, { assignedTechnicianName: "Edu" }), ["Edu"]);
  const many = Array.from({ length: 20 }, (_, index) => `T${index}`);
  assert.equal(resolveAssignedTechnicianNames({ assignedTechnicianNames: many }).length, 12);
});

test("totais e valor do servico na criacao e na atualizacao", () => {
  const items = normalizeServiceOrderItems([{ productName: "Peca", quantity: 3, unitPrice: 10.1 }]);
  assert.deepEqual(calculateServiceOrderTotals(100, items), { serviceValue: 100, totalPartsValue: 30.3, totalValue: 130.3 });
  assert.equal(resolveCreateServiceValue({ serviceValue: "50,5" }, { defaultValue: 80 }), 50.5);
  assert.equal(resolveCreateServiceValue({}, { defaultValue: "80" }), 80);
  assert.equal(resolveCreateServiceValue({}, {}), 0);
  assert.equal(resolveUpdateServiceValue({ serviceValue: 0 }, { serviceValue: 9 }, {}), 0);
  assert.equal(resolveUpdateServiceValue({ serviceId: "x" }, { serviceValue: 9 }, { defaultValue: 30 }), 30);
  assert.equal(resolveUpdateServiceValue({ serviceId: "x" }, { serviceValue: 9 }, { defaultValue: null }), 9);
  assert.equal(resolveUpdateServiceValue({}, { serviceValue: "7,5" }, { defaultValue: 30 }), 7.5);
});

test("alteracoes: so campos enviados e diferentes viram eventos", () => {
  const current = {
    title: "A", description: "d", status: "open", priority: "low", assetId: "m1", assignedTechnicianNames: ["Ana"],
    sectorName: "Geral", serviceName: null, serviceCode: null, serviceValue: 10, partsUsed: ""
  };
  const base = { current, assignedTechnicianNames: ["Ana"], nextAssetId: "m1", serviceValue: 10, sector: { sectorName: "Geral" }, service: {}, itemsInPayload: false };

  assert.deepEqual(buildServiceOrderChanges({ ...base, payload: { title: "A", description: "d" } }), []);

  const changes = buildServiceOrderChanges({
    ...base,
    payload: { title: "B", priority: "high", assignedTechnicianNames: ["Ana", "Bia"], assetId: "m2", serviceValue: "20" },
    assignedTechnicianNames: ["Ana", "Bia"],
    nextAssetId: "m2",
    serviceValue: 20,
    sector: { sectorName: "TI" }
  });
  const byType = Object.fromEntries(changes.map(([type, message, oldValue, newValue]) => [type, { message, oldValue, newValue }]));
  assert.deepEqual(Object.keys(byType).sort(), ["asset", "assigned", "priority", "sector", "service_value", "title"]);
  assert.equal(byType.title.newValue, "B");
  assert.equal(byType.assigned.newValue, "Ana, Bia");
  assert.equal(byType.asset.newValue, "m2");
  assert.equal(byType.sector.message, "Setor alterado de Geral para TI.");
  assert.equal(byType.service_value.newValue, 20);

  const parts = buildServiceOrderChanges({ ...base, payload: { partsUsed: "SSD" }, itemsInPayload: true });
  assert.equal(parts.length, 0, "partsUsed e ignorado quando ha itens estruturados no payload");
  assert.equal(buildServiceOrderChanges({ ...base, payload: { partsUsed: "SSD" } })[0][0], "parts");
});

test("linhas persistidas: nova OS, atualizacao parcial e fechamento", () => {
  const money = { serviceValue: 10, totalPartsValue: 5, totalValue: 15 };
  const sector = { sectorId: "s1", sectorName: "TI" };
  const service = { serviceId: null, serviceCode: null, serviceName: null };
  const created = buildNewServiceOrderRow({
    payload: { title: "T", environmentName: "Cli" },
    id: "id1",
    number: "OS-0001",
    settings: { autoPriority: { enabled: true } },
    initialStatus: "open",
    priority: "high",
    sector,
    service,
    money,
    assignedTechnicianNames: ["Ana", "Bia"],
    user: { id: "u1" },
    slaDueAt: "2026-01-01T00:00:00.000Z"
  });
  assert.equal(created.description, "");
  assert.equal(created.assignedTechnicianName, "Ana");
  assert.equal(created.autoPriorityEnabled, true);
  assert.equal(created.environmentName, "Cli");
  assert.equal(created.category, null);
  assert.equal(created.createdBy, "u1");
  assert.equal(created.totalValue, 15);

  const current = { title: "Antigo", description: "d", status: "open", priority: "low", assetId: "m1", backupAssetId: "b1", environmentName: "X", autoPriorityEnabled: false, closedAt: null };
  const updated = buildUpdatedServiceOrderRow({
    payload: { title: "Novo", assetId: "" },
    current,
    nextStatus: "open",
    closedAt: null,
    sector,
    service,
    money,
    assignedTechnicianNames: []
  });
  assert.equal(updated.title, "Novo");
  assert.equal(updated.description, "d");
  assert.equal(updated.assetId, null, "assetId enviado vazio desvincula");
  assert.equal(updated.backupAssetId, "b1", "backupAssetId ausente preserva");
  assert.equal(updated.assignedTechnicianName, null);
  assert.equal(updated.autoPriorityEnabled, false);

  assert.equal(resolveClosedAt({ nextStatus: "open", finalStatus: "closed", current: { closedAt: "x" } }), null);
  assert.equal(resolveClosedAt({ nextStatus: "closed", finalStatus: "closed", current: { closedAt: "2026-01-01" } }), "2026-01-01");
  assert.ok(resolveClosedAt({ nextStatus: "closed", finalStatus: "closed", current: { closedAt: null } }));
});
