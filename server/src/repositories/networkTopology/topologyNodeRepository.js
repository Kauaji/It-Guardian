import { query } from "../../database.js";
import { getMapOrThrow } from "./topologyGuards.js";
import { nodeFromRow } from "./topologyMappers.js";

export async function listNetworkTopologyNodes(mapId) {
  await getMapOrThrow(mapId);
  const result = await query("SELECT * FROM network_topology_nodes WHERE map_id = $1 ORDER BY created_at ASC", [mapId]);
  return result.rows.map(nodeFromRow);
}

export async function insertTopologyNodeRow(db, { id, mapId, data }) {
  const result = await db(
    `
      INSERT INTO network_topology_nodes (id, map_id, node_type, asset_id, ref_id, x, y, pinned, label_override)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [id, mapId, data.nodeType, data.assetId, data.refId, data.x, data.y, data.pinned, data.labelOverride]
  );
  return nodeFromRow(result.rows[0]);
}

export async function updateTopologyNodeRow(db, { id, data }) {
  const result = await db(
    `
      UPDATE network_topology_nodes
      SET node_type = $2, asset_id = $3, ref_id = $4, x = $5, y = $6, pinned = $7, label_override = $8, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, data.nodeType, data.assetId, data.refId, data.x, data.y, data.pinned, data.labelOverride]
  );
  return nodeFromRow(result.rows[0]);
}

export async function updateTopologyNodePositionRow(db, { id, x, y }) {
  const result = await db("UPDATE network_topology_nodes SET x = $2, y = $3, updated_at = NOW() WHERE id = $1 RETURNING *", [id, x, y]);
  return nodeFromRow(result.rows[0]);
}

export async function deleteTopologyNodeRow(db, id) {
  await db("DELETE FROM network_topology_nodes WHERE id = $1", [id]);
}
