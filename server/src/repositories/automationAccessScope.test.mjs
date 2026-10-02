import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAutomationAccessScope,
  canAccessAutomationAsset,
  canAccessAutomationPlan,
  filterAutomationAssetsByScope
} from "./automationAccessScope.js";

const restrictedUser = (overrides = {}) => ({
  id: "user-1",
  role: "technician",
  permissions: ["preventive_automation.view"],
  allowedSegmentIds: [],
  allowedGroupIds: [],
  allowedEnvironmentIds: [],
  allowedClientIds: [],
  ...overrides
});

test("escopo sem usuario, administrador ou admin.full e irrestrito", () => {
  assert.equal(buildAutomationAccessScope(null).unrestricted, true);
  assert.equal(buildAutomationAccessScope({ id: "1", isAdmin: true }).unrestricted, true);
  assert.equal(buildAutomationAccessScope({ id: "1", role: "admin" }).unrestricted, true);
  assert.equal(buildAutomationAccessScope({ id: "1", permissions: ["admin.full"] }).unrestricted, true);
  assert.equal(buildAutomationAccessScope({ id: "1", effectivePermissions: ["admin.full"] }).unrestricted, true);
  assert.equal(buildAutomationAccessScope(restrictedUser()).unrestricted, false);
});

test("escopo normaliza listas removendo vazios, espacos e duplicados", () => {
  const scope = buildAutomationAccessScope(
    restrictedUser({
      id: 42,
      sectorId: "setor-1",
      allowedClientIds: [" c1 ", "c1", "", null],
      allowedEnvironmentIds: ["e1"],
      allowedGroupIds: "nao-e-lista",
      allowedSegmentIds: ["s1", "s2"]
    })
  );

  assert.equal(scope.userId, "42");
  assert.equal(scope.sectorId, "setor-1");
  assert.deepEqual(scope.clientIds, ["c1"]);
  assert.deepEqual(scope.environmentIds, ["e1"]);
  assert.deepEqual(scope.groupIds, []);
  assert.deepEqual(scope.segmentIds, ["s1", "s2"]);
  assert.equal(scope.hasBoundedScope, true);

  const empty = buildAutomationAccessScope(restrictedUser());
  assert.equal(empty.hasBoundedScope, false);
  assert.equal(empty.sectorId, null);
  assert.equal(buildAutomationAccessScope({ role: "viewer" }).userId, null);
});

test("administrador acessa qualquer plano e ativo", () => {
  const admin = { id: "admin", isAdmin: true };
  assert.equal(canAccessAutomationPlan({ createdBy: "outro" }, admin), true);
  assert.equal(canAccessAutomationPlan({ createdBy: "outro" }, null), true);
  assert.equal(canAccessAutomationAsset({ segmentId: "x" }, admin), true);
});

test("usuario sem escopo delimitado so acessa planos que criou, mas ve ativos", () => {
  const user = restrictedUser();
  assert.equal(canAccessAutomationPlan({ createdBy: "user-1" }, user), true);
  assert.equal(canAccessAutomationPlan({ created_by: "user-1" }, user), true);
  assert.equal(canAccessAutomationPlan({ createdBy: "outro" }, user), false);
  assert.equal(canAccessAutomationPlan(null, user), false);
  assert.equal(canAccessAutomationAsset({ segmentId: "qualquer" }, user), true);
  assert.deepEqual(filterAutomationAssetsByScope([{ id: "a" }, { id: "b" }], user).map((asset) => asset.id), ["a", "b"]);
});

test("plano e acessivel quando o escopo do usuario cobre segmento, grupo, ambiente, cliente ou setor", () => {
  const user = restrictedUser({
    allowedSegmentIds: ["seg-1"],
    allowedGroupIds: ["grp-1"],
    allowedEnvironmentIds: ["env-1"],
    allowedClientIds: ["cli-1"],
    sectorId: "setor-1"
  });

  assert.equal(canAccessAutomationPlan({ scopeType: "segment", scopeId: "seg-1" }, user), true);
  assert.equal(canAccessAutomationPlan({ scope_type: "group", scope_id: "grp-1" }, user), true);
  assert.equal(canAccessAutomationPlan({ scopeType: "environment", scopeId: "env-1" }, user), true);
  assert.equal(canAccessAutomationPlan({ scopeType: "client", scopeId: "cli-1" }, user), true);
  assert.equal(canAccessAutomationPlan({ segmentId: "seg-1" }, user), true);
  assert.equal(canAccessAutomationPlan({ segment_group_id: "grp-1" }, user), true);
  assert.equal(canAccessAutomationPlan({ tabId: "env-1" }, user), true);
  assert.equal(canAccessAutomationPlan({ client_id: "cli-1" }, user), true);
  assert.equal(canAccessAutomationPlan({ sector_id: "setor-1" }, user), true);

  assert.equal(canAccessAutomationPlan({ scopeType: "segment", scopeId: "seg-2" }, user), false);
  assert.equal(canAccessAutomationPlan({ scopeType: "all" }, user), false);
  assert.equal(canAccessAutomationPlan({ sectorId: "setor-2" }, user), false);
  assert.equal(canAccessAutomationPlan({}, user), false);
});

test("ativo e acessivel somente dentro do escopo delimitado do usuario", () => {
  const user = restrictedUser({
    allowedSegmentIds: ["seg-1"],
    allowedGroupIds: ["grp-1"],
    allowedEnvironmentIds: ["env-1"],
    allowedClientIds: ["cli-1"],
    sectorId: "setor-1"
  });

  assert.equal(canAccessAutomationAsset({ segmentId: "seg-1" }, user), true);
  assert.equal(canAccessAutomationAsset({ segment_id: "seg-1" }, user), true);
  assert.equal(canAccessAutomationAsset({ segmentGroupId: "grp-1" }, user), true);
  assert.equal(canAccessAutomationAsset({ group_id: "grp-1" }, user), true);
  assert.equal(canAccessAutomationAsset({ environmentId: "env-1" }, user), true);
  assert.equal(canAccessAutomationAsset({ clientId: "cli-1" }, user), true);
  assert.equal(canAccessAutomationAsset({ sectorId: "setor-1" }, user), true);
  assert.equal(canAccessAutomationAsset({ segmentId: "seg-9", groupId: "grp-9" }, user), false);
  assert.equal(canAccessAutomationAsset({}, user), false);

  const assets = [
    { id: "ok", segmentId: "seg-1" },
    { id: "fora", segmentId: "seg-2" }
  ];
  assert.deepEqual(filterAutomationAssetsByScope(assets, user).map((asset) => asset.id), ["ok"]);
  assert.deepEqual(filterAutomationAssetsByScope(undefined, user), []);
});
