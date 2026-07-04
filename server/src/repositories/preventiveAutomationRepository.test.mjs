import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRunIdempotencyKey,
  computeNextScheduledFor,
  getAssetScheduleSyncActions,
  hasPreventiveScheduleChanged,
  normalizeAssetIds,
  normalizeRecurrenceIntervalDays,
  recurrenceToDays,
  resolveAssetListDevices,
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

test("recorrencia personalizada exige quantidade explicita de dias", () => {
  assert.equal(normalizeRecurrenceIntervalDays(45, "custom_days", { strict: true }), 45);
  assert.throws(
    () => normalizeRecurrenceIntervalDays(undefined, "custom_days", { strict: true }),
    /quantidade de dias/
  );
  assert.throws(
    () => normalizeRecurrenceIntervalDays(366, "custom_days", { strict: true }),
    /quantidade de dias/
  );
});

test("identifica quando agenda individual precisa recalcular proxima execucao", () => {
  const previous = {
    recurrenceSource: "plan",
    recurrenceType: "monthly",
    recurrenceIntervalDays: 30,
    preferredTime: "08:00",
    timezone: "America/Sao_Paulo",
    active: true
  };

  assert.equal(hasPreventiveScheduleChanged(previous, { ...previous }), false);
  assert.equal(hasPreventiveScheduleChanged(previous, { ...previous, preferredTime: "09:00" }), true);
  assert.equal(hasPreventiveScheduleChanged(previous, { ...previous, recurrenceSource: "machine" }), true);
  assert.equal(hasPreventiveScheduleChanged(previous, { ...previous, active: false }), true);
});

test("normaliza ids explicitos removendo duplicados e vazios", () => {
  assert.deepEqual(normalizeAssetIds([" asset-1 ", "", "asset-2", "asset-1", null]), ["asset-1", "asset-2"]);
});

test("resolve escopo asset_list sem expandir para segmento inteiro", () => {
  const devices = Array.from({ length: 10 }, (_, index) => ({
    id: `asset-${index + 1}`,
    segmentId: "seg-1"
  }));

  assert.deepEqual(
    resolveAssetListDevices(["asset-2", "asset-7"], devices).map((device) => device.id),
    ["asset-2", "asset-7"]
  );
});

test("resolve escopo asset_list com maquinas de segmentos diferentes", () => {
  const devices = [
    { id: "asset-fin", segmentId: "seg-fin" },
    { id: "asset-ti", segmentId: "seg-ti" },
    { id: "asset-extra", segmentId: "seg-ti" }
  ];

  assert.deepEqual(
    resolveAssetListDevices(["asset-fin", "asset-ti"], devices).map((device) => device.id),
    ["asset-fin", "asset-ti"]
  );
});

test("escopo asset_list vazio ou inexistente falha com status 400", () => {
  assert.throws(() => resolveAssetListDevices([], []), { statusCode: 400 });
  assert.throws(() => resolveAssetListDevices(["asset-missing"], [{ id: "asset-1" }]), { statusCode: 400 });
});

test("diff de agendas preserva mantidas, adiciona novas e desativa removidas", () => {
  const existing = [
    { id: "schedule-1", assetId: "asset-1", active: true },
    { id: "schedule-2", assetId: "asset-2", active: true },
    { id: "schedule-3", assetId: "asset-3", active: true }
  ];

  assert.deepEqual(getAssetScheduleSyncActions(existing, ["asset-2", "asset-4"]), {
    add: ["asset-4"],
    keep: ["asset-2"],
    disable: ["schedule-1", "schedule-3"]
  });
});

test("diff de agendas permite multiplos planos para a mesma maquina", () => {
  assert.deepEqual(getAssetScheduleSyncActions([], ["asset-1"]), {
    add: ["asset-1"],
    keep: [],
    disable: []
  });
  assert.deepEqual(getAssetScheduleSyncActions([], ["asset-1"]), {
    add: ["asset-1"],
    keep: [],
    disable: []
  });
});

