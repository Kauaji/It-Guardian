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
