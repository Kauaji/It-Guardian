import { addLog } from "../repositories/logRepository.js";
import {
  createSegment,
  deleteSegment,
  listSegments,
  renameSegment
} from "../repositories/segmentRepository.js";
import { broadcastSnapshot } from "../services/realtimeService.js";

export async function list(req, res, next) {
  try {
    const segments = await listSegments();
    res.json({ segments });
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

    const segment = await createSegment({ name, color: req.body.color, userId: req.user.id });
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
      error = new Error("A segment with this name already exists");
      error.statusCode = 409;
    }
    next(error);
  }
}

export async function rename(req, res, next) {
  try {
    const name = req.body.name?.trim();
    const color = req.body.color;

    if (name !== undefined && name.length < 2) {
      return res.status(400).json({ message: "Segment name must have at least 2 characters" });
    }

    if (color !== undefined && !/^#[0-9a-f]{6}$/i.test(color)) {
      return res.status(400).json({ message: "Segment color must be a valid hex color" });
    }

    const segment = await renameSegment({ id: req.params.id, name, color });
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
      error = new Error("A segment with this name already exists");
      error.statusCode = 409;
    }
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
