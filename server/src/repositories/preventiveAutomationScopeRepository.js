import { query } from "../database.js";

/** Consultas de apoio ao escopo (segmentos e grupos de inventario). */

export async function segmentExists(segmentId, db = query) {
  const result = await db("SELECT id FROM inventory_segments WHERE id = $1 LIMIT 1", [segmentId]);
  return result.rows.length > 0;
}

export async function groupExists(groupId, db = query) {
  const result = await db("SELECT id FROM segment_groups WHERE id = $1 LIMIT 1", [groupId]);
  return result.rows.length > 0;
}

export async function listSegmentIdsByGroup(groupId, db = query) {
  const result = await db("SELECT id FROM inventory_segments WHERE group_id = $1", [groupId]);
  return result.rows.map((row) => String(row.id));
}

/** Mapa id -> nome dos grupos de segmentos. */
export async function listGroupNamesById(db = query) {
  const result = await db(`SELECT id, name FROM segment_groups`);
  return new Map(result.rows.map((row) => [String(row.id), row.name]));
}
