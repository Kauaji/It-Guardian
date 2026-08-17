import { badRequest, conflict } from "../lib/errors.js";
import { addLog } from "../repositories/logRepository.js";
import {
  createSegment,
  deleteSegment,
  listSegments,
  renameSegment
} from "../repositories/segmentRepository.js";
import {
  createSegmentGroup,
  deleteSegmentGroup,
  listSegmentGroups,
  updateSegmentGroup
} from "../repositories/segmentGroupRepository.js";
import { broadcastSnapshot } from "./realtimeService.js";

const hexColorPattern = /^#[0-9a-f]{6}$/i;

function notifySnapshot(context) {
  broadcastSnapshot().catch((error) => {
    console.error(`Realtime broadcast failed after ${context}`, error);
  });
}

function remapSegmentNameConflict(error) {
  if (error.code === "23505") {
    throw conflict("Ja existe um segmento com esse nome neste grupo.");
  }
  throw error;
}

export async function listAllSegments() {
  return listSegments();
}

export async function listAllSegmentGroups() {
  return listSegmentGroups();
}

export async function createGroup(payload, user) {
  const name = payload.name?.trim();
  if (!name || name.length < 2) {
    throw badRequest("O nome do grupo deve ter pelo menos 2 caracteres.");
  }

  const group = await createSegmentGroup({ name, color: payload.color, userId: user.id });

  await addLog({
    type: "segment_group_create",
    message: `Segment group created: ${group.name}`,
    userId: user.id,
    meta: { groupId: group.id }
  });

  notifySnapshot("segment group create");
  return group;
}

export async function createNewSegment(payload, user) {
  const name = payload.name?.trim();
  if (!name || name.length < 2) {
    throw badRequest("Segment name must have at least 2 characters");
  }

  let segment;
  try {
    segment = await createSegment({
      name,
      color: payload.color,
      groupId: payload.groupId || null,
      userId: user.id,
      allowReservedName: payload.systemSegment === "maintenance"
    });
  } catch (error) {
    remapSegmentNameConflict(error);
  }

  await addLog({
    type: "segment_create",
    message: `Inventory segment created: ${segment.name}`,
    userId: user.id,
    meta: { segmentId: segment.id }
  });

  notifySnapshot("segment create");
  return segment;
}

export async function renameExistingSegment(id, { name: rawName, color, groupId }, user) {
  const name = rawName?.trim();

  if (name !== undefined && name.length < 2) {
    throw badRequest("Segment name must have at least 2 characters");
  }

  if (color !== undefined && !hexColorPattern.test(color)) {
    throw badRequest("Segment color must be a valid hex color");
  }

  let segment;
  try {
    segment = await renameSegment({ id, name, color, groupId });
  } catch (error) {
    remapSegmentNameConflict(error);
  }

  await addLog({
    type: "segment_rename",
    message: `Inventory segment renamed: ${segment.name}`,
    userId: user.id,
    meta: { segmentId: segment.id }
  });

  notifySnapshot("segment rename");
  return segment;
}

export async function renameExistingGroup(id, { name: rawName, color, collapsed }, user) {
  const name = rawName?.trim();

  if (name !== undefined && name.length < 2) {
    throw badRequest("O nome do grupo deve ter pelo menos 2 caracteres.");
  }

  if (color !== undefined && !hexColorPattern.test(color)) {
    throw badRequest("A cor do grupo deve ser hexadecimal.");
  }

  const group = await updateSegmentGroup({ id, name, color, collapsed });

  await addLog({
    type: "segment_group_update",
    message: `Segment group updated: ${group.name}`,
    userId: user.id,
    meta: { groupId: group.id }
  });

  notifySnapshot("segment group update");
  return group;
}

export async function removeExistingGroup(id, user) {
  const group = await deleteSegmentGroup(id);

  await addLog({
    type: "segment_group_delete",
    message: `Segment group deleted: ${group.name}`,
    userId: user.id,
    meta: { groupId: group.id }
  });

  notifySnapshot("segment group delete");
  return group;
}

export async function removeExistingSegment(id, user) {
  const segment = await deleteSegment(id);

  await addLog({
    type: "segment_delete",
    message: `Inventory segment deleted: ${segment.name}`,
    userId: user.id,
    meta: { segmentId: segment.id }
  });

  notifySnapshot("segment delete");
  return segment;
}
