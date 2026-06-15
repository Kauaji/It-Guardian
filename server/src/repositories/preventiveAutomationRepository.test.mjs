import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRunIdempotencyKey,
  computeNextScheduledFor,
  recurrenceToDays,
  resolveEffectiveRecurrence
} from "./preventiveAutomationRepository.js";

test("normaliza recorrencia como dias sem multiplicar novamente", () => {
  assert.equal(recurrenceToDays("daily", 1), 1);
  assert.equal(recurrenceToDays("weekly", 7), 7);
  assert.equal(recurrenceToDays("weekly", 1), 7);
  assert.equal(recurrenceToDays("biweekly", 15), 15);
  assert.equal(recurrenceToDays("monthly", 1), 30);
  assert.equal(recurrenceToDays("monthly", 30), 30);
  assert.equal(recurrenceToDays("custom_days", 45), 45);
});

test("calcula proxima preparacao respeitando fuso horario", () => {
  const schedule = {
    recurrenceType: "daily",
    recurrenceIntervalDays: 1,
    preferredTime: "08:00",
    timezone: "America/Sao_Paulo"
  };

  assert.equal(
    computeNextScheduledFor(schedule, new Date("2026-06-14T10:00:00.000Z")),
    "2026-06-14T11:00:00.000Z"
  );
  assert.equal(
    computeNextScheduledFor(schedule, new Date("2026-06-14T12:00:00.000Z")),
    "2026-06-15T11:00:00.000Z"
  );
});

test("aplica prioridade de recorrencia: maquina acima de segmento e plano", () => {
  const plan = {
    recurrenceType: "monthly",
    recurrenceIntervalDays: 30,
    preferredTime: "08:00",
    timezone: "America/Sao_Paulo",
    overrides: [
      {
        segmentId: "seg-1",
        recurrenceType: "weekly",
        recurrenceIntervalDays: 7,
        preferredTime: "09:00",
        active: true
      },
      {
        assetId: "asset-1",
        recurrenceType: "custom_days",
        recurrenceIntervalDays: 3,
        preferredTime: "10:00",
        active: true
      }
    ]
  };

  assert.deepEqual(resolveEffectiveRecurrence(plan, { id: "asset-1", segmentId: "seg-1" }), {
    recurrenceType: "custom_days",
    recurrenceIntervalDays: 3,
    preferredTime: "10:00",
    timezone: "America/Sao_Paulo",
    source: "machine"
  });
  assert.equal(resolveEffectiveRecurrence(plan, { id: "asset-2", segmentId: "seg-1" }).source, "segment");
  assert.equal(resolveEffectiveRecurrence(plan, { id: "asset-3", segmentId: "seg-2" }).source, "plan");
});

test("gera chave idempotente estavel para o mesmo plano, ativo e janela", () => {
  const first = buildRunIdempotencyKey("plan-1", "asset-1", "2026-06-14T11:00:00.000Z");
  const second = buildRunIdempotencyKey("plan-1", "asset-1", new Date("2026-06-14T11:00:00.000Z"));

  assert.equal(first, second);
});

test("repositorio de automacao nao usa primitivas de execucao de comandos", () => {
  const repositoryPath = fileURLToPath(new URL("./preventiveAutomationRepository.js", import.meta.url));
  const source = readFileSync(repositoryPath, "utf8");

  assert.doesNotMatch(source, /child_process/);
  assert.doesNotMatch(source, /\bexec\s*\(/);
  assert.doesNotMatch(source, /\bspawn\s*\(/);
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /new\s+Function\b|\bFunction\s*\(/);
});
