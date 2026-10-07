import { query } from "../../database.js";
import { getMapOrThrow } from "./visualMapGuards.js";
import { mapFromRow } from "./visualMapMappers.js";

export async function listInventoryVisualMaps() {
  const result = await query(`
    SELECT *, 0 AS object_count
    FROM inventory_visual_maps
    ORDER BY updated_at DESC, created_at DESC
  `);

  const maps = result.rows.map(mapFromRow);
  if (!maps.length) return maps;

  const countResult = await query(`
    SELECT map_id, COUNT(*) AS object_count
    FROM inventory_visual_map_objects
    GROUP BY map_id
  `);
  const countByMapId = new Map(countResult.rows.map((row) => [row.map_id, Number(row.object_count || 0)]));

  return maps.map((map) => ({
    ...map,
    objectCount: countByMapId.get(map.id) || 0
  }));
}

export async function getInventoryVisualMap(id) {
  return getMapOrThrow(id);
}

export async function insertVisualMapRow(db, { id, data, userId }) {
  const result = await db(
    `
      INSERT INTO inventory_visual_maps (
        id, name, environment_id, group_id, segment_id, floor_label,
        width, depth, scale, notes, created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
      RETURNING *
    `,
    [
      id,
      data.name,
      data.environmentId,
      data.groupId,
      data.segmentId,
      data.floorLabel,
      data.width,
      data.depth,
      data.scale,
      data.notes,
      userId
    ]
  );
  return mapFromRow(result.rows[0]);
}

export async function updateVisualMapRow(db, { id, data, userId }) {
  const result = await db(
    `
      UPDATE inventory_visual_maps
      SET name = $2,
          environment_id = $3,
          group_id = $4,
          segment_id = $5,
          floor_label = $6,
          width = $7,
          depth = $8,
          scale = $9,
          notes = $10,
          updated_by = $11,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      data.name,
      data.environmentId,
      data.groupId,
      data.segmentId,
      data.floorLabel,
      data.width,
      data.depth,
      data.scale,
      data.notes,
      userId
    ]
  );
  return mapFromRow(result.rows[0]);
}

export async function deleteVisualMapRow(db, id) {
  await db("DELETE FROM inventory_visual_maps WHERE id = $1", [id]);
}
