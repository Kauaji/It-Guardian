import { listRecentScriptExecutionLogs } from "../../repositories/maintenanceScriptRepository.js";

function clampLimit(value, fallback = 10, max = 30) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(1, Math.round(number)));
}

export async function fetchScriptExecutions(config) {
  const limit = clampLimit(config?.limit);
  const logs = await listRecentScriptExecutionLogs({ limit });
  return {
    rows: logs.map((log) => ({
      id: log.id,
      scriptName: log.scriptName,
      assetId: log.assetId,
      status: log.status,
      errorDetected: log.errorDetected,
      executedBy: log.executedBy,
      executedAt: log.executedAt,
      createdAt: log.createdAt
    }))
  };
}
