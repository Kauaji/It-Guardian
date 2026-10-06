import { query } from "../../database.js";
import { getMapOrThrow } from "./topologyGuards.js";
import { linkFromRow } from "./topologyMappers.js";

export async function listNetworkTopologyLinks(mapId) {
  await getMapOrThrow(mapId);
  const result = await query(
    "SELECT * FROM network_topology_links WHERE map_id = $1 ORDER BY created_at ASC",
    [mapId]
  );
  return result.rows.map(linkFromRow);
}

export async function insertTopologyLinkRow(db, { id, mapId, data }) {
  const result = await db(
    `
      INSERT INTO network_topology_links (
        id, map_id, source_type, target_type, source_asset_id, target_asset_id, label, type, status_override, description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      id,
      mapId,
      data.sourceType,
      data.targetType,
      data.sourceAssetId,
      data.targetAssetId,
      data.label,
      data.type,
      data.statusOverride,
      data.description
    ]
  );
  return linkFromRow(result.rows[0]);
}

export async function updateTopologyLinkRow(db, { id, data }) {
  const result = await db(
    `
      UPDATE network_topology_links
      SET source_type = $2, target_type = $3, source_asset_id = $4, target_asset_id = $5, label = $6, type = $7,
          status_override = $8, description = $9, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      data.sourceType,
      data.targetType,
      data.sourceAssetId,
      data.targetAssetId,
      data.label,
      data.type,
      data.statusOverride,
      data.description
    ]
  );
  return linkFromRow(result.rows[0]);
}

export async function deleteTopologyLinkRow(db, id) {
  await db("DELETE FROM network_topology_links WHERE id = $1", [id]);
}
