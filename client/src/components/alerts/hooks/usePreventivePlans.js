import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildAutomatedPreventivePlanPayload,
  buildAutomationCreateRequest,
  buildDevicePreventiveInfo,
  buildManualPreventivePlanPayload,
  filterPreventiveOverview,
  groupPreventiveOverview,
  mergeAutomationIndicators,
  orderPreventiveScripts,
  summarizePreventiveOverview
} from "../preventiveUtils.js";
import { isHighRiskScript } from "../alertDisplayUtils.js";
import usePreventiveScriptRecommendations from "./usePreventiveScriptRecommendations.js";
import usePreventiveSelection from "./usePreventiveSelection.js";

// Estado da aba Preventivas: visao das maquinas (resumo, filtros, grupos),
// selecao, scripts recomendados e o fluxo de registro/automacao do plano.
// `data` = { token, devices, alerts, lookups, preventivePlans, automationMachines, activeScripts, dueDays }
// `handlers` = { onCreatePreventivePlan, onCreatePreventivePlanServiceOrder }
export default function usePreventivePlans({ data, activeTab, canCreatePlans, handlers }) {
  const { token, devices, alerts, lookups, preventivePlans, automationMachines, activeScripts, dueDays } = data;
  const { onCreatePreventivePlan, onCreatePreventivePlanServiceOrder } = handlers;
  const selection = usePreventiveSelection();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [planName, setPlanName] = useState("Plano preventivo");
  const [saving, setSaving] = useState(false);
  const [serviceOrderSavingId, setServiceOrderSavingId] = useState(null);
  const [automationCreateRequest, setAutomationCreateRequest] = useState(null);
  const [lastCreatedPlan, setLastCreatedPlan] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const devicesWithAutomation = useMemo(() => mergeAutomationIndicators(devices, automationMachines), [devices, automationMachines]);
  const overview = useMemo(
    () => devicesWithAutomation.map((device) => buildDevicePreventiveInfo(device, { lookups, alerts, preventivePlans, dueDays })),
    [devicesWithAutomation, lookups, alerts, preventivePlans, dueDays]
  );
  const summary = useMemo(() => summarizePreventiveOverview(overview), [overview]);
  const groups = useMemo(() => groupPreventiveOverview(filterPreventiveOverview(overview, { search, filter })), [overview, search, filter]);
  const assetIds = useMemo(() => Array.from(selection.assets).map(String).sort(), [selection.assets]);
  const [recommendations, resetRecommendations] = usePreventiveScriptRecommendations({ token, assetIds, activeScripts });
  const orderedScripts = orderPreventiveScripts(recommendations, activeScripts);
  const selectedDevices = devicesWithAutomation.filter((device) => selection.assets.has(device.id));
  const selectedScripts = activeScripts.filter((script) => selection.scripts.has(script.id));
  const riskScripts = selectedScripts.filter(isHighRiskScript);

  useEffect(() => {
    if (activeTab !== "preventives" && automationCreateRequest) {
      setAutomationCreateRequest(null);
    }
  }, [activeTab, automationCreateRequest]);

  const clearAutomationCreateRequest = useCallback(() => setAutomationCreateRequest(null), []);

  function openReview() {
    if (!canCreatePlans || saving || !selection.assets.size || !selection.scripts.size) return;
    setReviewOpen(true);
  }

  async function confirmRegistration() {
    if (!onCreatePreventivePlan || saving) return;

    setSaving(true);
    try {
      const createdPlan = await onCreatePreventivePlan(
        buildManualPreventivePlanPayload({
          name: planName,
          assetIds: [...selection.assets],
          scriptIds: [...selection.scripts],
          riskAcknowledged: riskScripts.length > 0
        })
      );
      selection.clearAll();
      setLastCreatedPlan(createdPlan);
      setReviewOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function createServiceOrder(plan) {
    if (!plan?.id || serviceOrderSavingId || !onCreatePreventivePlanServiceOrder) return;

    setServiceOrderSavingId(plan.id);
    try {
      const result = await onCreatePreventivePlanServiceOrder(plan.id);
      if (result?.preventivePlan) {
        setLastCreatedPlan(result.preventivePlan);
      }
    } finally {
      setServiceOrderSavingId(null);
    }
  }

  function openAutomationFromSelection() {
    setAutomationCreateRequest(
      buildAutomationCreateRequest({
        devices: selectedDevices,
        scripts: selectedScripts,
        riskScripts,
        planName
      })
    );
  }

  async function createAutomatedPlanFromSelection(automationPayload) {
    const createdPlan = await onCreatePreventivePlan(
      buildAutomatedPreventivePlanPayload({
        automationPayload,
        planName,
        devices: selectedDevices,
        scripts: selectedScripts
      })
    );

    selection.clearSelection();
    resetRecommendations();
    setAutomationCreateRequest(null);
    return createdPlan;
  }

  return {
    selection,
    search,
    setSearch,
    filter,
    setFilter,
    summary,
    groups,
    planName,
    setPlanName,
    recommendations,
    orderedScripts,
    selectedDevices,
    selectedScripts,
    riskScripts,
    saving,
    serviceOrderSavingId,
    lastCreatedPlan,
    reviewOpen,
    closeReview: () => setReviewOpen(false),
    automationCreateRequest,
    clearAutomationCreateRequest,
    openReview,
    confirmRegistration,
    createServiceOrder,
    openAutomationFromSelection,
    createAutomatedPlanFromSelection
  };
}
