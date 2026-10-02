import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { conflict } from "../lib/errors.js";
import { computeNextScheduledFor } from "../domain/preventiveSchedule.js";
import { normalizePlanPayload, assertUniqueOverrides } from "../domain/preventiveAutomationPayload.js";
import { addAssetHistory } from "../repositories/assetHistoryRepository.js";
import { addLog } from "../repositories/logRepository.js";
import {
  deactivatePlan,
  findPlanIdentityConflict,
  insertPlan,
  reactivatePlanRow,
  softDeletePlan,
  updatePlan
} from "../repositories/preventiveAutomationPlanRepository.js";
import {
  deleteOverridesOfPlan,
  insertOverride
} from "../repositories/preventiveAutomationOverrideRepository.js";
import {
  deactivateSchedulesOfPlan,
  reactivateAssetSchedule
} from "../repositories/preventiveAutomationScheduleRepository.js";
import { findPreventiveAutomationPlanById } from "./preventiveAutomationPlanQueryService.js";
import { refreshPlanNextRun, syncAssetSchedulesForPlan } from "./preventiveAutomationScheduleService.js";
import { validateScopeSelection, validateScripts } from "./preventiveAutomationScopeService.js";

/**
 * Casos de uso de escrita dos planos de automacao preventiva: criar, editar,
 * pausar, reativar e excluir logicamente. Cada operacao valida o payload e o
 * escopo, grava em uma unica transacao e registra historico e auditoria.
 */

export function actorName(user) {
  return user?.name || user?.email || "Sistema";
}

function automationHistoryMessage(plan, prefix) {
  const scriptCount = Array.isArray(plan.defaultScriptIds) ? plan.defaultScriptIds.length : 0;
  return (
    `${prefix} '${plan.name}'. Recorrência: ${plan.recurrenceType}, ` +
    `${plan.recurrenceInterval} dia(s), ${scriptCount} verificação(ões).`
  );
}

/** Nome e cor de indicador devem ser unicos entre planos nao excluidos. */
async function assertUniquePlanIdentity({ name, indicatorColor }, excludeId = null, db = query) {
  const found = await findPlanIdentityConflict({ name, indicatorColor }, excludeId, db);
  if (!found) return;

  if (String(found.name || "").trim().toLowerCase() === name.trim().toLowerCase()) {
    throw conflict("Já existe uma automatização com esse nome.");
  }

  throw conflict(`A cor ${indicatorColor} já está sendo usada por outra automatização.`);
}

async function replaceOverrides(planId, overrides = [], db = query) {
  assertUniqueOverrides(overrides);
  await deleteOverridesOfPlan(db, planId);

  for (const override of overrides) {
    await insertOverride(db, planId, override);
  }
}

/** Valida payload, scripts e escopo e define a primeira agenda do plano. */
async function prepareNewPlan(payload, user) {
  const normalized = normalizePlanPayload(payload);
  await validateScripts(normalized.defaultScriptIds);
  const assets = await validateScopeSelection(normalized, { user });
  const scheduleAnchorAt = new Date().toISOString();
  const nextRunAt = computeNextScheduledFor(normalized, scheduleAnchorAt);

  return { normalized, assets, scheduleAnchorAt, nextRunAt };
}

/** Grava o plano, os overrides e as agendas por maquina dentro de `db`. */
async function persistNewPlan(db, { id, preventivePlanId, prepared, user }) {
  const { normalized, assets, scheduleAnchorAt, nextRunAt } = prepared;

  await insertPlan(db, {
    id,
    preventivePlanId,
    plan: normalized,
    nextRunAt,
    scheduleAnchorAt,
    createdBy: user?.id || null
  });

  const overrides = normalized.overrides || [];
  await replaceOverrides(id, overrides, db);
  await syncAssetSchedulesForPlan({ ...normalized, id, overrides, scheduleAnchorAt, createdAt: scheduleAnchorAt }, assets, db);
}

