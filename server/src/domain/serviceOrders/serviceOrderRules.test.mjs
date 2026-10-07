import assert from "node:assert/strict";
import test from "node:test";
import { canViewAllServiceOrders, canViewServiceOrder } from "./serviceOrderAccess.js";
import { normalizeServiceOrderAttachmentInput } from "./serviceOrderAttachments.js";
import { normalizeFeedbackRating } from "./serviceOrderFeedback.js";
import { describeStatusChange, planServiceOrderReopen } from "./serviceOrderLifecycle.js";
import { calculateServiceOrderSla, getTimedPriority, withDisplayPriority } from "./serviceOrderSla.js";
import { normalizeServiceOrderSettings } from "./serviceOrderSettings.js";

const settings = normalizeServiceOrderSettings({});

test("visibilidade: quem ve tudo, setor geral, criador, setor, tecnico e clientes permitidos", () => {
  const admin = { id: "a", role: "admin", permissions: [] };
  assert.equal(canViewAllServiceOrders(admin), true);
  assert.equal(canViewServiceOrder(null, {}), false);
  assert.equal(canViewServiceOrder({ id: "x", role: "technician", permissions: [] }, { sectorId: "sector-geral" }), true);

  const user = { id: "u1", name: "Ana Souza", email: "ana@x.com", sectorId: "s1", sectorName: "TI", permissions: [] };
  assert.equal(canViewServiceOrder(user, { sectorId: "s2", sectorName: "RH" }), false);
  assert.equal(canViewServiceOrder(user, { sectorId: "s2", sectorName: "RH", createdBy: "u1" }), true);
  assert.equal(canViewServiceOrder(user, { sectorId: "s1", sectorName: "Outro" }), true);
  assert.equal(canViewServiceOrder(user, { sectorId: "s9", sectorName: "ti" }), true);
  assert.equal(canViewServiceOrder(user, { sectorId: "s2", sectorName: "RH", assignedTechnicianName: "ana souza" }), true);
  assert.equal(canViewServiceOrder(user, { sectorId: "s2", sectorName: "RH", assignedTechnicianNames: ["Bia", "ANA@X.COM"] }), true);

  const scoped = { ...user, allowedClientIds: ["c1"] };
  assert.equal(canViewServiceOrder(scoped, { environmentId: "c1", sectorId: "s2", sectorName: "RH" }), true);
  assert.equal(canViewServiceOrder(scoped, { environmentId: "c2", sectorId: "sector-geral" }), false);
});

test("prioridade por tempo so exibe escalonamento quando habilitada e a OS nao esta finalizada", () => {
  const hoursAgo = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const enabled = normalizeServiceOrderSettings({ autoPriority: { enabled: true } });
  const row = { priority: "low", auto_priority_enabled: true, status: "open", created_at: hoursAgo(50) };
  assert.equal(getTimedPriority(row, enabled), "high");
  assert.equal(withDisplayPriority(row, enabled).priority, "high");
  assert.equal(row.priority, "low", "nao altera a linha original");
  assert.equal(getTimedPriority({ ...row, created_at: hoursAgo(100) }, enabled), "critical");
  assert.equal(getTimedPriority({ ...row, created_at: hoursAgo(1) }, enabled), "low");
  assert.equal(getTimedPriority({ ...row, status: "closed" }, enabled), "low");
  assert.equal(getTimedPriority({ ...row, auto_priority_enabled: false }, enabled), "low");
  assert.equal(getTimedPriority(row, settings), "low");
  const same = { ...row, created_at: hoursAgo(1) };
  assert.equal(withDisplayPriority(same, enabled), same);
});

test("SLA considera status final configurado ao resolver a OS", () => {
  const custom = normalizeServiceOrderSettings({
    statuses: [
      { id: "novo", isInitial: true, name: "Novo" },
      { id: "fim", name: "Fim", isFinal: true }
    ]
  });
  const order = {
    status: "fim",
    priority: "high",
    slaDueAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    closedAt: new Date().toISOString()
  };
  assert.equal(calculateServiceOrderSla(order, custom).status, "resolved");
});

test("mudanca de status descreve fechamento, reabertura e transicao comum", () => {
  assert.deepEqual(describeStatusChange("closed", settings), {
    eventType: "closed",
    message: "OS finalizada.",
    assetMessage: "finalizada."
  });
  assert.equal(describeStatusChange("open", settings).eventType, "reopened");
  assert.equal(describeStatusChange("waiting", settings).eventType, "status");
});

test("reabertura exige OS finalizada e motivo, e reinicia o prazo de SLA", () => {
  const now = new Date("2026-03-01T10:00:00.000Z");
  const closed = { status: "closed", priority: "critical" };
  assert.throws(
    () => planServiceOrderReopen({ current: { ...closed, status: "open" }, settings, reason: "x motivo" }),
    (error) => error.statusCode === 400 && /finalizada/.test(error.message)
  );
  assert.throws(
    () => planServiceOrderReopen({ current: closed, settings, reason: " a " }),
    (error) => error.statusCode === 400 && /motivo/.test(error.message)
  );
  const plan = planServiceOrderReopen({ current: closed, settings, reason: "  Voltou a falhar ", now });
  assert.equal(plan.reason, "Voltou a falhar");
  assert.equal(plan.initialStatusId, "open");
  assert.equal(plan.nextSlaDueAt, "2026-03-01T14:00:00.000Z");
});

test("avaliacao aceita notas de 1 a 5 (truncando) e rejeita o restante", () => {
  assert.equal(normalizeFeedbackRating("4.9"), 4);
  assert.equal(normalizeFeedbackRating(5), 5);
  for (const invalid of [0, 6, "x", undefined, null, NaN]) {
    assert.throws(
      () => normalizeFeedbackRating(invalid),
      (error) => error.statusCode === 400 && error.expose === true
    );
  }
});

test("anexos: limites, categoria padrao e extensoes bloqueadas", () => {
  const ok = normalizeServiceOrderAttachmentInput({
    fileName: `  ${"a".repeat(300)}.png `,
    fileType: "image/png",
    fileSize: "1024.7",
    storageKey: "https://exemplo/doc.pdf",
    category: "inexistente",
    description: "d"
  });
  assert.equal(ok.fileName.length, 255);
  assert.equal(ok.category, "outro");
  assert.equal(ok.fileSize, 1024);
  assert.equal(ok.storageKey, "https://exemplo/doc.pdf");
  assert.equal(ok.historyName.endsWith(".png"), true);

  const empty = normalizeServiceOrderAttachmentInput({ fileName: "foto.png", fileSize: -1, category: "foto" });
  assert.equal(empty.fileSize, null);
  assert.equal(empty.fileType, null);
  assert.equal(empty.category, "foto");

  assert.throws(() => normalizeServiceOrderAttachmentInput({ fileName: "   " }), /nome do anexo/);
  assert.throws(() => normalizeServiceOrderAttachmentInput({ fileName: "setup.EXE" }), /não permitido/);
  assert.throws(() => normalizeServiceOrderAttachmentInput({ fileName: "ok.txt", storageKey: "http://x/run.ps1" }), /referência do anexo/);
});
