import { getDeviceMetricHistory } from "../assetMetricHistoryService.js";

/**
 * Widgets de metrica exigem config.assetId (o usuario escolhe o ativo ao
 * configurar o widget, nao existe um "ativo padrao"). Sem assetId, devolve
 * um estado explicito de "sem ativo selecionado" em vez de tentar adivinhar
 * um ativo ou inventar um valor.
 */
export function validateAssetMetricConfig(config) {
  if (!config || typeof config.assetId !== "string" || !config.assetId.trim()) {
    return "precisa de um ativo selecionado (config.assetId)";
  }
  return null;
}

function buildMetricHistoryFetcher(metric) {
  return async function fetchMetricHistory(config) {
    const assetId = config?.assetId;
    if (!assetId) {
      return { metric, assetId: null, period: null, points: [], summary: null, warnings: ["missing_asset"] };
    }
    // getDeviceMetricHistory ja lanca 404 (notFoundError) se o ativo nao
    // existir mais -- deixado propagar: o preview desse widget falha
    // isoladamente, sem afetar os demais widgets do dashboard.
    return getDeviceMetricHistory(assetId, { period: config?.period, metric });
  };
}

export const fetchMetricHistoryCpu = buildMetricHistoryFetcher("cpu");
export const fetchMetricHistoryRam = buildMetricHistoryFetcher("ram");
export const fetchMetricHistoryDisk = buildMetricHistoryFetcher("disk");

/**
 * Gauge mostra o valor ATUAL (mesma fonte que os cards de inventario ja
 * usam), nao um historico -- por isso le de listDevices() em vez do
 * asset_metric_history, evitando uma consulta extra so para um numero.
 */
function buildMetricGaugeFetcher(metricKey) {
  return async function fetchMetricGauge(config, ctx) {
    const assetId = config?.assetId;
    if (!assetId) return { metric: metricKey, assetId: null, available: false, value: null, status: null };

    const devices = await ctx.getDevices();
    const device = devices.find((candidate) => String(candidate.id) === String(assetId));
    if (!device) return { metric: metricKey, assetId, available: false, value: null, status: null };

    const value = device.metrics?.[metricKey];
    return {
      metric: metricKey,
      assetId,
      assetName: device.name,
      available: true,
      status: device.status,
      value: Number.isFinite(value) ? value : null
    };
  };
}

export const fetchMetricGaugeCpu = buildMetricGaugeFetcher("cpu");
export const fetchMetricGaugeRam = buildMetricGaugeFetcher("ram");
export const fetchMetricGaugeDisk = buildMetricGaugeFetcher("disk");
