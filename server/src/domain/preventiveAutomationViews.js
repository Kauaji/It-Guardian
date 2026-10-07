/** @import { AssetLike, AssetSchedule, AutomationPlan, LatestRun, PlanOverride } from "./preventiveTypes.js" */
import { serializeTimestamp, trimString } from "../lib/textUtils.js";
import { isScheduleLinkedToPlan } from "./preventiveAutomationSchedule.js";
import { normalizeIndicatorColor, normalizePagination } from "./preventiveAutomationNormalizers.js";

/**
 * Montagem pura das visoes de gerenciamento (planos e maquinas) e da agenda de
 * automacoes preventivas. Recebe dados ja carregados e mapeados; nao acessa
 * banco nem relogio fora do `now` informado.
 */

/**
 * Plano de automacao com os campos que as visoes leem (`defaultScriptIds` sempre presente).
 * @typedef {AutomationPlan & { defaultScriptIds: string[] }} ViewPlan
 */
/** @typedef {LatestRun & { planId?: string, assetId?: string }} ViewRun */
/**
 * Plano ja enriquecido por `buildManagementPlan`.
 * @typedef {ViewPlan & {
 *   overrides: PlanOverride[], assetSchedules: AssetSchedule[], scripts: unknown[], assetCount: number,
 *   scriptCount: number, overrideCount: number, activeScheduleCount: number, errorAssetCount: number,
 *   withoutScheduleCount: number, latestRun: ViewRun | null
 * }} ManagementPlan
 */
/**
 * @typedef {object} MachinePlanEntry
 * @property {string | undefined} name
 * @property {boolean} active
 * @property {string | null | undefined} nextRunAt
 * @property {ViewRun | null} latestRun
 * @property {unknown} [id]
 */
/**
 * @typedef {object} ManagementMachine
 * @property {string} assetId
 * @property {string} assetName
 * @property {string} segmentId
 * @property {string} segmentName
 * @property {string} groupId
 * @property {string} groupName
 * @property {MachinePlanEntry[]} plans
 */

const agendaStatuses = new Set(["all", "active", "overdue", "error", "without_schedule"]);

/**
 * @param {unknown} planId
 * @param {unknown} assetId
 * @returns {string} Chave `<plano>:<maquina>` dos mapas de ultima execucao.
 */
export function latestRunKey(planId, assetId) {
  return `${String(planId)}:${String(assetId)}`;
}

/**
 * @template {{ planId?: unknown }} T
 * @param {T[]} items
 * @returns {Map<string, T[]>}
 */
export function groupByPlanId(items) {
  /** @type {Map<string, T[]>} */
  const grouped = new Map();
  for (const item of items) {
    const key = String(item.planId);
    const list = grouped.get(key) || [];
    list.push(item);
    grouped.set(key, list);
  }
  return grouped;
}

/** @param {ViewRun} run */
function isErrorRun(run) {
  return Boolean(run.errorDetected) || String(run.status).toLowerCase() === "error";
}

/** @param {ViewRun[]} runs */
function newestRun(runs) {
  return runs.slice().sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())[0] || null;
}

/**
 * @param {object} input
 * @param {ViewPlan} input.plan
 * @param {PlanOverride[]} input.overrides
 * @param {AssetSchedule[]} input.schedules
 * @param {Map<string, ViewRun>} input.runsByAsset
 * @param {Map<string, unknown>} input.scriptsById
 * @returns {ManagementPlan}
 */
export function buildManagementPlan({ plan, overrides, schedules, runsByAsset, scriptsById }) {
  const assetSchedules = schedules.filter((schedule) => isScheduleLinkedToPlan(plan, schedule));
  const activeSchedules = assetSchedules.filter((schedule) => schedule.active !== false);
  const latestRuns = activeSchedules
    .map((schedule) => runsByAsset.get(latestRunKey(plan.id, schedule.assetId)))
    .filter((run) => run !== undefined);

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

/**
 * @param {AssetLike} device
 * @param {Map<string, string>} groupsById
 * @returns {ManagementMachine & Record<string, unknown>}
 */
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
    /** @type {MachinePlanEntry[]} */
    plans: []
  };
}

/**
 * @param {object} input
 * @param {ManagementPlan} input.plan
 * @param {AssetSchedule} input.schedule
 * @param {AssetLike} input.device
 * @param {ViewRun | null} input.latestRun
 * @returns {MachinePlanEntry & Record<string, unknown>}
 */
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
    hasCustomOverride: plan.overrides.some((override) => override.active !== false && String(override.assetId || "") === String(device.id))
  };
}

/**
 * Reune as agendas ativas por maquina: uma maquina com varios planos aparece
 * uma unica vez, na ordem em que sua primeira agenda foi lida.
 */
