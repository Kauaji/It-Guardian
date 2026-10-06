import { useEffect, useMemo, useRef, useState } from "react";
import { buildAutomationOverrideDraft } from "../automationFormUtils.js";

/**
 * Plano selecionado da máquina e o detalhe da agenda dele (carregado ao abrir ou
 * trocar de plano). Ao recarregar, reinicia o editor de recorrência.
 */
export function useMachinePlanDetail({ machine, open, onLoadDetails, draftState }) {
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const onLoadDetailsRef = useRef(onLoadDetails);
  const { setEditingOverride, setConfirmingRemoval, setOverrideDraft, setOverrideBaseline, setOverrideErrors } = draftState;

  useEffect(() => {
    onLoadDetailsRef.current = onLoadDetails;
  }, [onLoadDetails]);

  useEffect(() => {
    setSelectedPlanId(machine?.plans?.[0]?.id || "");
    setEditingOverride(false);
    setConfirmingRemoval(false);
    setDetail(null);
  }, [machine?.assetId]);

  const selectedPlan = useMemo(
    () => machine?.plans?.find((plan) => String(plan.id) === String(selectedPlanId)) || machine?.plans?.[0],
    [machine, selectedPlanId]
  );

  useEffect(() => {
    if (!open || !selectedPlan || !machine) return undefined;
    let cancelled = false;
    const fallbackDraft = buildAutomationOverrideDraft({ plan: selectedPlan });

    setDetail(null);
    setDetailLoading(Boolean(onLoadDetailsRef.current));
    setDetailError("");
    setEditingOverride(false);
    setConfirmingRemoval(false);
    setOverrideErrors({});
    setOverrideDraft(fallbackDraft);
    setOverrideBaseline(fallbackDraft);

    if (!onLoadDetailsRef.current) return undefined;

    onLoadDetailsRef
      .current(selectedPlan.id, machine.assetId)
      .then((response) => {
        if (cancelled) return;
        const loadedDraft = buildAutomationOverrideDraft({
          override: response?.override,
          schedule: response?.schedule,
          plan: response?.plan || selectedPlan
        });
        setDetail(response);
        setOverrideDraft(loadedDraft);
        setOverrideBaseline(loadedDraft);
      })
      .catch((error) => {
        if (!cancelled) {
          setDetailError(error.message || "Não foi possível carregar os detalhes desta máquina.");
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [machine?.assetId, open, selectedPlan?.id]);

  return { selectedPlan, setSelectedPlanId, detail, setDetail, detailLoading, detailError };
}
