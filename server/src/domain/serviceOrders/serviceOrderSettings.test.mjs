import assert from "node:assert/strict";
import test from "node:test";
import { resolveConfiguredPriority, chooseHigherPriority, sanitizePriority } from "./serviceOrderPriority.js";
import {
  defaultServiceOrderSettings,
  defaultServiceOrderStatuses,
  formatServiceOrderNumber,
  getFinalStatus,
  getInitialStatus,
  hasServiceOrderStatus,
  isDefaultSettings,
  maxServiceOrderStatuses,
  mergeServiceOrderSettingsUpdate,
  normalizeServiceOrderSettings
} from "./serviceOrderSettings.js";

test("configuracoes vazias normalizam para os padroes", () => {
  const settings = normalizeServiceOrderSettings({});
  assert.equal(settings.numberFormat.prefix, "OS");
  assert.equal(settings.numberFormat.nextNumber, null);
  assert.equal(settings.boardLayout, "horizontal");
  assert.deepEqual(
    settings.statuses.map((status) => status.id),
    ["open", "in_progress", "waiting", "closed"]
  );
  assert.equal(isDefaultSettings(settings), true);
  assert.equal(isDefaultSettings(mergeServiceOrderSettingsUpdate(settings, { numberFormat: { prefix: "x" } })), false);
});

test("normalizacao limita prefixo, horas, layout e cores invalidas", () => {
  const settings = normalizeServiceOrderSettings({
    numberFormat: { prefix: " abcdefghijklmnopqrstuvwxyz ", nextNumber: "12.9" },
    autoPriority: { enabled: 1, lowToMediumHours: -5, mediumToHighHours: "abc" },
    boardLayout: "diagonal",
    priorityColors: { low: "vermelho", high: "#AABBCC" },
    sla: { critical: 0, nearDuePercent: 500, nearDueMinHours: -1 }
  });
  assert.equal(settings.numberFormat.prefix, "ABCDEFGHIJKL");
  assert.equal(settings.numberFormat.nextNumber, 12);
  assert.equal(settings.autoPriority.enabled, true);
  assert.equal(settings.autoPriority.lowToMediumHours, 1);
  assert.equal(settings.autoPriority.mediumToHighHours, 48);
  assert.equal(settings.boardLayout, "horizontal");
  assert.equal(settings.priorityColors.low, "#16a34a");
  assert.equal(settings.priorityColors.high, "#AABBCC");
  assert.equal(settings.sla.critical, 4);
  assert.equal(settings.sla.nearDuePercent, 90);
  assert.equal(settings.sla.nearDueMinHours, 0);
});

test("status: limite, ids unicos, um inicial e um final", () => {
  const many = Array.from({ length: maxServiceOrderStatuses + 5 }, (_, index) => ({ id: `s${index}`, name: `Status ${index}` }));
  assert.equal(normalizeServiceOrderSettings({ statuses: many }).statuses.length, maxServiceOrderStatuses);

  const statuses = normalizeServiceOrderSettings({
    statuses: [
      { id: "Novo Chamado", name: "Novo", isInitial: true },
      { id: "novo_chamado", name: "Duplicado" },
      { id: "feito", name: "Feito", isFinal: true, color: "invalida" }
    ]
  }).statuses;
  assert.deepEqual(
    statuses.map((status) => status.id),
    ["novo_chamado", "feito"]
  );
  assert.equal(statuses.filter((status) => status.isInitial).length, 1);
  assert.equal(statuses.filter((status) => status.isFinal).length, 1);
  assert.equal(statuses[1].isFinal, true);

  const single = normalizeServiceOrderSettings({ statuses: [{ id: "unico", name: "Unico" }] }).statuses;
  assert.equal(single.length, 2, "completa com o padrao para ter ao menos 2 status");
});

test("status inicial/final e existencia por id", () => {
  assert.equal(getInitialStatus().id, "open");
  assert.equal(getFinalStatus().id, "closed");
  const custom = {
    statuses: [
      { id: "a", name: "A", isInitial: true },
      { id: "b", name: "B", isFinal: true }
    ]
  };
  assert.equal(getInitialStatus(custom).id, "a");
  assert.equal(getFinalStatus(custom).id, "b");
  assert.equal(hasServiceOrderStatus(custom, "b"), true);
  assert.equal(hasServiceOrderStatus(custom, "open"), false);
  assert.equal(defaultServiceOrderStatuses.length, 4);
});

test("numero da OS usa prefixo, ano/mes opcionais e quatro digitos", () => {
  assert.equal(formatServiceOrderNumber(7, defaultServiceOrderSettings), "OS-0007");
  assert.equal(formatServiceOrderNumber(12345, defaultServiceOrderSettings), "OS-12345");
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const settings = { numberFormat: { prefix: "ord", useYear: true, useMonth: true } };
  assert.equal(formatServiceOrderNumber(3, settings), `ORD-${year}-${month}-0003`);
});

test("atualizacao parcial de configuracoes preserva o restante", () => {
  const current = normalizeServiceOrderSettings({ sla: { high: 10 }, requireChecklistBeforeFinish: true });
  const next = mergeServiceOrderSettingsUpdate(current, { sla: { critical: 2 }, boardLayout: "vertical" });
  assert.equal(next.sla.high, 10);
  assert.equal(next.sla.critical, 2);
  assert.equal(next.boardLayout, "vertical");
  assert.equal(next.requireChecklistBeforeFinish, true);
  assert.equal(mergeServiceOrderSettingsUpdate(current, { requireChecklistBeforeFinish: false }).requireChecklistBeforeFinish, false);
});

test("prioridade: saneamento, escolha da maior e regras configuradas", () => {
  assert.equal(sanitizePriority("urgente"), "medium");
  assert.equal(sanitizePriority("high"), "high");
  assert.equal(chooseHigherPriority("medium", "critical"), "critical");
  assert.equal(chooseHigherPriority("high", "medium"), "high");
  assert.equal(chooseHigherPriority("high", "inexistente"), "high");

  const rules = [
    { ruleType: "client", targetValue: "Cliente VIP", priority: "critical" },
    { ruleType: "category", targetValue: "Servidor", priority: "high", active: false },
    { ruleType: "problem_type", targetValue: "rede", priority: "high" },
    { ruleType: "sector", targetValue: "", priority: "critical" }
  ];
  assert.equal(resolveConfiguredPriority({ priority: "low", environmentName: "cliente vip" }, { sectorName: "TI" }, {}, rules), "critical");
  assert.equal(
    resolveConfiguredPriority({ category: "Servidor" }, { sectorName: "TI" }, { defaultPriority: "low" }, rules),
    "low",
    "regra inativa e ignorada"
  );
  assert.equal(resolveConfiguredPriority({ problemType: "Rede" }, { sectorName: "TI" }, {}, rules), "high");
  assert.equal(resolveConfiguredPriority({}, {}, { defaultPriority: "invalida" }, []), "medium");
});
