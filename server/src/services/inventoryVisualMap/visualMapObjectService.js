import { randomUUID } from "node:crypto";
import { withTransaction } from "../../database.js";
import { normalizeObjectPayload } from "../../domain/inventoryVisualMap/visualMapPayload.js";
import { addAssetHistory } from "../../repositories/assetHistoryRepository.js";
import { addLog } from "../../repositories/logRepository.js";
import {
  ensureAssetLinkAvailable,
  ensureAssetsExist,
  getMapOrThrow,
  getObjectOrThrow
} from "../../repositories/inventoryVisualMap/visualMapGuards.js";
import {
  deleteVisualMapObjectRow,
  insertVisualMapObjectRow,
  updateVisualMapObjectRow
} from "../../repositories/inventoryVisualMap/visualMapObjectRepository.js";

export async function createInventoryVisualMapObject(mapId, payload, user) {
  const data = normalizeObjectPayload(payload);
  const id = randomUUID();

  return withTransaction(async (db) => {
    const map = await getMapOrThrow(mapId, db);
    await ensureAssetsExist([data.linkedAssetId], db);
    await ensureAssetLinkAvailable(mapId, data.linkedAssetId, null, db);
    const object = await insertVisualMapObjectRow(db, { id, mapId, data, userId: user?.id || null });

    if (data.linkedAssetId) {
      await addAssetHistory({
        assetId: data.linkedAssetId,
        eventType: "inventory_visual_map",
        message: `Ativo posicionado no mapa visual ${map.name}.`,
        newValue: data.label,
        userId: user?.id,
        userName: user?.name,
        db
      });
    }

    await addLog({
      type: "inventory.visual_map.object.created",
      message: `Objeto criado no mapa visual: ${data.label}.`,
      userId: user?.id,
      meta: { mapId, objectId: id, linkedAssetId: data.linkedAssetId },
      db
    });

    return object;
  });
}

export async function updateInventoryVisualMapObject(id, payload, user) {
  return withTransaction(async (db) => {
    const existing = await getObjectOrThrow(id, db);
    const map = await getMapOrThrow(existing.mapId, db);
    const data = normalizeObjectPayload(payload, existing);
    await ensureAssetsExist([data.linkedAssetId], db);
    await ensureAssetLinkAvailable(existing.mapId, data.linkedAssetId, id, db);
    const object = await updateVisualMapObjectRow(db, { id, data, userId: user?.id || null });

    if (data.linkedAssetId) {
      await addAssetHistory({
        assetId: data.linkedAssetId,
        eventType: "inventory_visual_map",
        message: `Posicao do ativo atualizada no mapa visual ${map.name}.`,
        newValue: data.label,
        userId: user?.id,
        userName: user?.name,
        db
      });
    }

    await addLog({
      type: "inventory.visual_map.object.updated",
      message: `Objeto atualizado no mapa visual: ${data.label}.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, objectId: id, linkedAssetId: data.linkedAssetId },
      db
    });

    return object;
  });
}

export async function deleteInventoryVisualMapObject(id, user) {
  return withTransaction(async (db) => {
    const existing = await getObjectOrThrow(id, db);
    const map = await getMapOrThrow(existing.mapId, db);
    await deleteVisualMapObjectRow(db, id);

    if (existing.linkedAssetId) {
      await addAssetHistory({
        assetId: existing.linkedAssetId,
        eventType: "inventory_visual_map",
        message: `Ativo removido do mapa visual ${map.name}.`,
        oldValue: existing.label,
        userId: user?.id,
        userName: user?.name,
        db
      });
    }

    await addLog({
      type: "inventory.visual_map.object.deleted",
      message: `Objeto removido do mapa visual: ${existing.label}.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, objectId: id, linkedAssetId: existing.linkedAssetId },
      db
    });

    return existing;
  });
}
