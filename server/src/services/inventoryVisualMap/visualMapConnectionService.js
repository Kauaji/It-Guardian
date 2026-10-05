import { randomUUID } from "node:crypto";
import { withTransaction } from "../../database.js";
import { normalizeConnectionPayload } from "../../domain/inventoryVisualMap/visualMapPayload.js";
import { addLog } from "../../repositories/logRepository.js";
import {
  ensureAssetsExist,
  ensureObjectsBelongToMap,
  getConnectionOrThrow,
  getMapOrThrow
} from "../../repositories/inventoryVisualMap/visualMapGuards.js";
import {
  deleteVisualMapConnectionRow,
  insertVisualMapConnectionRow,
  updateVisualMapConnectionRow
} from "../../repositories/inventoryVisualMap/visualMapConnectionRepository.js";

export async function createInventoryVisualMapConnection(mapId, payload, user) {
  const data = normalizeConnectionPayload(payload);
  const id = randomUUID();

  return withTransaction(async (db) => {
    const map = await getMapOrThrow(mapId, db);
    await ensureObjectsBelongToMap(mapId, [data.sourceObjectId, data.targetObjectId], db);
    await ensureAssetsExist([data.sourceAssetId, data.targetAssetId], db);

    const connection = await insertVisualMapConnectionRow(db, { id, mapId, data });

    await addLog({
      type: "inventory.visual_map.connection.created",
      message: `Conexao criada no mapa visual ${map.name}.`,
      userId: user?.id,
      meta: { mapId, connectionId: id, layer: data.layer, connectionType: data.connectionType },
      db
    });

    return connection;
  });
}

export async function updateInventoryVisualMapConnection(id, payload, user) {
  return withTransaction(async (db) => {
    const existing = await getConnectionOrThrow(id, db);
    const map = await getMapOrThrow(existing.mapId, db);
    const data = normalizeConnectionPayload(payload, existing);
    await ensureObjectsBelongToMap(existing.mapId, [data.sourceObjectId, data.targetObjectId], db);
    await ensureAssetsExist([data.sourceAssetId, data.targetAssetId], db);

    const connection = await updateVisualMapConnectionRow(db, { id, data });

    await addLog({
      type: "inventory.visual_map.connection.updated",
      message: `Conexao atualizada no mapa visual ${map.name}.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, connectionId: id, layer: data.layer, connectionType: data.connectionType },
      db
    });

    return connection;
  });
}

export async function deleteInventoryVisualMapConnection(id, user) {
  return withTransaction(async (db) => {
    const existing = await getConnectionOrThrow(id, db);
    const map = await getMapOrThrow(existing.mapId, db);
    await deleteVisualMapConnectionRow(db, id);

    await addLog({
      type: "inventory.visual_map.connection.deleted",
      message: `Conexao removida do mapa visual ${map.name}.`,
      userId: user?.id,
      meta: {
        mapId: existing.mapId,
        connectionId: id,
        layer: existing.layer,
        connectionType: existing.connectionType
      },
      db
    });

    return existing;
  });
}
