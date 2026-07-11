export function automationPlanHasError(plan = {}) {
  const status = String(plan.status || plan.latestRun?.status || "").toLowerCase();
  const scheduleHasError = Array.isArray(plan.assetSchedules) && plan.assetSchedules.some((schedule) => {
    const scheduleStatus = String(schedule.status || "").toLowerCase();
    const latestRun = schedule.latestRun || schedule.latest_run || {};
    const runStatus = String(latestRun.status || "").toLowerCase();

    return scheduleStatus === "error" || runStatus === "error" || runStatus === "failed" || Boolean(
      latestRun.errorDetected || latestRun.error_detected
    );
  });

  return (
    status === "error" ||
    status === "failed" ||
    Boolean(plan.latestRun?.errorDetected || plan.latestRun?.error_detected) ||
    Number(plan.errorAssetCount || 0) > 0 ||
    scheduleHasError
  );
}

export function automationPlanWithoutSchedule(plan = {}) {
  if (plan.active === false) return false;
  if (Number(plan.withoutScheduleCount || 0) > 0) return true;

  const schedules = Array.isArray(plan.assetSchedules) ? plan.assetSchedules : [];
  const activeSchedules = schedules.filter((schedule) => schedule.active !== false);

  if (!plan.nextRunAt && activeSchedules.length === 0) return true;
  return activeSchedules.some((schedule) => !schedule.nextRunAt && !schedule.next_run_at);
}

export function getAutomationMachineStatusSummary(machine = {}) {
  const plans = Array.isArray(machine.plans) ? machine.plans : [];

  return plans.reduce((summary, plan) => {
    summary.totalCount += 1;
    if (plan.active === false) summary.inactiveCount += 1;
    else summary.activeCount += 1;
    if (automationPlanHasError(plan)) summary.errorCount += 1;
    if (plan.active !== false && !plan.nextRunAt) summary.withoutScheduleCount += 1;
    return summary;
  }, {
    totalCount: 0,
    activeCount: 0,
    inactiveCount: 0,
    errorCount: 0,
    withoutScheduleCount: 0
  });
}

export function machineMatchesAutomationStatus(machine, status = "all") {
  const summary = getAutomationMachineStatusSummary(machine);

  if (status === "all") return summary.totalCount > 0;
  if (status === "active") return summary.activeCount > 0;
  if (status === "inactive") return summary.inactiveCount > 0;
  if (status === "error") return summary.errorCount > 0;
  if (status === "without_schedule") return summary.withoutScheduleCount > 0;
  return false;
}

function countLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatAutomationMachineStatusSummary(machine = {}) {
  const summary = getAutomationMachineStatusSummary(machine);
  const labels = [];

  if (summary.activeCount) labels.push(countLabel(summary.activeCount, "ativo", "ativos"));
  if (summary.inactiveCount) labels.push(countLabel(summary.inactiveCount, "inativo", "inativos"));
  if (summary.errorCount) labels.push(countLabel(summary.errorCount, "com erro", "com erro"));
  if (summary.withoutScheduleCount) {
    labels.push(countLabel(summary.withoutScheduleCount, "sem agenda", "sem agenda"));
  }

  return labels.join(" • ") || "Sem planos";
}
