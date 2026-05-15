export function normalizeGroupId(groupId) {
  return groupId || "";
}

export function getSegmentGroupId(segment, groups = []) {
  return normalizeGroupId(
    segment?.groupId || groups.find((group) => (group.segmentIds || []).includes(segment?.id))?.id
  );
}

export function assignSegmentToGroup(groups = [], segmentId, groupId) {
  const targetGroupId = normalizeGroupId(groupId);

  return groups.map((group) => {
    const segmentIds = (group.segmentIds || []).filter((id) => id !== segmentId);

    return group.id === targetGroupId
      ? { ...group, segmentIds: [...segmentIds, segmentId] }
      : { ...group, segmentIds };
  });
}

export function hasDuplicateSegmentName(segments = [], { name, groupId, excludeId, groups = [] } = {}) {
  const normalizedName = name?.trim().toLowerCase();
  const targetGroupId = normalizeGroupId(groupId);

  if (!normalizedName) return false;

  return segments.some(
    (segment) =>
      segment.id !== excludeId &&
      segment.name?.trim().toLowerCase() === normalizedName &&
      getSegmentGroupId(segment, groups) === targetGroupId
  );
}

export function upsertSegmentList(current = [], segment) {
  if (current.some((item) => item.id === segment.id)) {
    return current.map((item) => (item.id === segment.id ? { ...item, ...segment } : item));
  }

  return [...current, segment];
}

export function moveIdInList(ids, id, direction) {
  const index = ids.indexOf(id);
  if (index < 0) return ids;

  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= ids.length) return ids;

  const next = [...ids];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}
