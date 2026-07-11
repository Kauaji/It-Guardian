function normalizeIds(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))]
    : [];
}

function readId(source, keys = []) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }
  return "";
}

function includesAny(allowedIds = [], ...values) {
  return values.some((value) => value && allowedIds.includes(String(value)));
}

function hasBoundedScope(scope) {
  return (
    scope.clientIds.length > 0 ||
    scope.environmentIds.length > 0 ||
    scope.groupIds.length > 0 ||
    scope.segmentIds.length > 0 ||
    Boolean(scope.sectorId)
  );
}

export function buildAutomationAccessScope(user = null) {
  const permissions = new Set(user?.effectivePermissions || user?.permissions || []);
  const unrestricted = !user || user.isAdmin === true || user.role === "admin" || permissions.has("admin.full");
  const scope = {
    unrestricted,
    userId: user?.id ? String(user.id) : null,
    clientIds: normalizeIds(user?.allowedClientIds),
    environmentIds: normalizeIds(user?.allowedEnvironmentIds),
    groupIds: normalizeIds(user?.allowedGroupIds),
    segmentIds: normalizeIds(user?.allowedSegmentIds),
    sectorId: user?.sectorId ? String(user.sectorId) : null
  };

  return {
    ...scope,
    hasBoundedScope: hasBoundedScope(scope)
  };
}

function planMatchesScope(plan, scope) {
  const scopeType = String(plan?.scopeType || plan?.scope_type || "").toLowerCase();
  const scopeId = readId(plan, ["scopeId", "scope_id"]);
  const segmentId = readId(plan, ["segmentId", "segment_id"]);
  const groupId = readId(plan, ["groupId", "group_id", "segmentGroupId", "segment_group_id"]);
  const environmentId = readId(plan, ["environmentId", "environment_id", "tabId", "tab_id"]);
  const clientId = readId(plan, ["clientId", "client_id"]);
  const sectorId = readId(plan, ["sectorId", "sector_id"]);

  if (scopeType === "segment" && includesAny(scope.segmentIds, scopeId)) return true;
  if (scopeType === "group" && includesAny(scope.groupIds, scopeId)) return true;
  if (scopeType === "environment" && includesAny(scope.environmentIds, scopeId)) return true;
  if (scopeType === "client" && includesAny(scope.clientIds, scopeId)) return true;
  if (includesAny(scope.segmentIds, segmentId)) return true;
  if (includesAny(scope.groupIds, groupId)) return true;
  if (includesAny(scope.environmentIds, environmentId)) return true;
  if (includesAny(scope.clientIds, clientId)) return true;
  return Boolean(scope.sectorId && sectorId && scope.sectorId === sectorId);
}

export function canAccessAutomationPlan(plan, user = null) {
  const scope = buildAutomationAccessScope(user);
  if (scope.unrestricted) return true;
  if (scope.userId && String(plan?.createdBy || plan?.created_by || "") === scope.userId) return true;
  if (!scope.hasBoundedScope) return false;
  return planMatchesScope(plan, scope);
}

export function canAccessAutomationAsset(asset, user = null) {
  const scope = buildAutomationAccessScope(user);
  if (scope.unrestricted) return true;

  // Local/demo mode still has assets without tenant fields. Keep them visible only
  // when there is no explicit scope to compare, while plan ownership remains enforced.
  if (!scope.hasBoundedScope) return true;

  const segmentId = readId(asset, ["segmentId", "segment_id"]);
  const groupId = readId(asset, ["segmentGroupId", "segment_group_id", "groupId", "group_id"]);
  const environmentId = readId(asset, ["environmentId", "environment_id", "tabId", "tab_id"]);
  const clientId = readId(asset, ["clientId", "client_id"]);
  const sectorId = readId(asset, ["sectorId", "sector_id"]);

  return (
    includesAny(scope.segmentIds, segmentId) ||
    includesAny(scope.groupIds, groupId) ||
    includesAny(scope.environmentIds, environmentId) ||
    includesAny(scope.clientIds, clientId) ||
    Boolean(scope.sectorId && sectorId && scope.sectorId === sectorId)
  );
}

export function filterAutomationAssetsByScope(assets = [], user = null) {
  return assets.filter((asset) => canAccessAutomationAsset(asset, user));
}
