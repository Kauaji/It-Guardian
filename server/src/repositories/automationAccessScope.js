function normalizeIds(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))]
    : [];
}

export function buildAutomationAccessScope(user = null) {
  const permissions = new Set(user?.effectivePermissions || user?.permissions || []);
  const unrestricted = !user || user.isAdmin === true || user.role === "admin" || permissions.has("admin.full");

  return {
    unrestricted,
    userId: user?.id ? String(user.id) : null,
    clientIds: normalizeIds(user?.allowedClientIds),
    environmentIds: normalizeIds(user?.allowedEnvironmentIds),
    groupIds: normalizeIds(user?.allowedGroupIds),
    segmentIds: normalizeIds(user?.allowedSegmentIds),
    sectorId: user?.sectorId ? String(user.sectorId) : null
  };
}

export function canAccessAutomationPlan(plan, user = null) {
  const scope = buildAutomationAccessScope(user);
  if (scope.unrestricted) return true;
  return Boolean(scope.userId && String(plan?.createdBy || plan?.created_by || "") === scope.userId);
}

export function canAccessAutomationAsset(asset, user = null) {
  const scope = buildAutomationAccessScope(user);
  if (scope.unrestricted) return true;

  const hasAssetScope = scope.segmentIds.length > 0 || scope.groupIds.length > 0;
  if (!hasAssetScope) return true;

  const segmentId = String(asset?.segmentId || asset?.segment_id || "");
  const groupId = String(
    asset?.segmentGroupId ||
    asset?.segment_group_id ||
    asset?.groupId ||
    asset?.group_id ||
    ""
  );

  return (
    (segmentId && scope.segmentIds.includes(segmentId)) ||
    (groupId && scope.groupIds.includes(groupId))
  );
}

export function filterAutomationAssetsByScope(assets = [], user = null) {
  return assets.filter((asset) => canAccessAutomationAsset(asset, user));
}
