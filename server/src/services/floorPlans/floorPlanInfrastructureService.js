import {
  assertAssetHeatmapMetric,
  buildAssetHeatmap,
  buildInfrastructureSummary,
  buildServiceOrderHeatmap,
  parseHeatmapPeriod
} from "../../domain/floorPlans/floorPlanInfrastructure.js";
import { loadInfrastructureRows } from "../../repositories/floorPlans/floorPlanInfrastructureRepository.js";

export async function getFloorPlanAssetHeatmap(planId, metric = "availability", filters = {}) {
  assertAssetHeatmapMetric(metric);
  return buildAssetHeatmap(await loadInfrastructureRows(planId), metric, filters);
}

export async function getFloorPlanServiceOrderHeatmap(planId, startDate, endDate, filters = {}) {
  const { start, end } = parseHeatmapPeriod(startDate, endDate);
  return buildServiceOrderHeatmap(await loadInfrastructureRows(planId), start, end, filters);
}

export async function getFloorPlanInfrastructureSummary(planId, filters = {}) {
  return buildInfrastructureSummary(await loadInfrastructureRows(planId), filters);
}