/**
 * @param {object} input
 * @param {ManagementPlan[]} input.plans
 * @param {Array<AssetSchedule>} input.schedules
 * @param {Map<string, AssetLike>} input.devicesById
 * @param {Map<string, string>} input.groupsById
 * @param {Map<string, ViewRun>} input.runsByAsset
 * @returns {Array<ManagementMachine & Record<string, unknown>>}
 */
export function buildManagementMachines({ plans, schedules, devicesById, groupsById, runsByAsset }) {
  const plansById = new Map(plans.map((plan) => [String(plan.id), plan]));
  /** @type {Map<string, ManagementMachine & Record<string, unknown>>} */
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

/**
 * @param {ManagementMachine} machine
 * @param {string} search Em minusculas.
 */
function machineMatchesSearch(machine, search) {
  const haystack = `${machine.assetName} ${machine.segmentName} ${machine.groupName} ${machine.plans.map((item) => item.name).join(" ")}`;
  return haystack.toLowerCase().includes(search);
}

/**
 * @param {ManagementMachine} machine
 * @param {string} status
 */
function machineMatchesStatus(machine, status) {
  if (status === "error") {
    return machine.plans.some((item) => item.latestRun?.errorDetected || item.latestRun?.status === "error");
  }
  if (status === "without_schedule") return machine.plans.some((item) => !item.nextRunAt);
  if (status === "active") return machine.plans.some((item) => item.active);
  if (status === "inactive") return machine.plans.some((item) => !item.active);
  return true;
}

/**
 * @template {ManagementMachine} M
 * @param {M[]} machines
 * @param {{ search?: unknown, status?: unknown, segmentId?: unknown, groupId?: unknown }} [options]
 * @returns {M[]}
 */
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

/**
 * @param {ManagementPlan[]} plans
 * @param {unknown[]} machines
 */
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

/**
 * @param {{ startDate?: string | Date | null, endDate?: string | Date | null, status?: unknown, planId?: unknown, assetId?: unknown, segmentId?: unknown, limit?: unknown, offset?: unknown }} [filters]
 */
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

/** @param {{ limit: number, offset: number }} normalized */
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

/**
 * @param {{ planActive: boolean, scheduleActive: boolean, nextRunAt?: string | Date | null, latestRun?: ViewRun | null }} item
 * @param {Date} [now]
 * @returns {"paused" | "error" | "without_schedule" | "overdue" | "scheduled"}
 */
export function agendaItemStatus({ planActive, scheduleActive, nextRunAt, latestRun }, now = new Date()) {
  if (!planActive || !scheduleActive) return "paused";
  if (latestRun?.errorDetected || String(latestRun?.status || "").toLowerCase() === "error") return "error";
  if (!nextRunAt) return "without_schedule";
  if (new Date(nextRunAt) < now) return "overdue";
  return "scheduled";
}

/**
 * Linha da agenda lida do banco.
 * @typedef {object} AgendaRow
 * @property {string} planId
 * @property {string} [planName]
 * @property {string} assetId
 * @property {string} [indicatorColor]
 * @property {string | Date | null} [nextRunAt]
 * @property {string} [recurrenceType]
 * @property {number | string | null} [recurrenceInterval]
 * @property {string | null} [recurrenceSource]
 * @property {boolean} [planActive]
 * @property {boolean} [scheduleActive]
 * @property {string | Date | null} [lastPreparedAt]
 */

/**
 * @param {object} input
 * @param {AgendaRow[]} input.rows
 * @param {Map<string, AssetLike>} input.devicesById
 * @param {Map<string, ViewRun>} input.latestRunsByAsset
 * @param {Date} [input.now]
 */
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
/**
 * @template {{ segmentId: string, status: string }} I
 * @param {I[]} items
 * @param {{ segmentId: string | null, status: string }} normalized
 * @returns {I[]}
 */
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

/**
 * @param {Array<{ nextRunAt: string | null, status: string }>} items
 * @param {Date} [now]
 */
export function summarizeAgenda(items, now = new Date()) {
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const sevenDaysEnd = new Date(now);
  sevenDaysEnd.setDate(sevenDaysEnd.getDate() + 7);
  /**
   * @param {{ nextRunAt: string | null }} item
   * @param {Date} limit
   */
  const within = (item, limit) => item.nextRunAt && new Date(item.nextRunAt) <= limit && new Date(item.nextRunAt) >= now;

  return {
    today: items.filter((item) => within(item, todayEnd)).length,
    nextSevenDays: items.filter((item) => within(item, sevenDaysEnd)).length,
    overdue: items.filter((item) => item.status === "overdue").length,
    withoutSchedule: items.filter((item) => item.status === "without_schedule").length,
    errors: items.filter((item) => item.status === "error").length
  };
}

/**
 * @param {{ normalized: { limit: number, offset: number, status: string, segmentId: string | null }, items: unknown[], pageRowCount: number, totalCount: unknown }} input
 */
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
