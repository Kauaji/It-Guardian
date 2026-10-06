import { query } from "../../database.js";
import { makeHttpError } from "../../domain/inventoryVisualMap/visualMapErrors.js";
import { connectionFromRow, mapFromRow, objectFromRow } from "./visualMapMappers.js";

export async function getMapOrThrow(id, db = query) {
  const result = await db("SELECT * FROM inventory_visual_maps WHERE id = $1", [id]);
  const map = mapFromRow(result.rows[0]);
  if (!map) throw makeHttpError("Mapa visual nao encontrado.", 404);
  return map;
}

export async function getObjectOrThrow(id, db = query) {
  const result = await db("SELECT * FROM inventory_visual_map_objects WHERE id = $1", [id]);
  const object = objectFromRow(result.rows[0]);
  if (!object) throw makeHttpError("Objeto do mapa visual nao encontrado.", 404);
  return object;
}

export async function getConnectionOrThrow(id, db = query) {
  const result = await db("SELECT * FROM inventory_visual_map_connections WHERE id = $1", [id]);
  const connection = connectionFromRow(result.rows[0]);
  if (!connection) throw makeHttpError("Conexao do mapa visual nao encontrada.", 404);
  return connection;
}

export async function ensureObjectsBelongToMap(mapId, objectIds, db = query) {
  const ids = [...new Set(objectIds.filter(Boolean))];
  for (const objectId of ids) {
    const object = await getObjectOrThrow(objectId, db);
    if (object.mapId !== mapId) {
      throw makeHttpError("Objeto informado pertence a outro mapa visual.");
    }
  }
}

export async function ensureAssetsExist(assetIds, db = query) {
  const ids = [...new Set(assetIds.filter(Boolean))];
  for (const assetId of ids) {
    const result = await db(
      `
        SELECT $1 AS id
        WHERE EXISTS (SELECT 1 FROM manual_network_assets WHERE id = $1)
           OR EXISTS (SELECT 1 FROM device_metadata WHERE device_id = $1 AND removed_at IS NULL)
           OR EXISTS (SELECT 1 FROM device_segments WHERE device_id = $1)
      `,
      [assetId]
    );

    if (!result.rows.length) {
      throw makeHttpError("Ativo informado nao foi encontrado.");
    }
  }
}

export async function ensureAssetLinkAvailable(mapId, linkedAssetId, excludeObjectId = null, db = query) {
  if (!linkedAssetId) return;

  const result = await db(
    `
      SELECT id
      FROM inventory_visual_map_objects
      WHERE map_id = $1
        AND linked_asset_id = $2
        AND ($3::text IS NULL OR id <> $3)
      LIMIT 1
    `,
    [mapId, linkedAssetId, excludeObjectId]
  );

  if (result.rows.length) {
    throw makeHttpError("Este ativo ja esta posicionado neste mapa visual.", 409);
  }
}
