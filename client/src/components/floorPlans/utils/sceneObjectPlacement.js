const TABLE_OBJECT_TYPES = new Set(["desk", "table", "meeting_table", "meeting-table"]);
const SUPPORTED_OBJECT_TYPES = new Set(["pc", "notebook", "printer"]);
const NORMALIZED_TELEVISION_LABEL = /^(tv|tela|televisao)\b/i;
const TELEVISION_LABEL = /^(tv|tela|televis[aã]o)\b/i;

const SUPPORT_EDGE_TOLERANCE = 8;
const SUPPORT_SURFACE_GAP = 2;

function normalizeType(value) {
  return String(value || "").trim().toLowerCase();
}

function centerOf(object) {
  return {
    x: Number(object?.x || 0) + Number(object?.width || 0) / 2,
    y: Number(object?.y || 0) + Number(object?.height || 0) / 2
  };
}

function boundsOf(object, padding = 0) {
  const x = Number(object?.x || 0);
  const y = Number(object?.y || 0);
  const width = Math.max(0, Number(object?.width || 0));
  const height = Math.max(0, Number(object?.height || 0));
  return {
    x: x - padding,
    y: y - padding,
    right: x + width + padding,
    bottom: y + height + padding,
    width: width + padding * 2,
    height: height + padding * 2
  };
}

function intersectionArea(first, second) {
  const width = Math.max(0, Math.min(first.right, second.right) - Math.max(first.x, second.x));
  const height = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.y, second.y));
  return width * height;
}

function isSamePlacementContext(object, candidate) {
  if (object?.floorId && candidate?.floorId && object.floorId !== candidate.floorId) return false;
  const objectRoomId = object?.metadata?.parentRoomId;
  const candidateRoomId = candidate?.metadata?.parentRoomId;
  return !objectRoomId || !candidateRoomId || objectRoomId === candidateRoomId;
}

export function resolveSceneObjectType(object) {
  const type = normalizeType(object?.objectType || object?.category);
  if (["desktop", "computer", "workstation"].includes(type)) return "pc";
  if (type === "laptop") return "notebook";
  if (type === "meeting-table") return "meeting_table";
  if (type === "tv") return "tv";
  const normalizedLabel = String(object?.label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (
    type === "camera"
    && (
      TELEVISION_LABEL.test(String(object?.label || ""))
      || NORMALIZED_TELEVISION_LABEL.test(normalizedLabel)
    )
  ) return "tv";
  return type || "object";
}

export function findSupportingFurniture(object, objects = []) {
  if (!SUPPORTED_OBJECT_TYPES.has(resolveSceneObjectType(object))) return null;

  const anchored = objects.find((candidate) => (
    candidate?.id === object?.metadata?.anchorObjectId
    && TABLE_OBJECT_TYPES.has(normalizeType(candidate?.objectType))
    && isSamePlacementContext(object, candidate)
  ));
  if (anchored) return anchored;

  const objectCenter = centerOf(object);
  const objectBounds = boundsOf(object);
  const objectArea = Math.max(1, objectBounds.width * objectBounds.height);
  return objects
    .filter((candidate) => (
      candidate?.id !== object?.id
      && TABLE_OBJECT_TYPES.has(normalizeType(candidate?.objectType))
      && isSamePlacementContext(object, candidate)
    ))
    .map((candidate) => {
      const candidateCenter = centerOf(candidate);
      const candidateBounds = boundsOf(candidate);
      const overlapRatio = intersectionArea(objectBounds, candidateBounds) / objectArea;
      const nearbyOverlapRatio = intersectionArea(
        objectBounds,
        boundsOf(candidate, SUPPORT_EDGE_TOLERANCE)
      ) / objectArea;
      return {
        candidate,
        overlapRatio,
        nearbyOverlapRatio,
        distance: Math.hypot(objectCenter.x - candidateCenter.x, objectCenter.y - candidateCenter.y)
      };
    })
    .filter((entry) => entry.overlapRatio >= 0.08 || entry.nearbyOverlapRatio >= 0.55)
    .sort((a, b) => (
      b.overlapRatio - a.overlapRatio
      || b.nearbyOverlapRatio - a.nearbyOverlapRatio
      || a.distance - b.distance
    ))[0]?.candidate || null;
}

export function getSceneBaseElevation(object, objects = []) {
  const support = findSupportingFurniture(object, objects);
  if (!support) return 0;
  return Math.max(0, Number(support.height3d || 46)) + SUPPORT_SURFACE_GAP;
}
