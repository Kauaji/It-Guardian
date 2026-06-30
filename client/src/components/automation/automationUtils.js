export const recurrenceLabels = {
  daily: "Diária",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  custom_days: "Personalizada"
};

export function formatAutomationDate(value, fallback = "Não agendada") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatRecurrence(source = {}) {
  const type = source.recurrenceType || "monthly";
  const label = recurrenceLabels[type] || type;
  const interval = source.recurrenceIntervalDays || source.recurrenceInterval;
  return type === "custom_days" && interval ? `${label}: ${interval} dias` : label;
}

export function resolveMachineLocation(machine, devices = [], segments = [], groups = [], tabs = []) {
  const device = devices.find((item) => String(item.id) === String(machine.assetId)) || {};
  const segmentId = device.segmentId || machine.segmentId || "";
  const segment = segments.find((item) => String(item.id) === String(segmentId));
  const groupId = device.groupId || device.segmentGroupId || segment?.groupId || machine.groupId || "";
  const group = groups.find((item) => String(item.id) === String(groupId));
  const tabId = device.tabId || segment?.tabId || group?.tabId || machine.tabId || "";
  const tab = tabs.find((item) => String(item.id) === String(tabId));

  return {
    tabId,
    tabName: tab?.name || machine.tabName || "Ambiente",
    groupId,
    groupName: group?.name || machine.groupName || "Sem grupo",
    segmentId,
    segmentName: segment?.name || device.segmentName || machine.segmentName || "Não organizadas"
  };
}

export function automationMachineStatus(machine) {
  const plans = machine.plans || [];
  if (plans.some((plan) => plan.latestRun?.status === "error" || plan.latestRun?.errorDetected)) return "error";
  if (plans.some((plan) => plan.active && !plan.nextRunAt)) return "without_schedule";
  if (plans.some((plan) => plan.active)) return "active";
  return "inactive";
}

export function shouldShowAutomationManagement(canView, planCount) {
  return Boolean(canView) && Number(planCount || 0) > 0;
}

export function buildAutomationManagementGroups({
  machines = [],
  devices = [],
  segments = [],
  groups = [],
  tabs = [],
  search = "",
  status = "active"
} = {}) {
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const grouped = new Map();

  for (const machine of machines) {
    const location = resolveMachineLocation(machine, devices, segments, groups, tabs);
    const machineStatus = automationMachineStatus(machine);
    const matchesStatus = status === "all" || machineStatus === status;
    const searchable = [
      machine.assetName,
      machine.assetType,
      machine.operatingSystem,
      machine.loggedUser,
      location.tabName,
      location.groupName,
      location.segmentName,
      ...(machine.plans || []).map((plan) => plan.planName || plan.name)
    ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");

    if (!matchesStatus || (term && !searchable.includes(term))) continue;
    const key = `${location.tabId || location.tabName}:${location.groupId || location.groupName}:${location.segmentId || location.segmentName}`;
    const group = grouped.get(key) || { key, ...location, machines: [] };
    group.machines.push({ machine, location });
    grouped.set(key, group);
  }

  return [...grouped.values()].sort((left, right) =>
    `${left.tabName}${left.groupName}${left.segmentName}`.localeCompare(
      `${right.tabName}${right.groupName}${right.segmentName}`,
      "pt-BR"
    )
  );
}
