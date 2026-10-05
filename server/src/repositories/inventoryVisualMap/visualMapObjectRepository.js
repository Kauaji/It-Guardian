import { query } from "../../database.js";
import { getMapOrThrow } from "./visualMapGuards.js";
import { objectFromRow } from "./visualMapMappers.js";

export async function listInventoryVisualMapObjects(mapId) {
  await getMapOrThrow(mapId);
  const result = await query(
    `
      SELECT *
      FROM inventory_visual_map_objects
      WHERE map_id = $1
      ORDER BY layer ASC, created_at ASC
    `,
    [mapId]
  );

  return result.rows.map(objectFromRow);
}

export async function insertVisualMapObjectRow(db, { id, mapId, data, userId }) {
  const result = await db(
    `
      INSERT INTO inventory_visual_map_objects (
        id, map_id, layer, preset_type, label, linked_asset_id,
        position_x, position_y, position_z, rotation_x, rotation_y, rotation_z,
        width, depth, height, color, notes, metadata, created_by, updated_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18::jsonb, $19, $19
      )
      RETURNING *
    `,
    [
      id,
      mapId,
      data.layer,
      data.presetType,
      data.label,
      data.linkedAssetId,
      data.positionX,
      data.positionY,
      data.positionZ,
      data.rotationX,
      data.rotationY,
      data.rotationZ,
      data.width,
      data.depth,
      data.height,
      data.color,
      data.notes,
      JSON.stringify(data.metadata),
      userId
    ]
  );
  return objectFromRow(result.rows[0]);
}

export async function updateVisualMapObjectRow(db, { id, data, userId }) {
  const result = await db(
    `
      UPDATE inventory_visual_map_objects
      SET layer = $2,
          preset_type = $3,
          label = $4,
          linked_asset_id = $5,
          position_x = $6,
          position_y = $7,
          position_z = $8,
          rotation_x = $9,
          rotation_y = $10,
          rotation_z = $11,
          width = $12,
          depth = $13,
          height = $14,
          color = $15,
          notes = $16,
          metadata = $17::jsonb,
          updated_by = $18,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      data.layer,
      data.presetType,
      data.label,
      data.linkedAssetId,
      data.positionX,
      data.positionY,
      data.positionZ,
      data.rotationX,
      data.rotationY,
      data.rotationZ,
      data.width,
      data.depth,
      data.height,
      data.color,
      data.notes,
      JSON.stringify(data.metadata),
      userId
    ]
  );
  return objectFromRow(result.rows[0]);
}

export async function deleteVisualMapObjectRow(db, id) {
  await db("DELETE FROM inventory_visual_map_objects WHERE id = $1", [id]);
}
