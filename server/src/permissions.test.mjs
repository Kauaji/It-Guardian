import assert from "node:assert/strict";
import test from "node:test";

import * as clientPermissions from "../../client/src/permissions.js";
import * as serverPermissions from "./permissions.js";
import * as sharedPermissions from "../../shared/permissions.js";

test("frontend e backend usam o mesmo catálogo de permissões", () => {
  assert.deepEqual(serverPermissions.permissionGroups, sharedPermissions.permissionGroups);
  assert.deepEqual(clientPermissions.permissionGroups, sharedPermissions.permissionGroups);
  assert.deepEqual(serverPermissions.allPermissionIds, clientPermissions.allPermissionIds);
});

test("catálogo contém permissões críticas de alertas, scripts e preventivas", () => {
  const permissions = new Set(sharedPermissions.allPermissionIds);

  assert.equal(permissions.has("service_orders.create_from_alert"), true);
  assert.equal(permissions.has("scripts.use_from_alert"), true);
  assert.equal(permissions.has("script_validations.manage"), true);
  assert.equal(permissions.has("preventive_plans.create_service_order"), true);
  assert.equal(permissions.has("preventive_automation.run_prepare"), true);
});

test("permissões efetivas bloqueiam admin.* para usuário não administrador", () => {
  const permissions = sharedPermissions.getEffectivePermissions({
    role: "operator",
    active: true,
    permissions: ["admin.full", "preventive_plans.create_service_order"]
  });

  assert.equal(permissions.includes("admin.full"), false);
  assert.equal(permissions.includes("preventive_plans.create_service_order"), true);
});

test("usuário ausente (null/undefined) não tem permissões e não lança erro", () => {
  assert.deepEqual(sharedPermissions.getEffectivePermissions(null), []);
  assert.deepEqual(sharedPermissions.getEffectivePermissions(undefined), []);
  assert.equal(sharedPermissions.hasPermission(null, "inventory.view"), false);
  assert.equal(sharedPermissions.hasPermission(null, ""), true);
});

test("normalizePermissions ignora entradas que não são texto", () => {
  assert.deepEqual(sharedPermissions.normalizePermissions(["inventory.view", 7, null, { id: "x" }, "inventory.view"]), ["inventory.view"]);
});
