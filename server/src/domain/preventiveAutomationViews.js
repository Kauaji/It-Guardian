import { serializeTimestamp, trimString } from "../lib/textUtils.js";
import { isScheduleLinkedToPlan } from "./preventiveAutomationSchedule.js";
import { normalizeIndicatorColor, normalizePagination } from "./preventiveAutomationNormalizers.js";

/**
 * Montagem pura das visoes de gerenciamento (planos e maquinas) e da agenda de
 * automacoes preventivas. Recebe dados ja carregados e mapeados; nao acessa
 * banco nem relogio fora do `now` informado.
 */

const agendaStatuses = new Set(["all", "active", "overdue", "error", "without_schedule"]);

export function latestRunKey(planId, assetId) {
  return `${String(planId)}:${String(assetId)}`;
}

export function groupByPlanId(items) {
  const grouped = new Map();
  for (const item of items) {
    const key = String(item.planId);
    const list = grouped.get(key) || [];
    list.push(item);
    grouped.set(key, list);
  }
  return grouped;
}

function isErrorRun(run) {
  return Boolean(run.errorDetected) || String(run.status).toLowerCase() === "error";
}

function newestRun(runs) {
  return runs
    .slice()
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0] || null;
}

export function buildManagementPlan({ plan, overrides, schedules, runsByAsset, scriptsById }) {
  const assetSchedules = schedules.filter((schedule) => isScheduleLinkedToPlan(plan, schedule));
  const activeSchedules = assetSchedules.filter((schedule) => schedule.active !== false);
  const latestRuns = activeSchedules
    .map((schedule) => runsByAsset.get(latestRunKey(plan.id, schedule.assetId)))
    .filter(Boolean);

  return {
    ...plan,
    overrides,
    assetSchedules,
    scripts: plan.defaultScriptIds.map((id) => scriptsById.get(String(id))).filter(Boolean),
    assetCount: activeSchedules.length,
    scriptCount: plan.defaultScriptIds.length,
    overrideCount: overrides.filter((override) => override.active !== false).length,
    activeScheduleCount: activeSchedules.filter(() => plan.active !== false).length,
    errorAssetCount: latestRuns.filter(isErrorRun).length,
    withoutScheduleCount: activeSchedules.filter((schedule) => !schedule.nextRunAt).length,
    latestRun: newestRun(latestRuns)
  };
}

function buildMachineBase(device, groupsById) {
  const groupId = device.segmentGroupId || "";
  return {
    assetId: device.id,
    assetName: device.name || device.id,
    assetType: device.assetType || device.type || "Ativo",
    ip: device.ip || "",
    operatingSystem: device.hardware?.os || "",
    loggedUser: device.hardware?.loggedUser || "",
    status: device.status || "",
    statusLabel: device.statusLabel || device.status || "",
    segmentId: device.segmentId || "",
    segmentName: device.segmentName || "Nao organizadas",
    groupId,
    groupName: groupsById.get(String(groupId)) || "Sem grupo",
    tabId: "",
    tabName: "Ambiente",
    plans: []
  };
}

function buildMachinePlanEntry({ plan, schedule, device, latestRun }) {
  return {
    id: plan.id,
    automationPlanId: plan.id,
    preventivePlanId: plan.preventivePlanId,
    preventivePlanName: plan.preventivePlanName,
    planName: plan.name,
    name: plan.name,
    description: plan.description,
    notes: plan.notes,
    indicatorColor: plan.indicatorColor,
    active: plan.active !== false && schedule.active !== false,
    planActive: plan.active !== false,
    scheduleActive: schedule.active !== false,
    recurrenceSource: schedule.recurrenceSource,
    recurrenceType: schedule.recurrenceType,
    recurrenceIntervalDays: schedule.recurrenceIntervalDays,
    preferredTime: schedule.preferredTime,
    timezone: schedule.timezone,
    nextRunAt: schedule.nextRunAt,
    nextScheduledFor: schedule.nextRunAt,
    lastPreparedAt: schedule.lastPreparedAt,
    latestRun,
    assetCount: plan.assetCount,
    scriptCount: plan.scriptCount,
    scripts: plan.scripts,
    hasCustomOverride: plan.overrides.some(
      (override) => override.active !== false && String(override.assetId || "") === String(device.id)
    )
  };
}

/**
 * Reune as agendas ativas por maquina: uma maquina com varios planos aparece
 * uma unica vez, na ordem em que sua primeira agenda foi lida.
 */
export function buildManagementMachines({ plans, schedules, devicesById, groupsById, runsByAsset }) {
  const plansById = new Map(plans.map((plan) => [String(plan.id), plan]));
  const machinesById = new Map();

  for (const schedule of schedules) {
    const plan = plansById.get(String(schedule.planId));
    const device = devicesById.get(String(schedule.assetId));
    if (!plan || !device) continue;
    if (!isScheduleLinkedToPlan(plan, schedule)) continue;

    const machine = machinesById.get(String(device.id)) || buildMachineBase(device, groupsById);
    machine.plans.push(
      buildMachinePlanEntry({
        plan,
        schedule,
        device,
        latestRun: runsByAsset.get(latestRunKey(plan.id, device.id)) || null
      })
    );
    machinesById.set(String(device.id), machine);
  }

  return [...machinesById.values()];
}

function machineMatchesSearch(machine, search) {
  const haystack = `${machine.assetName} ${machine.segmentName} ${machine.groupName} ${machine.plans.map((item) => item.name).join(" ")}`;
  return haystack.toLowerCase().includes(search);
}

function machineMatchesStatus(machine, status) {
  if (status === "error") {
    return machine.plans.some((item) => item.latestRun?.errorDetected || item.latestRun?.status === "error");
  }
  if (status === "without_schedule") return machine.plans.some((item) => !item.nextRunAt);
  if (status === "active") return machine.plans.some((item) => item.active);
  if (status === "inactive") return machine.plans.some((item) => !item.active);
  return true;
}

