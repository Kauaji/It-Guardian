import { query } from "../../database.js";
import { getMapOrThrow } from "./visualMapGuards.js";
import { connectionFromRow } from "./visualMapMappers.js";

export async function listInventoryVisualMapConnections(mapId) {
  await getMapOrThrow(mapId);
  const result = await query(
    `
      SELECT *
      FROM inventory_visual_map_connections
      WHERE map_id = $1
      ORDER BY layer ASC, created_at ASC
    `,
    [mapId]
  );

  return result.rows.map(connectionFromRow);
}

function connectionValues(data) {
  return [
    data.layer,
    data.connectionType,
    data.label,
    data.sourceObjectId,
    data.targetObjectId,
    data.sourceAssetId,
    data.targetAssetId,
    JSON.stringify(data.points),
    data.color,
    data.thickness,
    data.dashed,
    data.notes,
    JSON.stringify(data.metadata)
  ];
}

export async function insertVisualMapConnectionRow(db, { id, mapId, data }) {
  const result = await db(
    `
      INSERT INTO inventory_visual_map_connections (
        id, map_id, layer, connection_type, label,
        source_object_id, target_object_id, source_asset_id, target_asset_id,
        points_json, color, thickness, dashed, notes, metadata_json
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10::jsonb, $11, $12, $13, $14, $15::jsonb
      )
      RETURNING *
    `,
    [id, mapId, ...connectionValues(data)]
  );
  return connectionFromRow(result.rows[0]);
}

export async function updateVisualMapConnectionRow(db, { id, data }) {
  const result = await db(
    `
      UPDATE inventory_visual_map_connections
      SET layer = $2,
          connection_type = $3,
          label = $4,
          source_object_id = $5,
          target_object_id = $6,
          source_asset_id = $7,
          target_asset_id = $8,
          points_json = $9::jsonb,
          color = $10,
          thickness = $11,
          dashed = $12,
          notes = $13,
          metadata_json = $14::jsonb,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...connectionValues(data)]
  );
  return connectionFromRow(result.rows[0]);
}

export async function deleteVisualMapConnectionRow(db, id) {
  await db("DELETE FROM inventory_visual_map_connections WHERE id = $1", [id]);
}
