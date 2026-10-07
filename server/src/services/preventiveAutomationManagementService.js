import { normalizePagination } from "../domain/preventiveAutomationNormalizers.js";
import { isScheduleLinkedToPlan } from "../domain/preventiveAutomationSchedule.js";
import {
  buildAgendaItems,
  buildAgendaPagination,
  buildManagementMachines,
  buildManagementMetadata,
  buildManagementPlan,
  emptyAutomationAgenda,
  emptyManagementView,
  filterAgendaItemsAfterLoad,
  filterManagementMachines,
  groupByPlanId,
  normalizeAgendaFilters,
  summarizeAgenda
} from "../domain/preventiveAutomationViews.js";
import { canAccessAutomationAsset, canAccessAutomationPlan } from "../repositories/automationAccessScope.js";
import { listActivePlans } from "../repositories/preventiveAutomationPlanRepository.js";
import { findLatestOverrideForAsset, listOverridesByPlanIds } from "../repositories/preventiveAutomationOverrideRepository.js";
import {
  listAgendaPage,
  listAutomationHistoryForAsset,
  listPlanAuditLogs,
  listScriptSummariesByIds
} from "../repositories/preventiveAutomationQueryRepository.js";
import { findLatestRunForAsset, listLatestRunsByPlanIds } from "../repositories/preventiveAutomationRunRepository.js";
import { listGroupNamesById } from "../repositories/preventiveAutomationScopeRepository.js";
import { findActiveScheduleForAsset, listSchedulesByPlanIds } from "../repositories/preventiveAutomationScheduleRepository.js";
import { listDevices } from "./monitoringService.js";
import { findPreventiveAutomationPlanById, listPreventiveAutomationPlans } from "./preventiveAutomationPlanQueryService.js";

/**
 * Visoes de leitura do gerenciamento de automacoes: planos e maquinas, agenda,
 * historico do plano e detalhe de uma maquina dentro do plano. Os dados sao
 * buscados em lote e a montagem fica em `domain/preventiveAutomationViews.js`.
 */

function indexDevices(devices) {
  return new Map(devices.map((device) => [String(device.id), device]));
}

function uniqueScriptIds(plans) {
  return [...new Set(plans.flatMap((plan) => plan.defaultScriptIds).map(String))];
}

async function loadManagementData(selectedPlans) {
  const planIds = selectedPlans.map((plan) => plan.id);
  const [overrides, schedules, runsByAsset, scriptsById, groupsById, devices] = await Promise.all([
    listOverridesByPlanIds(planIds),
    listSchedulesByPlanIds(planIds),
    listLatestRunsByPlanIds(planIds),
    listScriptSummariesByIds(uniqueScriptIds(selectedPlans)),
    listGroupNamesById(),
    listDevices({})
  ]);

  return {
    overridesByPlan: groupByPlanId(overrides),
    schedules,
    schedulesByPlan: groupByPlanId(schedules),
    runsByAsset,
    scriptsById,
    groupsById,
    devicesById: indexDevices(devices)
  };
}

export async function listPreventiveAutomationManagement(user = null, options = {}) {
  const allPlans = await listActivePlans();
  const scopedPlans = allPlans.filter((plan) => canAccessAutomationPlan(plan, user));
  const limit = normalizePagination(options.limit, 100, 500);
  const offset = normalizePagination(options.offset, 0, 100000);
  const selectedPlans = scopedPlans.slice(offset, offset + limit);
  if (!selectedPlans.length) return emptyManagementView();

  const data = await loadManagementData(selectedPlans);
  const plans = selectedPlans.map((plan) =>
    buildManagementPlan({
      plan,
      overrides: data.overridesByPlan.get(String(plan.id)) || [],
      schedules: data.schedulesByPlan.get(String(plan.id)) || [],
      runsByAsset: data.runsByAsset,
      scriptsById: data.scriptsById
    })
  );
  const machines = buildManagementMachines({
    plans,
    schedules: data.schedules,
    devicesById: data.devicesById,
    groupsById: data.groupsById,
    runsByAsset: data.runsByAsset
  });
  const visibleMachines = filterManagementMachines(machines, options);

  return {
    plans,
    machines: visibleMachines,
    metadata: buildManagementMetadata(plans, visibleMachines),
    pagination: {
      limit,
      offset,
      total: scopedPlans.length,
      hasMore: offset + plans.length < scopedPlans.length
    }
  };
}

export async function listPreventiveAutomationAgenda(filters = {}, user = null) {
  const normalized = normalizeAgendaFilters(filters);

  const allowedPlans = await listPreventiveAutomationPlans(user, { limit: 500 });
  const allowedPlanIds = allowedPlans.map((plan) => String(plan.id));
  if (!allowedPlanIds.length) return emptyAutomationAgenda(normalized);
  if (normalized.planId && !allowedPlanIds.includes(String(normalized.planId))) {
    return emptyAutomationAgenda(normalized);
  }

  const page = await listAgendaPage({ filters: normalized, allowedPlanIds });
  const devices = await listDevices({});
  const agendaPlanIds = [...new Set(page.rows.map((row) => String(row.planId)))];
  const latestRunsByAsset = await listLatestRunsByPlanIds(agendaPlanIds);

  const now = new Date();
  const allItems = buildAgendaItems({
    rows: page.rows,
    devicesById: indexDevices(devices),
    latestRunsByAsset,
    now
  });
  const items = filterAgendaItemsAfterLoad(allItems, normalized);

  return {
    items,
    summary: summarizeAgenda(items, now),
    pagination: buildAgendaPagination({
      normalized,
      items,
      pageRowCount: page.rows.length,
      totalCount: page.total
    })
  };
}

export async function listPreventiveAutomationPlanHistory(planId, options = {}, user = null) {
  const limit = normalizePagination(options.limit, 50, 100);
  const plan = await findPreventiveAutomationPlanById(planId, user);
  if (!plan) return null;

  return { items: await listPlanAuditLogs(planId, limit), limit };
}

/** Detalhe de uma maquina no plano; `null` se o plano, a agenda ou o acesso nao existirem. */
export async function findPreventiveAutomationAssetDetails(planId, assetId, user = null) {
  const plan = await findPreventiveAutomationPlanById(planId, user);
  if (!plan) return null;
  const [schedule, override, latestRun, history, devices] = await Promise.all([
    findActiveScheduleForAsset(planId, assetId),
    findLatestOverrideForAsset(planId, assetId),
    findLatestRunForAsset(planId, assetId),
    listAutomationHistoryForAsset(assetId),
    listDevices({})
  ]);
  const device = devices.find((item) => String(item.id) === String(assetId));
  if (!schedule || !device || !canAccessAutomationAsset(device, user) || !isScheduleLinkedToPlan(plan, schedule)) {
    return null;
  }

  const machinePlan = { ...schedule, id: plan.id, planName: plan.name, active: plan.active, latestRun };
  const machine = {
    assetId,
    assetName: device.name || assetId,
    assetType: device.assetType || device.type || "Ativo",
    operatingSystem: device.operatingSystem || "",
    segmentId: device.segmentId || "",
    groupId: device.segmentGroupId || "",
    plans: [machinePlan]
  };

  return { plan, machine, schedule: machinePlan, override, history };
}
