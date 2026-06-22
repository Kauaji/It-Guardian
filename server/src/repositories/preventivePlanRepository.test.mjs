import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

test("criação de OS preventiva usa transação e trava duplicidade do vínculo", () => {
  const repositoryPath = fileURLToPath(new URL("./preventivePlanRepository.js", import.meta.url));
  const source = readFileSync(repositoryPath, "utf8");

  assert.match(source, /withTransaction/);
  assert.match(source, /FOR UPDATE/);
  assert.match(source, /service_order_id IS NULL/);
  assert.match(source, /Este plano já possui uma OS preventiva vinculada\./);
});

test("migração cria vínculos únicos entre plano preventivo e OS", () => {
  const databasePath = fileURLToPath(new URL("../database.js", import.meta.url));
  const source = readFileSync(databasePath, "utf8");

  assert.match(source, /preventive_plans_service_order_id_fkey/);
  assert.match(source, /service_orders_preventive_plan_id_fkey/);
  assert.match(source, /idx_preventive_plans_service_order_unique/);
  assert.match(source, /idx_service_orders_preventive_plan_unique/);
});

test("preventive automation schema links optionally to one preventive plan", () => {
  const databasePath = fileURLToPath(new URL("../database.js", import.meta.url));
  const source = readFileSync(databasePath, "utf8");

  assert.match(source, /preventive_plan_id TEXT/);
  assert.match(source, /preventive_automation_plans_preventive_plan_id_fkey/);
  assert.match(source, /REFERENCES preventive_plans\(id\) ON DELETE CASCADE/);
  assert.match(source, /idx_preventive_automation_plans_preventive_plan_unique/);
  assert.match(source, /WHERE preventive_plan_id IS NOT NULL/);
});

test("preventive plan repository creates linked automation in unified flow", () => {
  const repositoryPath = fileURLToPath(new URL("./preventivePlanRepository.js", import.meta.url));
  const source = readFileSync(repositoryPath, "utf8");

  assert.match(source, /payload\.automation\?\.enabled === true/);
  assert.match(source, /createPreventiveAutomationPlanRecord/);
  assert.match(source, /preventivePlanId: planId/);
  assert.match(source, /scopeType: "asset_list"/);
  assert.match(source, /automation: \{ enabled: false \}/);
  assert.match(source, /findPreventiveAutomationPlanByPreventivePlanId/);
});

test("preventive automation repository exposes linked preventive plan fields", () => {
  const repositoryPath = fileURLToPath(new URL("./preventiveAutomationRepository.js", import.meta.url));
  const source = readFileSync(repositoryPath, "utf8");

  assert.match(source, /preventivePlanId: row\.preventive_plan_id \|\| null/);
  assert.match(source, /preventivePlanName: row\.preventive_plan_name \|\| null/);
  assert.match(source, /LEFT JOIN preventive_plans plans ON plans\.id = automation\.preventive_plan_id/);
  assert.match(source, /createPreventiveAutomationPlanRecord/);
});
