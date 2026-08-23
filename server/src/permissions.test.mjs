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

test("catálogo contém as permissões de relatórios e o operador só recebe as 4 de visualização básica por padrão", () => {
  const permissions = new Set(sharedPermissions.allPermissionIds);

  for (const id of [
    "reports.view",
    "reports.export",
    "reports.view_service_orders",
    "reports.view_assets",
    "reports.view_alerts",
    "reports.view_scripts",
    "reports.view_remote_assistance",
    "reports.manage"
  ]) {
    assert.equal(permissions.has(id), true, `catálogo deveria conter ${id}`);
  }

  const operatorPermissions = new Set(sharedPermissions.roleDefaultPermissions.operator);
  assert.equal(operatorPermissions.has("reports.view"), true);
  assert.equal(operatorPermissions.has("reports.view_service_orders"), true);
  assert.equal(operatorPermissions.has("reports.view_assets"), true);
  assert.equal(operatorPermissions.has("reports.view_alerts"), true);
  assert.equal(operatorPermissions.has("reports.export"), false);
  assert.equal(operatorPermissions.has("reports.view_scripts"), false);
  assert.equal(operatorPermissions.has("reports.view_remote_assistance"), false);
  assert.equal(operatorPermissions.has("reports.manage"), false);
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
