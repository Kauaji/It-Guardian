/**
 * Replica exatamente a matematica ja usada em monitoringService.js's
 * buildAgentDevice (cpu/ram/disk em % para exibicao ao vivo) - nao
 * reinventar. Usada tanto na escrita (agentRepository.js, a cada
 * heartbeat) quanto, futuramente, em qualquer lugar que precise da mesma
 * derivacao sem duplicar a formula.
 */
export function deriveMetricSampleFields(payload = {}) {
  const memoryTotalBytes = payload.memoryTotalBytes ?? null;
  const memoryUsedBytes = payload.memoryUsedBytes ?? null;
  const diskTotalBytes = payload.diskTotalBytes ?? null;
  const diskFreeBytes = payload.diskFreeBytes ?? null;

  const memoryUsagePercent =
    memoryTotalBytes > 0 && memoryUsedBytes != null
      ? clampPercent(Math.round((memoryUsedBytes / memoryTotalBytes) * 100))
      : null;

  const diskUsedBytes = diskTotalBytes != null && diskFreeBytes != null ? diskTotalBytes - diskFreeBytes : null;
  const diskUsagePercent =
    diskTotalBytes > 0 && diskUsedBytes != null
      ? clampPercent(Math.round((diskUsedBytes / diskTotalBytes) * 100))
      : null;

  const cpuUsagePercent = payload.cpuUsagePercent != null ? clampPercent(Math.round(payload.cpuUsagePercent)) : null;

  return {
    cpuUsagePercent,
    memoryUsagePercent,
    memoryUsedBytes,
    memoryTotalBytes,
    diskUsagePercent,
    diskUsedBytes,
    diskTotalBytes
  };
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

/** Nunca grava uma linha so de nulls - pelo menos uma familia de metrica precisa estar presente. */
export function hasUsefulMetricPayload(payload = {}) {
  return payload.cpuUsagePercent != null || payload.memoryTotalBytes != null || payload.diskTotalBytes != null;
}
