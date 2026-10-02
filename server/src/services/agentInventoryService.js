import { randomUUID } from "node:crypto";
import { withTransaction } from "../database.js";
import { deriveMetricSampleFields, hasUsefulMetricPayload } from "../domain/assetMetricSample.js";
import { resolveAgentConnectionEvent } from "../domain/agentPresence.js";
import {
  findAgentAssetPresence,
  insertAgentHeartbeat,
  syncDeviceActivationFromHeartbeat,
  touchAgentEnrollment,
  upsertAgentAsset
} from "../repositories/agents/agentInventoryRepository.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import { insertAssetMetricSample } from "../repositories/assetMetricHistoryRepository.js";

/**
 * Registra o inventario/heartbeat de um agente autenticado numa unica
 * transacao: ativo, heartbeat bruto, amostra de metricas, uso do enrollment,
 * ativacao do dispositivo e, quando for o caso, o evento de (re)conexao no
 * historico do ativo. Devolve o ativo atualizado.
 */
export async function recordAgentInventory({ enrollment, payload }) {
  return withTransaction(async (db) => {
    const previous = await findAgentAssetPresence(db, payload.machineId);
    const asset = await upsertAgentAsset(db, { enrollmentId: enrollment.id, payload });

    await insertAgentHeartbeat(db, { id: randomUUID(), enrollmentId: enrollment.id, payload });

    if (hasUsefulMetricPayload(payload)) {
      await insertAssetMetricSample({
        assetId: payload.machineId,
        collectedAt: payload.collectedAt,
        ...deriveMetricSampleFields(payload),
        db
      });
    }

    await touchAgentEnrollment(db, enrollment.id);
    if (enrollment.activationId) {
      await syncDeviceActivationFromHeartbeat(db, { activationId: enrollment.activationId, payload });
    }

    const connectionEvent = resolveAgentConnectionEvent({ previous, payload, enrollmentId: enrollment.id });
    if (connectionEvent) {
      await addAssetHistory({
        assetId: payload.machineId,
        eventType: connectionEvent.eventType,
        message: connectionEvent.message,
        newValue: connectionEvent.newValue,
        userName: "Agente IT Guardian",
        db
      });
    }

    return asset;
  });
}
