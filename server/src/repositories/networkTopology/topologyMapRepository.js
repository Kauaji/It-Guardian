import { query } from "../../database.js";
import { getMapOrThrow } from "./topologyGuards.js";
import { mapFromRow } from "./topologyMappers.js";

export async function listNetworkTopologyMaps() {
  const result = await query(`
    SELECT *
    FROM network_topology_maps
    ORDER BY updated_at DESC, created_at DESC
  `);
  return result.rows.map(mapFromRow);
}

export async function getNetworkTopologyMap(id) {
  return getMapOrThrow(id);
}

export async function findMapRowByScope(db, scopeType, scopeId) {
  const existing = await db("SELECT * FROM network_topology_maps WHERE scope_type = $1 AND scope_id = $2 LIMIT 1", [scopeType, scopeId]);
  return existing.rows[0] ? mapFromRow(existing.rows[0]) : null;
}

export async function insertTopologyMapRow(db, { id, name, scopeType, scopeId, userId }) {
  const result = await db(
    `
      INSERT INTO network_topology_maps (id, name, scope_type, scope_id, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [id, name, scopeType, scopeId, userId]
  );
  return mapFromRow(result.rows[0]);
}

export async function updateTopologyMapRow(db, { id, data }) {
  const result = await db(
    `
      UPDATE network_topology_maps
      SET name = $2, scope_type = $3, scope_id = $4, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, data.name, data.scopeType, data.scopeId]
  );
  return mapFromRow(result.rows[0]);
}

export async function deleteTopologyMapRow(db, id) {
  await db("DELETE FROM network_topology_maps WHERE id = $1", [id]);
}