test("indicadores de automacao usam agendas ativas por ativo como fonte", () => {
  const repositoryPath = fileURLToPath(new URL("./automationIndicatorRepository.js", import.meta.url));
  const source = readFileSync(repositoryPath, "utf8");
  const functionBody = source.slice(source.indexOf("export async function listAutomationIndicatorsByAssetIds"));

  assert.match(functionBody, /FROM\s+preventive_automation_asset_schedules\s+schedules/i);
  assert.match(functionBody, /INNER\s+JOIN\s+preventive_automation_plans\s+plans\s+ON\s+plans\.id\s*=\s*schedules\.plan_id/i);
  assert.match(functionBody, /schedules\.asset_id\s*=\s*ANY\(\$1\)/i);
  assert.match(functionBody, /schedules\.active\s*=\s*TRUE/i);
  assert.match(functionBody, /plans\.active\s*=\s*TRUE/i);
  assert.doesNotMatch(functionBody, /scope_id\s*=\s*ANY/i);
});

test("monitoramento anexa indicadores de automacao sem busca por card", () => {
  const servicePath = fileURLToPath(new URL("../services/monitoringService.js", import.meta.url));
  const source = readFileSync(servicePath, "utf8");

  assert.match(source, /automationIndicatorRepository\.js/);
  assert.match(source, /listAutomationIndicatorsByAssetIds/);
  assert.match(source, /devices\.map\(\(device\)\s*=>\s*device\.id\)/);
  assert.match(source, /automationIndicators:\s*automationIndicatorsByAsset\.get\(String\(device\.id\)\)\s*\|\|\s*\[\]/);
});

test("componente de indicadores limita pontos visiveis e oferece acessibilidade", () => {
  const componentPath = fileURLToPath(new URL("../../../client/src/components/AutomationIndicatorDots.jsx", import.meta.url));
  const source = readFileSync(componentPath, "utf8");

  assert.match(source, /maxVisible\s*=\s*4/);
  assert.match(source, /const label = formatAutomationIndicatorLabel\(indicator\)/);
  assert.match(source, /aria-label=\{label\}/);
  assert.match(source, /title=\{label\}/);
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /\+{hiddenCount}/);
  assert.match(source, /onSelectPlan\?\.\(indicator\)/);
  assert.match(source, /interactive\s*=\s*true/);
  assert.match(source, /className="automation-indicator-dot-button is-visual"/);
});

test("lista de preventivas usa indicadores apenas visuais", () => {
  const appPath = fileURLToPath(new URL("../../../client/src/App.jsx", import.meta.url));
  const source = readFileSync(appPath, "utf8");

  assert.match(source, /preventiveAutomationManagement\?\.machines/);
  assert.match(source, /managementMachine\?\.plans/);
  assert.match(source, /automationIndicators:\s*\[\.\.\.indicatorsByPlanId\.values\(\)\]/);
  assert.match(
    source,
    /<AutomationIndicatorDots[\s\S]*?indicators=\{device\.automationIndicators\}[\s\S]*?interactive=\{false\}/
  );
});

test("criacao e edicao de automacao validam nome e cor unicos", () => {
  const repositoryPath = fileURLToPath(new URL("./preventiveAutomationRepository.js", import.meta.url));
  const source = readFileSync(repositoryPath, "utf8");

  assert.match(source, /async function assertUniquePlanIdentity/);
  assert.match(source, /LOWER\(name\)\s*=\s*LOWER\(\$1\)/);
  assert.match(source, /LOWER\(indicator_color\)\s*=\s*LOWER\(\$2\)/);
  assert.match(source, /assertUniquePlanIdentity\(normalized,\s*null,\s*db\)/);
  assert.match(source, /assertUniquePlanIdentity\(normalized,\s*id,\s*db\)/);
  assert.match(source, /statusCode\s*=\s*409|createHttpError\([^)]*,\s*409\)/);
});

test("repositorio de automacao nao usa primitivas de execucao de comandos", () => {
  const repositoryPath = fileURLToPath(new URL("./preventiveAutomationRepository.js", import.meta.url));
  const scriptRepositoryPath = fileURLToPath(new URL("./maintenanceScriptRepository.js", import.meta.url));
  const source = [
    readFileSync(repositoryPath, "utf8"),
    readFileSync(scriptRepositoryPath, "utf8")
  ].join("\n");

  assert.doesNotMatch(source, /child_process/);
  assert.doesNotMatch(source, /\bexec\s*\(/);
  assert.doesNotMatch(source, /\bexecFile\s*\(/);
  assert.doesNotMatch(source, /\bspawn\s*\(/);
  assert.doesNotMatch(source, /shell\s*:\s*true/);
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /new\s+Function\b|\bFunction\s*\(/);
});