/**
 * Cria o plano vinculado a um plano preventivo dentro da transacao `db` do
 * chamador (fluxo unificado de Preventivas). Devolve o id do novo plano.
 */
export async function createPreventiveAutomationPlanRecord(payload = {}, user = null, db = query) {
  const prepared = await prepareNewPlan(payload, user);
  const { normalized, nextRunAt } = prepared;
  const id = payload.id || randomUUID();

  await persistNewPlan(db, { id, preventivePlanId: normalized.preventivePlanId, prepared, user });
  await addLog({
    type: "preventive_automation_created",
    message: `Automacao preventiva criada: ${normalized.name}. Rotina aguardando agente seguro.`,
    userId: user?.id || null,
    meta: {
      preventivePlanId: normalized.preventivePlanId,
      preventiveAutomationPlanId: id,
      scopeType: normalized.scopeType,
      scopeId: normalized.scopeId,
      assetIds: normalized.assetIds,
      nextRunAt
    },
    db
  });

  return id;
}

export async function createPreventiveAutomationPlan(payload = {}, user = null) {
  const prepared = await prepareNewPlan(payload, user);
  const { normalized, assets, nextRunAt } = prepared;
  const id = randomUUID();

  await withTransaction(async (db) => {
    await assertUniquePlanIdentity(normalized, null, db);
    await persistNewPlan(db, { id, preventivePlanId: null, prepared, user });
    for (const asset of assets) {
      await addAssetHistory({
        assetId: asset.id,
        eventType: "preventive_automation_created",
        message: automationHistoryMessage(normalized, "Automação preventiva vinculada"),
        newValue: id,
        userId: user?.id || null,
        userName: actorName(user),
        db
      });
    }
    await addLog({
      type: "preventive_automation_created",
      message: `Automação preventiva criada: ${normalized.name}. Rotina aguardando agente seguro.`,
      userId: user?.id || null,
      meta: {
        preventiveAutomationPlanId: id,
        scopeType: normalized.scopeType,
        scopeId: normalized.scopeId,
        assetIds: normalized.assetIds,
        nextRunAt
      },
      db
    });
  });

  return findPreventiveAutomationPlanById(id);
}

/** Evento de historico/auditoria de uma edicao: pausa, reativacao ou atualizacao comum. */
function describeUpdateEvent(normalized, statusChanged) {
  if (!statusChanged) {
    return {
      type: "preventive_automation_updated",
      logMessage: `Automação preventiva atualizada: ${normalized.name}.`,
      assetMessage: automationHistoryMessage(normalized, "Configuração da automação preventiva atualizada")
    };
  }

  const reactivated = normalized.active;
  const logMessage = reactivated
    ? `Automação preventiva reativada: ${normalized.name}.`
    : `Automação preventiva pausada: ${normalized.name}.`;
  return {
    type: reactivated ? "preventive_automation_reactivated" : "preventive_automation_paused",
    logMessage,
    assetMessage: `${logMessage} Agenda desta máquina ${reactivated ? "reativada" : "pausada"}.`
  };
}

export async function updatePreventiveAutomationPlan(id, payload = {}, user = null) {
  const current = await findPreventiveAutomationPlanById(id, user);
  if (!current) return null;

  const normalized = normalizePlanPayload(payload, current);
  await validateScripts(normalized.defaultScriptIds);
  const assets = await validateScopeSelection(normalized, { user });

  const scheduleAnchorAt = current.scheduleAnchorAt || new Date().toISOString();
  const nextRunAt = computeNextScheduledFor(normalized, new Date());
  const event = describeUpdateEvent(normalized, current.active !== normalized.active);

  await withTransaction(async (db) => {
    await assertUniquePlanIdentity(normalized, id, db);
    await updatePlan(db, { id, plan: normalized, nextRunAt, scheduleAnchorAt });

    const overrides = normalized.overrides || current.overrides || [];
    if (normalized.overrides) {
      await replaceOverrides(id, overrides, db);
    }
    await syncAssetSchedulesForPlan({ ...normalized, id, overrides, scheduleAnchorAt }, assets, db);
    for (const asset of assets) {
      await addAssetHistory({
        assetId: asset.id,
        eventType: event.type,
        message: event.assetMessage,
        userId: user?.id || null,
        userName: actorName(user),
        db
      });
    }
    await addLog({
      type: event.type,
      message: event.logMessage,
      userId: user?.id || null,
      meta: {
        preventiveAutomationPlanId: id,
        scopeType: normalized.scopeType,
        scopeId: normalized.scopeId,
        assetIds: normalized.assetIds,
        nextRunAt,
        active: normalized.active
      },
      db
    });
  });

  return findPreventiveAutomationPlanById(id);
}

