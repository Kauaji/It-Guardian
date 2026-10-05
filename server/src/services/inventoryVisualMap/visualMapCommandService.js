import { randomUUID } from "node:crypto";
import { withTransaction } from "../../database.js";
import { normalizeMapPayload } from "../../domain/inventoryVisualMap/visualMapPayload.js";
import { addLog } from "../../repositories/logRepository.js";
import { getMapOrThrow } from "../../repositories/inventoryVisualMap/visualMapGuards.js";
import {
  deleteVisualMapRow,
  insertVisualMapRow,
  updateVisualMapRow
} from "../../repositories/inventoryVisualMap/visualMapRepository.js";

export async function createInventoryVisualMap(payload, user) {
  const data = normalizeMapPayload(payload);
  const id = randomUUID();

  return withTransaction(async (db) => {
    const map = await insertVisualMapRow(db, { id, data, userId: user?.id || null });

    await addLog({
      type: "inventory.visual_map.created",
      message: `Mapa visual criado: ${data.name}.`,
      userId: user?.id,
      meta: { mapId: id },
      db
    });

    return map;
  });
}

export async function updateInventoryVisualMap(id, payload, user) {
  return withTransaction(async (db) => {
    const existing = await getMapOrThrow(id, db);
    const data = normalizeMapPayload(payload, existing);
    const map = await updateVisualMapRow(db, { id, data, userId: user?.id || null });

    await addLog({
      type: "inventory.visual_map.updated",
      message: `Mapa visual atualizado: ${data.name}.`,
      userId: user?.id,
      meta: { mapId: id },
      db
    });

    return map;
  });
}

export async function deleteInventoryVisualMap(id, user) {
  return withTransaction(async (db) => {
    const existing = await getMapOrThrow(id, db);
    await deleteVisualMapRow(db, id);
    await addLog({
      type: "inventory.visual_map.deleted",
      message: `Mapa visual removido: ${existing.name}.`,
      userId: user?.id,
      meta: { mapId: id },
      db
    });
    return existing;
  });
}
