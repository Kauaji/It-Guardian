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
