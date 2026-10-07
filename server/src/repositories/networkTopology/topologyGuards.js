import { query } from "../../database.js";
import { makeHttpError } from "../../domain/networkTopology/topologyErrors.js";
import { linkFromRow, mapFromRow, nodeFromRow } from "./topologyMappers.js";

export async function getMapOrThrow(id, db = query) {
  const result = await db("SELECT * FROM network_topology_maps WHERE id = $1", [id]);
  const map = mapFromRow(result.rows[0]);
  if (!map) throw makeHttpError("Mapa de rede nao encontrado.", 404);
  return map;
}

export async function getNodeOrThrow(id, db = query) {
  const result = await db("SELECT * FROM network_topology_nodes WHERE id = $1", [id]);
  const node = nodeFromRow(result.rows[0]);
  if (!node) throw makeHttpError("Ativo nao encontrado neste mapa de rede.", 404);
  return node;
}

export async function getLinkOrThrow(id, db = query) {
  const result = await db("SELECT * FROM network_topology_links WHERE id = $1", [id]);
  const link = linkFromRow(result.rows[0]);
  if (!link) throw makeHttpError("Conexao nao encontrada neste mapa de rede.", 404);
  return link;
}

// Ativos vem de fontes diferentes (agente, manual, OCS/Zabbix) sem uma tabela unica -
// checagem de existencia deliberadamente sem FK, para que remover um ativo nunca quebre
// (CASCADE) um no/conexao ja salvos no mapa.
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

// Funciona pra ativo ou cluster porque a CHECK de consistencia da tabela
// garante que so um de ref_id/asset_id esta preenchido por linha - o outro
// e sempre NULL, entao COALESCE devolve exatamente o valor que importa.
export async function ensureNodeRefAvailable(mapId, nodeType, refValue, excludeNodeId = null, db = query) {
  const result = await db(
    `
      SELECT id
      FROM network_topology_nodes
      WHERE map_id = $1
        AND node_type = $2
        AND COALESCE(ref_id, asset_id) = $3
        AND ($4::text IS NULL OR id <> $4)
      LIMIT 1
    `,
    [mapId, nodeType, refValue, excludeNodeId]
  );

  if (result.rows.length) {
    throw makeHttpError(
      nodeType === "asset" ? "Este ativo ja esta posicionado neste mapa de rede." : "Este item ja esta posicionado neste mapa de rede.",
      409
    );
  }
}

export async function ensureLinkNotDuplicate(
  mapId,
  sourceType,
  targetType,
  sourceAssetId,
  targetAssetId,
  excludeLinkId = null,
  db = query
) {
  const result = await db(
    `
      SELECT id
      FROM network_topology_links
      WHERE map_id = $1
        AND ($6::text IS NULL OR id <> $6)
        AND (
          (source_type = $2 AND target_type = $3 AND source_asset_id = $4 AND target_asset_id = $5)
          OR (source_type = $3 AND target_type = $2 AND source_asset_id = $5 AND target_asset_id = $4)
        )
      LIMIT 1
    `,
    [mapId, sourceType, targetType, sourceAssetId, targetAssetId, excludeLinkId]
  );

  if (result.rows.length) {
    throw makeHttpError("Ja existe uma conexao entre estes dois itens neste mapa.", 409);
  }
}
