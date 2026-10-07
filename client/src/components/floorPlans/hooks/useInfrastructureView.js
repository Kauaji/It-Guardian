import { useEffect, useMemo, useState } from "react";
import { fetchFloorPlanAssetHeatmap, fetchFloorPlanServiceOrderHeatmap, fetchFloorPlanSummary } from "../../../api.js";
import { buildInfrastructureFilters, getInfrastructurePeriodRange, isSegmentCompatibleWithGroup } from "../utils/infrastructure.js";

function requestInfrastructureData({ token, planId, mode, metric, period, filters }) {
  if (mode === "dashboard") return fetchFloorPlanSummary(token, planId, filters);
  if (mode === "heatmap-assets") return fetchFloorPlanAssetHeatmap(token, planId, metric, filters);
  const range = getInfrastructurePeriodRange(period);
  return fetchFloorPlanServiceOrderHeatmap(token, planId, range.startDate, range.endDate, filters);
}

/**
 * Mapa de infraestrutura: modo (planta, calor de OS, calor de ativos, resumo),
 * filtros por grupo/segmento, metrica/periodo e os dados carregados do servidor.
 */
export function useInfrastructureView({ token, permissions, notify, planId, segments, ui }) {
  const [mode, setMode] = useState("normal");
  const [metric, setMetric] = useState("availability");
  const [period, setPeriod] = useState("30");
  const [groupId, setGroupId] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [heatmap, setHeatmap] = useState({ components: [] });
  const [summary, setSummary] = useState({});

  const heatmapByObject = useMemo(() => new Map((heatmap.components || []).map((item) => [item.componentId, item])), [heatmap.components]);
  const filters = useMemo(() => buildInfrastructureFilters(groupId, segmentId), [groupId, segmentId]);

  useEffect(() => {
    if (!planId || !permissions.viewHeatmaps || mode === "normal") return undefined;
    let active = true;
    requestInfrastructureData({ token, planId, mode, metric, period, filters })
      .then((payload) => {
        if (!active) return;
        if (payload.summary) setSummary(payload.summary);
        if (payload.heatmap) setHeatmap(payload.heatmap);
      })
      .catch((requestError) => notify?.(requestError.message, "danger"));
    return () => {
      active = false;
    };
  }, [planId, metric, period, filters, mode, notify, permissions.viewHeatmaps, token]);

  const changeMode = (nextMode) => {
    setMode(nextMode);
    if (nextMode !== "normal") ui.setMode("2d");
  };

  const changeGroup = (nextGroupId) => {
    setGroupId(nextGroupId);
    if (segmentId && !segments.some((segment) => segment.id === segmentId && isSegmentCompatibleWithGroup(segment, nextGroupId))) {
      setSegmentId("");
    }
  };

  return {
    mode,
    metric,
    period,
    groupId,
    segmentId,
    summary,
    heatmapByObject,
    changeMode,
    changeGroup,
    setMetric,
    setPeriod,
    setSegmentId
  };
}
