import { query } from "../../database.js";

// Snapshot atual (nao historico) de onde um ativo aparece no Mapa de Rede -
// cobre vinculos criados antes desta consulta existir, que nao tem evento
// em asset_history.
export async function findNetworkTopologyReferencesForAsset(assetId) {
  const nodesResult = await query(
    `
      SELECT n.id AS node_id, n.map_id, m.name AS map_name
      FROM network_topology_nodes n
      JOIN network_topology_maps m ON m.id = n.map_id
      WHERE n.asset_id = $1
    `,
    [assetId]
  );

  const linksResult = await query(
    `
      SELECT l.id AS link_id, l.map_id, m.name AS map_name,
             l.source_asset_id, l.target_asset_id, l.label, l.type
      FROM network_topology_links l
      JOIN network_topology_maps m ON m.id = l.map_id
      WHERE l.source_asset_id = $1 OR l.target_asset_id = $1
    `,
    [assetId]
  );

  const mapIds = new Set();
  for (const row of nodesResult.rows) mapIds.add(row.map_id);
  for (const row of linksResult.rows) mapIds.add(row.map_id);

  return {
    mapCount: mapIds.size,
    maps: Array.from(mapIds).map((mapId) => {
      const mapName =
        nodesResult.rows.find((row) => row.map_id === mapId)?.map_name ||
        linksResult.rows.find((row) => row.map_id === mapId)?.map_name ||
        "";
      return { mapId, mapName };
    }),
    links: linksResult.rows.map((row) => ({
      linkId: row.link_id,
      mapId: row.map_id,
      mapName: row.map_name,
      otherAssetId: row.source_asset_id === assetId ? row.target_asset_id : row.source_asset_id,
      label: row.label,
      type: row.type
    }))
  };
}
