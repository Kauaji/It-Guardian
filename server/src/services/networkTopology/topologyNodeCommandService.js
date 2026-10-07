import { randomUUID } from "node:crypto";
import { withTransaction } from "../../database.js";
import { makeHttpError } from "../../domain/networkTopology/topologyErrors.js";
import { finiteNumber, normalizeNodePayload, nullableText } from "../../domain/networkTopology/topologyPayload.js";
import { addAssetHistory } from "../../repositories/assetHistoryRepository.js";
import { addLog } from "../../repositories/logRepository.js";
import {
  ensureAssetsExist,
  ensureNodeRefAvailable,
  getMapOrThrow,
  getNodeOrThrow
} from "../../repositories/networkTopology/topologyGuards.js";
import {
  deleteTopologyNodeRow,
  insertTopologyNodeRow,
  updateTopologyNodePositionRow,
  updateTopologyNodeRow
} from "../../repositories/networkTopology/topologyNodeRepository.js";

export async function createNetworkTopologyNode(mapId, payload, user) {
  const data = normalizeNodePayload(payload);
  const id = randomUUID();
  const refValue = data.assetId ?? data.refId;

  return withTransaction(async (db) => {
    await getMapOrThrow(mapId, db);
    if (data.nodeType === "asset") {
      await ensureAssetsExist([data.assetId], db);
    }
    await ensureNodeRefAvailable(mapId, data.nodeType, refValue, null, db);

    const node = await insertTopologyNodeRow(db, { id, mapId, data });

    await addLog({
      type: "inventory.network_topology.node.created",
      message: data.nodeType === "asset" ? `Ativo adicionado ao mapa de rede.` : `Item adicionado ao mapa de rede.`,
      userId: user?.id,
      meta: { mapId, nodeId: id, nodeType: data.nodeType, assetId: data.assetId, refId: data.refId },
      db
    });
    if (data.assetId) {
      await addAssetHistory({
        assetId: data.assetId,
        eventType: "network_topology_node_added",
        message: "Ativo adicionado a um mapa de rede.",
        userId: user?.id,
        userName: user?.name,
        db
      });
    }

    return node;
  });
}

export async function updateNetworkTopologyNode(id, payload, user) {
  return withTransaction(async (db) => {
    const existing = await getNodeOrThrow(id, db);
    const data = normalizeNodePayload(payload, existing);
    const refValue = data.assetId ?? data.refId;
    const existingRefValue = existing.assetId ?? existing.refId;
    if (data.nodeType !== existing.nodeType || refValue !== existingRefValue) {
      if (data.nodeType === "asset") {
        await ensureAssetsExist([data.assetId], db);
      }
      await ensureNodeRefAvailable(existing.mapId, data.nodeType, refValue, id, db);
    }

    const node = await updateTopologyNodeRow(db, { id, data });

    await addLog({
      type: "inventory.network_topology.node.updated",
      message: data.nodeType === "asset" ? `Ativo atualizado no mapa de rede.` : `Item atualizado no mapa de rede.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, nodeId: id, nodeType: data.nodeType, assetId: data.assetId, refId: data.refId },
      db
    });

    return node;
  });
}

// Salva em lote as posicoes arrastadas no canvas (botao "Salvar layout") - um unico
// PATCH em vez de um PATCH por no movido.
export async function bulkUpdateNetworkTopologyNodePositions(mapId, positions, user) {
  return withTransaction(async (db) => {
    await getMapOrThrow(mapId, db);
    const updated = [];

    for (const entry of positions) {
      const nodeId = nullableText(entry.nodeId ?? entry.id);
      if (!nodeId) continue;
      const existing = await getNodeOrThrow(nodeId, db);
      if (existing.mapId !== mapId) {
        throw makeHttpError("No informado pertence a outro mapa de rede.");
      }

      const x = finiteNumber(entry.x, existing.x);
      const y = finiteNumber(entry.y, existing.y);
      updated.push(await updateTopologyNodePositionRow(db, { id: nodeId, x, y }));
    }

    if (updated.length) {
      await addLog({
        type: "inventory.network_topology.node.positions_saved",
        message: `Layout do mapa de rede salvo (${updated.length} ativo(s)).`,
        userId: user?.id,
        meta: { mapId, nodeIds: updated.map((node) => node.id) },
        db
      });
    }

    return updated;
  });
}

export async function deleteNetworkTopologyNode(id, user) {
  return withTransaction(async (db) => {
    const existing = await getNodeOrThrow(id, db);
    await deleteTopologyNodeRow(db, id);
    await addLog({
      type: "inventory.network_topology.node.deleted",
      message: existing.assetId ? `Ativo removido do mapa de rede.` : `Item removido do mapa de rede.`,
      userId: user?.id,
      meta: { mapId: existing.mapId, nodeId: id, nodeType: existing.nodeType, assetId: existing.assetId, refId: existing.refId },
      db
    });
    if (existing.assetId) {
      await addAssetHistory({
        assetId: existing.assetId,
        eventType: "network_topology_node_removed",
        message: "Ativo removido de um mapa de rede.",
        userId: user?.id,
        userName: user?.name,
        db
      });
    }
    return existing;
  });
}
