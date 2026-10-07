import assert from "node:assert/strict";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

// Teste de caracterizacao do CRUD de ordens de servico (numeracao, setor,
// servico, regras de prioridade, itens, historico, vinculo de maquina, status
// e exclusao). Existe para travar o comportamento observavel antes da divisao
// do antigo repositories/serviceOrderRepository.js em dominio/repositorio/
// servico.

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "service-order-crud-characterization-secret-32";
process.env.NODE_ENV = "test";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase } = await import("../src/database.js");
const { listAssetHistory } = await import("../src/repositories/assetHistoryRepository.js");
const { listServiceOrderHistory } = await import("../src/repositories/serviceOrderRepository.js");
const { listen, login, browserHeaders } = await import("../test-support/scriptFixtures.mjs");

test.after(closeDatabase);

async function api(baseUrl, cookie, method, path, body) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: browserHeaders(cookie),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

async function boot(t) {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const cookie = await login(baseUrl);
  return { baseUrl, cookie };
}

test("configuracoes: numeracao personalizada, limite de status e bloqueio de remocao de status em uso", async (t) => {
  const { baseUrl, cookie } = await boot(t);

  const initial = await api(baseUrl, cookie, "GET", "/service-orders/settings");
  assert.equal(initial.status, 200);
  assert.deepEqual(
    initial.body.settings.statuses.map((status) => status.id),
    ["open", "in_progress", "waiting", "closed"]
  );
  assert.equal(initial.body.settings.numberFormat.prefix, "OS");
  assert.equal(initial.body.settings.boardLayout, "horizontal");

  const updated = await api(baseUrl, cookie, "PATCH", "/service-orders/settings", {
    numberFormat: { prefix: "os-x", nextNumber: 50 },
    boardLayout: "vertical",
    sla: { critical: 6 }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.settings.numberFormat.prefix, "OS-X");
  assert.equal(updated.body.settings.boardLayout, "vertical");
  assert.equal(updated.body.settings.sla.critical, 6);
  assert.equal(updated.body.settings.sla.high, 24);

  const first = await api(baseUrl, cookie, "POST", "/service-orders", { title: "Primeira OS numerada" });
  const second = await api(baseUrl, cookie, "POST", "/service-orders", { title: "Segunda OS numerada" });
  assert.equal(first.status, 201);
  assert.equal(first.body.serviceOrder.number, "OS-X-0050");
  assert.equal(second.body.serviceOrder.number, "OS-X-0051");
  assert.equal(first.body.serviceOrder.status, "open");
  assert.equal(first.body.serviceOrder.priority, "medium");

  const afterCreate = await api(baseUrl, cookie, "GET", "/service-orders/settings");
  assert.equal(afterCreate.body.settings.numberFormat.nextNumber, 52);

  const tooMany = await api(baseUrl, cookie, "PATCH", "/service-orders/settings", {
    statuses: Array.from({ length: 11 }, (_, index) => ({ id: `s${index}`, name: `Status ${index}` }))
  });
  assert.equal(tooMany.status, 400);

  // Cria um status customizado, move uma OS para ele e tenta remove-lo.
  const withExtra = await api(baseUrl, cookie, "PATCH", "/service-orders/settings", {
    statuses: [
      ...initial.body.settings.statuses.slice(0, 3),
      { id: "extra_status", name: "Em teste", color: "#112233" },
      initial.body.settings.statuses[3]
    ]
  });
  assert.equal(withExtra.status, 200, JSON.stringify(withExtra.body));
  assert.deepEqual(
    withExtra.body.settings.statuses.map((status) => status.id),
    ["open", "in_progress", "waiting", "extra_status", "closed"]
  );

  const orderId = first.body.serviceOrder.id;
  const withoutTechnician = await api(baseUrl, cookie, "PATCH", `/service-orders/${orderId}/status`, { status: "extra_status" });
  assert.equal(withoutTechnician.status, 400);
  await api(baseUrl, cookie, "PATCH", `/service-orders/${orderId}/technician`, { assignedTechnicianName: "Tecnico Um" });
  const moved = await api(baseUrl, cookie, "PATCH", `/service-orders/${orderId}/status`, { status: "extra_status" });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.equal(moved.body.serviceOrder.status, "extra_status");

  const keptStatuses = withExtra.body.settings.statuses.filter((status) => status.id !== "extra_status");
  const blocked = await api(baseUrl, cookie, "PATCH", "/service-orders/settings", { statuses: keptStatuses });
  assert.equal(blocked.status, 400);
  assert.match(blocked.body.message || blocked.body.error || "", /Mova as OS dos status removidos/);

  await api(baseUrl, cookie, "PATCH", `/service-orders/${orderId}/status`, { status: "open" });
  const removed = await api(baseUrl, cookie, "PATCH", "/service-orders/settings", { statuses: keptStatuses });
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.deepEqual(
    removed.body.settings.statuses.map((status) => status.id),
    ["open", "in_progress", "waiting", "closed"]
  );
  assert.equal(removed.body.settings.statuses.find((status) => status.id === "open").isInitial, true);
  assert.equal(removed.body.settings.statuses.find((status) => status.id === "closed").isFinal, true);

  const invalidStatus = await api(baseUrl, cookie, "PATCH", `/service-orders/${orderId}/status`, { status: "extra_status" });
  assert.equal(invalidStatus.status, 400);
});

test("criacao resolve setor, servico, regra de prioridade, itens e prazo de SLA", async (t) => {
  const { baseUrl, cookie } = await boot(t);

  const sector = await api(baseUrl, cookie, "POST", "/sectors", { name: "Financeiro Teste" });
  assert.equal(sector.status, 201, JSON.stringify(sector.body));
  const service = await api(baseUrl, cookie, "POST", "/services", {
    name: "Troca de peca caracterizacao",
    code: "TPC-1",
    defaultPriority: "high",
    defaultValue: "80"
  });
  assert.equal(service.status, 201, JSON.stringify(service.body));
  const rule = await api(baseUrl, cookie, "POST", "/priority-rules", {
    name: "Cliente critico caracterizacao",
    ruleType: "client",
    targetValue: "Cliente Critico",
    priority: "critical"
  });
  assert.equal(rule.status, 201, JSON.stringify(rule.body));

  const slaHours = (await api(baseUrl, cookie, "GET", "/service-orders/settings")).body.settings.sla.critical;
  const before = Date.now();
  const created = await api(baseUrl, cookie, "POST", "/service-orders", {
    title: "OS completa de caracterizacao",
    description: "Descricao",
    sectorName: "financeiro teste",
    serviceCode: "tpc-1",
    environmentName: "cliente critico",
    items: [
      { productName: "SSD 480GB", quantity: "2", unitPrice: "1.234,50", notes: "garantia" },
      { productName: "   ", quantity: 1, unitPrice: 5 }
    ]
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const order = created.body.serviceOrder;
  assert.equal(order.sectorId, sector.body.sector.id);
  assert.equal(order.sectorName, "Financeiro Teste");
  assert.equal(order.serviceId, service.body.service.id);
  assert.equal(order.serviceCode, "TPC-1");
  assert.equal(order.serviceName, "Troca de peca caracterizacao");
  // regra "client" -> critical vence o padrao high do servico
  assert.equal(order.priority, "critical");
  assert.equal(order.serviceValue, 80);
  assert.equal(order.totalPartsValue, 2469);
  assert.equal(order.totalValue, 2549);
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].productName, "SSD 480GB");
  assert.equal(order.items[0].quantity, 2);
  assert.equal(order.items[0].unitPrice, 1234.5);
  assert.equal(order.items[0].subtotal, 2469);
  assert.equal(order.history.length, 1);
  assert.equal(order.history[0].eventType, "created");
  assert.equal(order.history[0].message, "OS criada no setor Financeiro Teste.");
  const dueMs = new Date(order.slaDueAt).getTime();
  assert.ok(dueMs >= before + slaHours * 3600 * 1000 - 5000 && dueMs <= Date.now() + slaHours * 3600 * 1000 + 5000);
  assert.equal(order.sla.status, "on_track");

  const generalFallback = await api(baseUrl, cookie, "POST", "/service-orders", {
    title: "OS com setor inexistente",
    sectorName: "Setor Que Nao Existe",
    serviceName: "Servico livre",
    priority: "low"
  });
  assert.equal(generalFallback.status, 201);
  assert.equal(generalFallback.body.serviceOrder.sectorId, "sector-geral");
  assert.equal(generalFallback.body.serviceOrder.sectorName, "Geral");
  assert.equal(generalFallback.body.serviceOrder.serviceId, null);
  assert.equal(generalFallback.body.serviceOrder.serviceName, "Servico livre");
  assert.equal(generalFallback.body.serviceOrder.priority, "low");

  const invalidPriority = await api(baseUrl, cookie, "POST", "/service-orders", { title: "OS prioridade ruim", priority: "urgente" });
  assert.equal(invalidPriority.status, 400);
  const shortTitle = await api(baseUrl, cookie, "POST", "/service-orders", { title: "ab" });
  assert.equal(shortTitle.status, 400);

  const details = await api(baseUrl, cookie, "GET", `/service-orders/${order.id}`);
  assert.equal(details.status, 200);
  assert.equal(details.body.serviceOrder.items.length, 1);
  const list = await api(baseUrl, cookie, "GET", "/service-orders");
  assert.ok(list.body.serviceOrders.some((item) => item.id === order.id && item.items.length === 1 && item.history.length >= 1));
});

test("atualizacao registra historico por campo, itens, setor, tecnicos, vinculo de maquina, status e exclusao", async (t) => {
  const { baseUrl, cookie } = await boot(t);

  const asset = await api(baseUrl, cookie, "POST", "/devices/manual", {
    name: "Maquina caracterizacao OS",
    type: "server",
    brand: "Generica",
    model: "Teste",
    assetTag: "OS-CRUD-CHAR",
    ip: "203.0.113.77"
  });
  assert.equal(asset.status, 201, JSON.stringify(asset.body));
  const assetId = asset.body.device.id;

  const created = await api(baseUrl, cookie, "POST", "/service-orders", {
    title: "OS para atualizar",
    description: "inicial",
    category: "Computador",
    priority: "medium",
    assetId
  });
  assert.equal(created.status, 201);
  const order = created.body.serviceOrder;
  const id = order.id;
  assert.equal(order.assetId, assetId);

  const updated = await api(baseUrl, cookie, "PATCH", `/service-orders/${id}`, {
    title: "OS atualizada",
    diagnosis: "Fonte queimada",
    priority: "high",
    assignedTechnicianNames: ["Ana", "Bruno", "ana"],
    serviceValue: "150,5",
    description: "inicial"
  });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  const afterUpdate = updated.body.serviceOrder;
  assert.equal(afterUpdate.title, "OS atualizada");
  assert.equal(afterUpdate.diagnosis, "Fonte queimada");
  assert.equal(afterUpdate.priority, "high");
  // deduplicacao e sensivel a maiusculas/minusculas
  assert.deepEqual(afterUpdate.assignedTechnicianNames, ["Ana", "Bruno", "ana"]);
  assert.equal(afterUpdate.assignedTechnicianName, "Ana");
  assert.equal(afterUpdate.serviceValue, 150.5);
  assert.equal(afterUpdate.totalValue, 150.5);
  const eventTypes = afterUpdate.history.map((event) => event.eventType);
  for (const expected of ["created", "title", "priority", "assigned", "diagnosis", "service_value"]) {
    assert.ok(eventTypes.includes(expected), `evento ${expected} ausente em ${eventTypes}`);
  }
  assert.ok(!eventTypes.includes("description"), "descricao inalterada nao gera evento");

  const noChange = await api(baseUrl, cookie, "PATCH", `/service-orders/${id}`, { title: "OS atualizada" });
  assert.equal(noChange.status, 200);
  assert.equal(noChange.body.serviceOrder.history.length, afterUpdate.history.length);

  const withItems = await api(baseUrl, cookie, "POST", `/service-orders/${id}/items`, {
    items: [
      { productName: "Fonte 500W", quantity: 1, unitPrice: 200 },
      { productName: "Cabo", quantity: "3", unitPrice: "10,00" }
    ]
  });
  assert.equal(withItems.status, 201, JSON.stringify(withItems.body));
  assert.equal(withItems.body.serviceOrder.totalPartsValue, 230);
  assert.equal(withItems.body.serviceOrder.totalValue, 380.5);
  const itemsEvent = withItems.body.serviceOrder.history.find((event) => event.eventType === "service_order_items");
  assert.ok(itemsEvent);
  assert.equal(itemsEvent.message, `Pecas e valores registrados na OS ${order.number}.`);
  assert.equal(itemsEvent.newValue, "Fonte 500W x1 - R$ 200,00\nCabo x3 - R$ 30,00");

  // reenviar os mesmos itens nao gera novo evento
  const sameItems = await api(baseUrl, cookie, "POST", `/service-orders/${id}/items`, {
    items: [
      { productName: "Fonte 500W", quantity: 1, unitPrice: 200 },
      { productName: "Cabo", quantity: 3, unitPrice: 10 }
    ]
  });
  assert.equal(sameItems.body.serviceOrder.history.filter((event) => event.eventType === "service_order_items").length, 1);

  const sector = await api(baseUrl, cookie, "POST", "/sectors", { name: "Setor Atualizacao" });
  const moved = await api(baseUrl, cookie, "PATCH", `/service-orders/${id}`, { sectorId: sector.body.sector.id });
  assert.equal(moved.body.serviceOrder.sectorName, "Setor Atualizacao");
  const sectorEvent = moved.body.serviceOrder.history.find((event) => event.eventType === "sector");
  assert.equal(sectorEvent.message, "Setor alterado de Geral para Setor Atualizacao.");

  // desvincula a maquina e vincula novamente: gera eventos no historico da maquina
  const unlink = await api(baseUrl, cookie, "PATCH", `/service-orders/${id}/asset`, { assetId: null });
  assert.equal(unlink.status, 200, JSON.stringify(unlink.body));
  assert.equal(unlink.body.serviceOrder.assetId, null);
  const relink = await api(baseUrl, cookie, "PATCH", `/service-orders/${id}/asset`, { assetId });
  assert.equal(relink.body.serviceOrder.assetId, assetId);
  const assetEvents = (await listAssetHistory(assetId)).map((event) => event.eventType);
  for (const expected of [
    "service_order_created",
    "service_order_title",
    "service_order_priority",
    "service_order_unlinked",
    "service_order_linked",
    "service_order_items",
    "service_order_sector"
  ]) {
    assert.ok(assetEvents.includes(expected), `evento de maquina ${expected} ausente em ${assetEvents}`);
  }

  const closed = await api(baseUrl, cookie, "PATCH", `/service-orders/${id}/status`, { status: "closed" });
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  assert.equal(closed.body.serviceOrder.status, "closed");
  assert.ok(closed.body.serviceOrder.closedAt);
  assert.equal(closed.body.serviceOrder.history[0].eventType, "closed");
  assert.equal(closed.body.serviceOrder.history[0].message, "OS finalizada.");
  assert.equal(closed.body.serviceOrder.sla.status, "resolved");

  const reopened = await api(baseUrl, cookie, "PATCH", `/service-orders/${id}/status`, { status: "open" });
  assert.equal(reopened.body.serviceOrder.closedAt, null);
  assert.equal(reopened.body.serviceOrder.history[0].eventType, "reopened");

  const manualEntry = await api(baseUrl, cookie, "POST", `/service-orders/${id}/history`, { message: "Contato com cliente" });
  assert.equal(manualEntry.status, 201);
  const directHistory = await listServiceOrderHistory(id);
  assert.equal(directHistory[0].message, "Contato com cliente");
  assert.equal(directHistory[0].eventType, "manual");

  const removed = await api(baseUrl, cookie, "DELETE", `/service-orders/${id}`);
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal(removed.body.serviceOrder.number, order.number);
  const gone = await api(baseUrl, cookie, "GET", `/service-orders/${id}`);
  assert.equal(gone.status, 404);
  const finalAssetEvents = (await listAssetHistory(assetId)).map((event) => event.eventType);
  assert.ok(finalAssetEvents.includes("service_order_deleted"));
});
