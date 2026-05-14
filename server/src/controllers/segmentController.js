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
import { broadcastSnapshot } from "../services/realtimeService.js";

export async function list(req, res, next) {
  try {
    const segments = await listSegments();
    res.json({ segments });
  } catch (error) {
    next(error);
  }
}

export async function listGroups(_req, res, next) {
  try {
    const groups = await listSegmentGroups();
    res.json({ groups });
  } catch (error) {
    next(error);
  }
}

export async function createGroup(req, res, next) {
  try {
    const name = req.body.name?.trim();

    if (!name || name.length < 2) {
      return res.status(400).json({ message: "O nome do grupo deve ter pelo menos 2 caracteres." });
    }

    const group = await createSegmentGroup({
      name,
      color: req.body.color,
      userId: req.user.id
    });

    await addLog({
      type: "segment_group_create",
      message: `Segment group created: ${group.name}`,
      userId: req.user.id,
      meta: { groupId: group.id }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after segment group create", error);
    });

    res.status(201).json({ group });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const name = req.body.name?.trim();

    if (!name || name.length < 2) {
      return res.status(400).json({ message: "Segment name must have at least 2 characters" });
    }

    const segment = await createSegment({
      name,
      color: req.body.color,
      groupId: req.body.groupId || null,
      userId: req.user.id
    });
    await addLog({
      type: "segment_create",
      message: `Inventory segment created: ${segment.name}`,
      userId: req.user.id,
      meta: { segmentId: segment.id }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after segment create", error);
    });

    res.status(201).json({ segment });
  } catch (error) {
    if (error.code === "23505") {
      error = new Error("Ja existe um segmento com esse nome neste grupo.");
      error.statusCode = 409;
    }
    next(error);
  }
}

export async function rename(req, res, next) {
  try {
    const name = req.body.name?.trim();
    const color = req.body.color;
    const groupId = req.body.groupId;

    if (name !== undefined && name.length < 2) {
      return res.status(400).json({ message: "Segment name must have at least 2 characters" });
    }

    if (color !== undefined && !/^#[0-9a-f]{6}$/i.test(color)) {
      return res.status(400).json({ message: "Segment color must be a valid hex color" });
    }

    const segment = await renameSegment({ id: req.params.id, name, color, groupId });
    await addLog({
      type: "segment_rename",
      message: `Inventory segment renamed: ${segment.name}`,
      userId: req.user.id,
      meta: { segmentId: segment.id }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after segment rename", error);
    });

    res.json({ segment });
  } catch (error) {
    if (error.code === "23505") {
      error = new Error("Ja existe um segmento com esse nome neste grupo.");
      error.statusCode = 409;
    }
    next(error);
  }
}

export async function renameGroup(req, res, next) {
  try {
    const name = req.body.name?.trim();
    const color = req.body.color;
    const collapsed = req.body.collapsed;

    if (name !== undefined && name.length < 2) {
      return res.status(400).json({ message: "O nome do grupo deve ter pelo menos 2 caracteres." });
    }

    if (color !== undefined && !/^#[0-9a-f]{6}$/i.test(color)) {
      return res.status(400).json({ message: "A cor do grupo deve ser hexadecimal." });
    }

    const group = await updateSegmentGroup({ id: req.params.id, name, color, collapsed });

    await addLog({
      type: "segment_group_update",
      message: `Segment group updated: ${group.name}`,
      userId: req.user.id,
      meta: { groupId: group.id }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after segment group update", error);
    });

    res.json({ group });
  } catch (error) {
    next(error);
  }
}

export async function removeGroup(req, res, next) {
  try {
    const group = await deleteSegmentGroup(req.params.id);

    await addLog({
      type: "segment_group_delete",
      message: `Segment group deleted: ${group.name}`,
      userId: req.user.id,
      meta: { groupId: group.id }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after segment group delete", error);
    });

    res.json({ group });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const segment = await deleteSegment(req.params.id);
    await addLog({
      type: "segment_delete",
      message: `Inventory segment deleted: ${segment.name}`,
      userId: req.user.id,
      meta: { segmentId: segment.id }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after segment delete", error);
    });

    res.json({ segment });
  } catch (error) {
    next(error);
  }
}
