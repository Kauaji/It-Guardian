import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import test from "node:test";
import { useTestDatabase } from "../test-support/database.mjs";

// Golden dos dados de demonstracao (usuarios e dados operacionais) criados no
// bootstrap com ENABLE_DEMO_SEED. Trava o conteudo antes/depois de dividir
// demoDataRepository e userRepository por dominio de dados. Regenerar de
// proposito com: UPDATE_GOLDEN=1 node --test test-integration/demo-seed-golden.test.mjs

await useTestDatabase();
process.env.ENABLE_DEMO_SEED = "true";
process.env.JWT_SECRET = "demo-seed-golden-secret-with-32-characters-xx";
process.env.NODE_ENV = "test";

const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { seedDemoUsers } = await import("../src/repositories/demo/demoUserSeed.js");
const { seedDemoOperationalData } = await import("../src/repositories/demoDataRepository.js");
const { verifyPassword } = await import("../src/security/passwordHasher.js");

test.after(closeDatabase);

const goldenPath = new URL("./fixtures/demo-seed.golden.json", import.meta.url);

const tables = {
  users: "SELECT id, name, email, role, active, sector_id, job_title, is_admin, permissions FROM users ORDER BY id",
  segment_groups: "SELECT id, name, color, created_by FROM segment_groups ORDER BY id",
  inventory_segments: "SELECT id, name, color, group_id, created_by FROM inventory_segments ORDER BY id",
  device_segments: "SELECT device_id, segment_id, updated_by FROM device_segments ORDER BY device_id",
  backups:
    "SELECT device_id, asset_type, is_backup, backup_status, backup_original_segment_id, backup_original_segment_name FROM device_metadata WHERE is_backup = TRUE ORDER BY device_id",
  technicians: "SELECT id, name, email, phone, role, specialty, active, allowed_client_ids FROM technicians ORDER BY id",
  clients: "SELECT id, trade_name, legal_name, document, phone, email, address, contact_name, active FROM clients ORDER BY id",
  products:
    "SELECT id, name, category, brand, model, internal_code, CAST(quantity AS double precision) AS quantity, CAST(unit_price AS double precision) AS unit_price, unit, active FROM products ORDER BY id",
  service_catalog:
    "SELECT id, code, name, category, default_priority, CAST(default_value AS double precision) AS default_value, description, notes, active FROM service_catalog ORDER BY id",
  problem_types: "SELECT id, name, category, default_priority, description, active FROM problem_types ORDER BY id",
  service_orders:
    "SELECT id, number, title, description, status, priority, category, asset_id, sector_id, sector_name, environment_id, environment_name, service_id, service_code, service_name, requester_name, assigned_technician_name, service_performed, diagnosis, attendance_notes, parts_used, created_by, closed_at IS NOT NULL AS closed FROM service_orders WHERE id LIKE 'demo-os-%' ORDER BY id",
  service_order_history:
    "SELECT id, service_order_id, event_type, message, user_id, user_name FROM service_order_history WHERE id LIKE 'demo-os-%' ORDER BY id"
};

async function snapshot() {
  const result = {};
  for (const [name, sql] of Object.entries(tables)) {
    result[name] = JSON.parse(JSON.stringify((await query(sql)).rows));
  }
  return result;
}

test("dados de demonstracao: conteudo estavel e semeadura idempotente", async () => {
  await initializeRuntime();
  const first = await snapshot();

  if (process.env.UPDATE_GOLDEN === "1" || !existsSync(goldenPath)) {
    writeFileSync(goldenPath, `${JSON.stringify(first, null, 2)}\n`);
  }
  assert.deepEqual(first, JSON.parse(readFileSync(goldenPath, "utf8")));

  // Semear de novo nao muda nada (ON CONFLICT / WHERE NOT EXISTS).
  await seedDemoUsers();
  await seedDemoOperationalData();
  assert.deepEqual(await snapshot(), first);

  // Todos os usuarios de demonstracao usam a mesma senha inicial.
  const hashes = (await query("SELECT email, password_hash FROM users WHERE id LIKE 'seed-%'")).rows;
  assert.ok(hashes.length >= 13);
  for (const row of hashes.slice(0, 3)) {
    assert.equal(await verifyPassword("123456", row.password_hash), true);
  }
});
