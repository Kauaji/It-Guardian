import { withTransaction } from "../database.js";
import { conflict } from "../lib/errors.js";
import { buildServiceOrderDraft } from "../domain/preventivePlanPayload.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import { startMaintenanceForAsset } from "../repositories/assetLifecycleRepository.js";
import { addLog } from "../repositories/logRepository.js";
import {
  hydratePlan,
  linkServiceOrder,
  lockPlanById,
  markPlanAssetsPrepared,
  markPlanSimulated
} from "../repositories/preventivePlanRepository.js";
import { addServiceOrderHistory, createServiceOrder, findServiceOrderById } from "../repositories/serviceOrderRepository.js";
import { findPreventivePlanById } from "./preventivePlanReadService.js";

/**
 * Ciclo de vida do plano preventivo apos o registro: confirmacao do preparo
 * (sem executar comandos) e criacao manual da OS preventiva vinculada.
 */

const duplicateServiceOrderMessage = "Este plano já possui uma OS preventiva vinculada.";

export async function preparePreventivePlan(id, user = null) {
  const preparedPlanId = await withTransaction(async (db) => {
    const plan = await hydratePlan(await lockPlanById(id, db), db);
    if (!plan) return null;

    await markPlanSimulated(db, id);
    await markPlanAssetsPrepared(db, id);
    await addLog({
      type: "preventive_plan_prepared",
      message: `Registro preventivo confirmado: ${plan.name}. Nenhum comando foi executado.`,
      userId: user?.id || null,
      meta: { preventivePlanId: id },
      db
    });

    return id;
  });

  return preparedPlanId ? findPreventivePlanById(preparedPlanId) : null;
}

async function createLinkedServiceOrder({ draft, user, db }) {
  try {
    return await createServiceOrder({ payload: draft.payload, user, db });
  } catch (error) {
    if (error?.code === "23505") throw conflict(duplicateServiceOrderMessage);
    throw error;
  }
}

async function registerServiceOrderLinks({ plan, serviceOrder, assetIds, user, db }) {
  await addServiceOrderHistory({
    serviceOrderId: serviceOrder.id,
    eventType: "preventive_plan_origin",
    message: `OS criada a partir do plano preventivo ${plan.name}.`,
    oldValue: null,
    newValue: plan.id,
    user,
    db
  });

  for (const assetId of assetIds) {
    await addAssetHistory({
      assetId,
      eventType: "preventive_plan_service_order",
      message: `Plano preventivo ${plan.name} gerou a OS preventiva ${serviceOrder.number}.`,
      newValue: serviceOrder.number,
      userId: user?.id || null,
      userName: user?.name || user?.email || "Sistema",
      db
    });
  }

  await addLog({
    type: "preventive_plan_service_order_created",
    message: `Plano preventivo ${plan.name} gerou a OS preventiva ${serviceOrder.number}.`,
    userId: user?.id || null,
    meta: {
      preventivePlanId: plan.id,
      serviceOrderId: serviceOrder.id,
      serviceOrderNumber: serviceOrder.number,
      assetCount: assetIds.length
    },
    db
  });
}

/** Inicia a manutencao do ativo da OS; conflito (ja em manutencao) e ignorado. */
async function startAssetMaintenance(serviceOrder, user) {
  if (!serviceOrder?.assetId) return;
  try {
    await startMaintenanceForAsset({
      assetId: serviceOrder.assetId,
      serviceOrderId: serviceOrder.id,
      notes: "Manutencao iniciada pela OS do plano preventivo.",
      user: user || { name: "Sistema" }
    });
  } catch (error) {
    if (error.statusCode !== 409) throw error;
  }
}

export async function createServiceOrderFromPreventivePlan(id, user = null) {
  const result = await withTransaction(async (db) => {
    const plan = await hydratePlan(await lockPlanById(id, db), db);
    if (!plan) return null;

    if (plan.serviceOrderId) {
      throw conflict(duplicateServiceOrderMessage);
    }

    const draft = buildServiceOrderDraft({ plan, user });
    const serviceOrder = await createLinkedServiceOrder({ draft, user, db });

    if (!(await linkServiceOrder(db, { planId: plan.id, serviceOrderId: serviceOrder.id }))) {
      throw conflict(duplicateServiceOrderMessage);
    }

    await registerServiceOrderLinks({ plan, serviceOrder, assetIds: draft.assetIds, user, db });

    return { preventivePlanId: plan.id, serviceOrderId: serviceOrder.id };
  });

  if (!result) return null;

  const serviceOrder = await findServiceOrderById(result.serviceOrderId);
  await startAssetMaintenance(serviceOrder, user);

  return {
    preventivePlan: await findPreventivePlanById(result.preventivePlanId),
    serviceOrder
  };
}
