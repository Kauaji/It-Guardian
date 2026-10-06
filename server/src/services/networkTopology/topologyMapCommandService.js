import { randomUUID } from "node:crypto";
import { withTransaction } from "../../database.js";
import { normalizeMapPayload } from "../../domain/networkTopology/topologyPayload.js";
import { addLog } from "../../repositories/logRepository.js";
import { getMapOrThrow } from "../../repositories/networkTopology/topologyGuards.js";
import {
  deleteTopologyMapRow,
  findMapRowByScope,
  insertTopologyMapRow,
  updateTopologyMapRow
} from "../../repositories/networkTopology/topologyMapRepository.js";

export async function createNetworkTopologyMap(payload, user) {
  const data = normalizeMapPayload(payload);
  const id = randomUUID();

  return withTransaction(async (db) => {
    const map = await insertTopologyMapRow(db, {
      id,
      name: data.name,
      scopeType: data.scopeType,
      scopeId: data.scopeId,
      userId: user?.id || null
    });

    await addLog({
      type: "inventory.network_topology.map.created",
      message: `Mapa de rede criado: ${data.name}.`,
      userId: user?.id,
      meta: { mapId: id },
      db
    });

    return map;
  });
}

export async function updateNetworkTopologyMap(id, payload, user) {
  return withTransaction(async (db) => {
    const existing = await getMapOrThrow(id, db);
    const data = normalizeMapPayload(payload, existing);
    const map = await updateTopologyMapRow(db, { id, data });

    await addLog({
      type: "inventory.network_topology.map.updated",
      message: `Mapa de rede atualizado: ${data.name}.`,
      userId: user?.id,
      meta: { mapId: id },
      db
    });

    return map;
  });
}

export async function deleteNetworkTopologyMap(id, user) {
  return withTransaction(async (db) => {
    const existing = await getMapOrThrow(id, db);
    await deleteTopologyMapRow(db, id);
    await addLog({
      type: "inventory.network_topology.map.deleted",
      message: `Mapa de rede removido: ${existing.name}.`,
      userId: user?.id,
      meta: { mapId: id },
      db
    });
    return existing;
  });
}

// Get-or-create: um mapa por segmento/grupo, criado na primeira vez que o
// tecnico abre aquele nivel na hierarquia, em vez de exigir um passo
// separado de "criar mapa" como o fluxo global de hoje.
export async function getOrCreateNetworkTopologyMapByScope(scopeType, scopeId, defaultName, user) {
  return withTransaction(async (db) => {
    const existing = await findMapRowByScope(db, scopeType, scopeId);
    if (existing) return existing;

    const id = randomUUID();
    const map = await insertTopologyMapRow(db, {
      id,
      name: defaultName,
      scopeType,
      scopeId,
      userId: user?.id || null
    });

    await addLog({
      type: "inventory.network_topology.map.created",
      message: `Mapa de rede criado automaticamente: ${defaultName}.`,
      userId: user?.id,
      meta: { mapId: id, scopeType, scopeId },
      db
    });

    return map;
  });
}
