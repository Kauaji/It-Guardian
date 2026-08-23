import { notFoundError } from "../lib/errors.js";
import { findAgentAssetById } from "../repositories/agentRepository.js";
import { listAssetMetricSamples } from "../repositories/assetMetricHistoryRepository.js";

const PERIOD_TO_MS = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000
};
const DEFAULT_PERIOD = "24h";
const ROW_HARD_CAP = 2000;
const DEFAULT_TARGET_POINTS = 200;

const METRIC_COLUMNS = {
  cpu: "cpuUsagePercent",
  ram: "memoryUsagePercent",
  disk: "diskUsagePercent"
};

export function resolvePeriod(period) {
  return PERIOD_TO_MS[period] ? period : DEFAULT_PERIOD;
}

export function resolveSince(period, now = Date.now()) {
  const windowMs = PERIOD_TO_MS[resolvePeriod(period)];
  return new Date(now - windowMs).toISOString();
}

/**
 * Downsampling puro em JS - nunca date_trunc/width_bucket no SQL (nao
 * verificados contra o pg-mem dos testes). Abaixo do alvo, devolve os
 * pontos como estao; acima, agrupa em blocos e emite media por bloco.
 */
export function bucketSamples(points, targetPoints = DEFAULT_TARGET_POINTS) {
  if (points.length <= targetPoints) return points;

  const bucketSize = Math.ceil(points.length / targetPoints);
  const buckets = [];
  for (let index = 0; index < points.length; index += bucketSize) {
    const chunk = points.slice(index, index + bucketSize);
    const average = chunk.reduce((sum, point) => sum + point.value, 0) / chunk.length;
    buckets.push({
      collectedAt: chunk[chunk.length - 1].collectedAt,
      value: Math.round(average)
    });
  }
  return buckets;
}

/** Calculado a partir do conjunto completo (nunca do downsample), para nao perder precisao nos extremos. */
export function summarize(points) {
  if (!points.length) return null;

  const values = points.map((point) => point.value);
  const sum = values.reduce((total, value) => total + value, 0);

  return {
    current: points[points.length - 1].value,
    average: Math.round((sum / values.length) * 10) / 10,
    min: Math.min(...values),
    max: Math.max(...values),
    samples: points.length,
    lastCollectedAt: points[points.length - 1].collectedAt
  };
}

function buildMetricReport(samples, metric, targetPoints) {
  const column = METRIC_COLUMNS[metric];
  const points = samples
    .filter((sample) => sample[column] != null)
    .map((sample) => ({ collectedAt: sample.collectedAt, value: sample[column] }));

  return {
    summary: summarize(points),
    points: bucketSamples(points, targetPoints),
    warnings: points.length ? [] : ["no_data"]
  };
}

export async function getDeviceMetricHistory(assetId, params = {}) {
  const asset = await findAgentAssetById(assetId);
  if (!asset) throw notFoundError("Ativo nao encontrado.");

  const period = resolvePeriod(params.period);
  const since = resolveSince(period);
  const samples = await listAssetMetricSamples({ assetId, since, limit: ROW_HARD_CAP });

  const requestedMetric = String(params.metric || "cpu").toLowerCase();

  if (requestedMetric === "all") {
    return {
      assetId,
      period,
      cpu: buildMetricReport(samples, "cpu"),
      ram: buildMetricReport(samples, "ram"),
      disk: buildMetricReport(samples, "disk")
    };
  }

  const metric = METRIC_COLUMNS[requestedMetric] ? requestedMetric : "cpu";
  return { assetId, metric, period, ...buildMetricReport(samples, metric) };
}
