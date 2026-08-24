import { listLogs } from "../../repositories/logRepository.js";

function clampLimit(value, fallback = 10, max = 50) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(1, Math.round(number)));
}

export async function fetchRecentEvents(config) {
  const logs = await listLogs();
  const limit = clampLimit(config?.limit);
  return {
    total: logs.length,
    rows: logs.slice(0, limit).map((log) => ({
      id: log.id,
      type: log.type,
      message: log.message,
      userName: log.user?.name || null,
      createdAt: log.createdAt
    }))
  };
}