export function filterManagementMachines(machines, options = {}) {
  const search = trimString(options.search, 120).toLowerCase();
  const status = trimString(options.status, 40, "all").toLowerCase();
  const segmentId = trimString(options.segmentId, 120);
  const groupId = trimString(options.groupId, 120);

  return machines.filter((machine) => {
    if (segmentId && String(machine.segmentId) !== segmentId) return false;
    if (groupId && String(machine.groupId) !== groupId) return false;
    if (search && !machineMatchesSearch(machine, search)) return false;
    return machineMatchesStatus(machine, status);
  });
}

export function buildManagementMetadata(plans, machines) {
  return {
    planCount: plans.length,
    activePlanCount: plans.filter((plan) => plan.active !== false).length,
    inactivePlanCount: plans.filter((plan) => plan.active === false).length,
    machineCount: machines.length,
    activeScheduleCount: plans.reduce((total, plan) => total + plan.activeScheduleCount, 0),
    errorCount: plans.reduce((total, plan) => total + plan.errorAssetCount, 0),
    withoutScheduleCount: plans.reduce((total, plan) => total + plan.withoutScheduleCount, 0)
  };
}

export function emptyManagementView() {
  return { plans: [], machines: [], metadata: { planCount: 0, machineCount: 0 } };
}

export function normalizeAgendaFilters(filters = {}) {
  const status = trimString(filters.status, 40, "all").toLowerCase();

  return {
    startDate: serializeTimestamp(filters.startDate),
    endDate: serializeTimestamp(filters.endDate),
    status: agendaStatuses.has(status) ? status : "all",
    planId: trimString(filters.planId, 120) || null,
    assetId: trimString(filters.assetId, 120) || null,
    segmentId: trimString(filters.segmentId, 120) || null,
    limit: normalizePagination(filters.limit, 200, 500),
    offset: normalizePagination(filters.offset, 0, 100000)
  };
}

export function emptyAutomationAgenda(normalized) {
  return {
    items: [],
    summary: {
      today: 0,
      nextSevenDays: 0,
      overdue: 0,
      withoutSchedule: 0,
      errors: 0
    },
    pagination: {
      limit: normalized.limit,
      offset: normalized.offset,
      total: 0,
      hasMore: false
    }
  };
}

export function agendaItemStatus({ planActive, scheduleActive, nextRunAt, latestRun }, now = new Date()) {
  if (!planActive || !scheduleActive) return "paused";
  if (latestRun?.errorDetected || String(latestRun?.status || "").toLowerCase() === "error") return "error";
  if (!nextRunAt) return "without_schedule";
  if (new Date(nextRunAt) < now) return "overdue";
  return "scheduled";
}

export function buildAgendaItems({ rows, devicesById, latestRunsByAsset, now = new Date() }) {
  return rows.map((row) => {
    const device = devicesById.get(String(row.assetId));
    const latestRun = latestRunsByAsset.get(latestRunKey(row.planId, row.assetId)) || null;
    return {
      planId: row.planId,
      planName: row.planName,
      assetId: row.assetId,
      assetName: device?.name || row.assetId,
      assetType: device?.assetType || device?.type || "Ativo",
      segmentId: device?.segmentId || "",
      segmentName: device?.segmentName || "Não organizadas",
      groupId: device?.segmentGroupId || "",
      indicatorColor: normalizeIndicatorColor(row.indicatorColor),
      scheduledFor: serializeTimestamp(row.nextRunAt),
      nextRunAt: serializeTimestamp(row.nextRunAt),
      recurrenceType: row.recurrenceType,
      recurrenceIntervalDays: Number(row.recurrenceInterval || 0),
      recurrenceSource: row.recurrenceSource || "plan",
      status: agendaItemStatus(
        {
          planActive: row.planActive !== false,
          scheduleActive: row.scheduleActive !== false,
          nextRunAt: row.nextRunAt,
          latestRun
        },
        now
      ),
      lastPreparedAt: serializeTimestamp(row.lastPreparedAt),
      latestRun
    };
  });
}

/** Filtros que so podem ser aplicados depois de cruzar com o inventario/execucoes. */
export function filterAgendaItemsAfterLoad(items, normalized) {
  let filtered = items;
  if (normalized.segmentId) {
    filtered = filtered.filter((item) => String(item.segmentId) === normalized.segmentId);
  }
  if (normalized.status === "error") {
    filtered = filtered.filter((item) => item.status === "error");
  }
  return filtered;
}

export function summarizeAgenda(items, now = new Date()) {
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const sevenDaysEnd = new Date(now);
  sevenDaysEnd.setDate(sevenDaysEnd.getDate() + 7);
  const within = (item, limit) => item.nextRunAt && new Date(item.nextRunAt) <= limit && new Date(item.nextRunAt) >= now;

  return {
    today: items.filter((item) => within(item, todayEnd)).length,
    nextSevenDays: items.filter((item) => within(item, sevenDaysEnd)).length,
    overdue: items.filter((item) => item.status === "overdue").length,
    withoutSchedule: items.filter((item) => item.status === "without_schedule").length,
    errors: items.filter((item) => item.status === "error").length
  };
}

export function buildAgendaPagination({ normalized, items, pageRowCount, totalCount }) {
  const localFilter = normalized.status === "error" || Boolean(normalized.segmentId);
  const total = localFilter ? items.length : Number(totalCount || 0);

  return {
    limit: normalized.limit,
    offset: normalized.offset,
    total,
    hasMore: localFilter ? false : normalized.offset + pageRowCount < total
  };
}