export async function disablePreventiveAutomationPlan(id, user = null) {
  const current = await findPreventiveAutomationPlanById(id, user);
  if (!current) return null;

  await withTransaction(async (db) => {
    await deactivatePlan(db, id);
    await deactivateSchedulesOfPlan(db, id);

    for (const schedule of current.assetSchedules || []) {
      await addAssetHistory({
        assetId: schedule.assetId,
        eventType: "preventive_automation_paused",
        message: `Automacao preventiva pausada: ${current.name}. Agenda desta maquina pausada.`,
        userId: user?.id || null,
        userName: actorName(user),
        db
      });
    }

    await addLog({
      type: "preventive_automation_paused",
      message: `Automação preventiva desativada: ${current.name}.`,
      userId: user?.id || null,
      meta: { preventiveAutomationPlanId: id },
      db
    });
  });

  return findPreventiveAutomationPlanById(id, user);
}

export async function reactivatePreventiveAutomationPlan(id, user = null) {
  const current = await findPreventiveAutomationPlanById(id, user);
  if (!current || current.deletedAt) return null;

  await withTransaction(async (db) => {
    await reactivatePlanRow(db, id);

    for (const schedule of current.assetSchedules || []) {
      const nextRunAt = computeNextScheduledFor(
        {
          recurrenceType: schedule.recurrenceType || current.recurrenceType,
          recurrenceIntervalDays: schedule.recurrenceIntervalDays || current.recurrenceIntervalDays,
          preferredTime: schedule.preferredTime || current.preferredTime,
          timezone: schedule.timezone || current.timezone
        },
        new Date()
      );

      await reactivateAssetSchedule(db, { planId: id, assetId: schedule.assetId, nextRunAt });
      await addAssetHistory({
        assetId: schedule.assetId,
        eventType: "preventive_automation_reactivated",
        message: `Automacao preventiva reativada: ${current.name}. Proxima preparacao recalculada.`,
        userId: user?.id || null,
        userName: actorName(user),
        db
      });
    }

    const nextRunAt = await refreshPlanNextRun(id, db);
    await addLog({
      type: "preventive_automation_reactivated",
      message: `Automacao preventiva reativada: ${current.name}.`,
      userId: user?.id || null,
      meta: {
        preventiveAutomationPlanId: id,
        nextRunAt
      },
      db
    });
  });

  return findPreventiveAutomationPlanById(id, user);
}

export async function deletePreventiveAutomationPlan(id, user = null) {
  const current = await findPreventiveAutomationPlanById(id, user);
  if (!current) return null;
  const affectedAssetCount = current.assetSchedules.filter((schedule) => schedule.active !== false).length;

  await withTransaction(async (db) => {
    await softDeletePlan(db, id);
    await deactivateSchedulesOfPlan(db, id);
    await addLog({
      type: "preventive_automation_deleted",
      message: `Plano de automacao preventiva excluido: ${current.name}. Historico preservado.`,
      userId: user?.id || null,
      meta: {
        planId: id,
        preventivePlanId: current.preventivePlanId,
        name: current.name,
        affectedAssetCount,
        userId: user?.id || null,
        timestamp: new Date().toISOString()
      },
      db
    });
  });

  return { ...current, active: false, deletedAt: new Date().toISOString(), affectedAssetCount };
}
