import { randomUUID } from "node:crypto";
import { withTransaction } from "../../database.js";
import { normalizeLinkPayload } from "../../domain/networkTopology/topologyPayload.js";
import { addAssetHistory } from "../../repositories/assetHistoryRepository.js";
import { addLog } from "../../repositories/logRepository.js";
import {
  ensureAssetsExist,
  ensureLinkNotDuplicate,
  getLinkOrThrow,
  getMapOrThrow
} from "../../repositories/networkTopology/topologyGuards.js";
import {
  deleteTopologyLinkRow,
  insertTopologyLinkRow,
  updateTopologyLinkRow
} from "../../repositories/networkTopology/topologyLinkRepository.js";

export async function createNetworkTopologyLink(mapId, payload, user) {
  const data = normalizeLinkPayload(payload);
  const id = randomUUID();

  return withTransaction(async (db) => {
    await getMapOrThrow(mapId, db);
    if (data.sourceType === "asset") {
      await ensureAssetsExist([data.sourceAssetId, data.targetAssetId], db);
    }
    await ensureLinkNotDuplicate(mapId, data.sourceType, data.targetType, data.sourceAssetId, data.targetAssetId, null, db);

    const link = await insertTopologyLinkRow(db, { id, mapId, data });

    await addLog({
      type: "inventory.network_topology.link.created",
      message: `Conexao criada no mapa de rede.`,
      userId: user?.id,
      meta: { mapId, linkId: id, sourceType: data.sourceType, sourceAssetId: data.sourceAssetId, targetAssetId: data.targetAssetId },
      db
    });
    if (data.sourceType === "asset") {
      for (const assetId of [data.sourceAssetId, data.targetAssetId]) {
        await addAssetHistory({
          assetId,
          eventType: "network_topology_link_created",
          message: "Conexao criada no mapa de rede envolvendo este ativo.",
          userId: user?.id,
          userName: user?.name,
          db
        });
      }
    }

    return link;
  });
}

export async function updateNetworkTopologyLink(id, payload, user) {
  return withTransaction(async (db) => {
    const existing = await getLinkOrThrow(id, db);
    const data = normalizeLinkPayload(payload, existing);
    if (
      data.sourceType !== existing.sourceType ||
      data.sourceAssetId !== existing.sourceAssetId ||
      data.targetAssetId !== existing.targetAssetId
    ) {
      if (data.sourceType === "asset") {
        await ensureAssetsExist([data.sourceAssetId, data.targetAssetId], db);
      }
      await ensureLinkNotDuplicate(existing.mapId, data.sourceType, data.targetType, data.sourceAssetId, data.targetAssetId, id, db);
    }

    const link = await updateTopologyLinkRow(db, { id, data });

    await addLog({
      type: "inventory.network_topology.link.updated",
      message: `Conexao atualizada no mapa de rede.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, linkId: id },
      db
    });

    return link;
  });
}

export async function deleteNetworkTopologyLink(id, user) {
  return withTransaction(async (db) => {
    const existing = await getLinkOrThrow(id, db);
    await deleteTopologyLinkRow(db, id);
    await addLog({
      type: "inventory.network_topology.link.deleted",
      message: `Conexao removida do mapa de rede.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, linkId: id },
      db
    });
    if (existing.sourceType === "asset") {
      for (const assetId of [existing.sourceAssetId, existing.targetAssetId]) {
        await addAssetHistory({
          assetId,
          eventType: "network_topology_link_removed",
          message: "Conexao removida do mapa de rede envolvendo este ativo.",
          userId: user?.id,
          userName: user?.name,
          db
        });
      }
    }
    return existing;
  });
}
