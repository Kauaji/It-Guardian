import { useEffect, useMemo, useRef, useState } from "react";
import {
  automationDraftsEqual,
  buildAutomationOverrideDraft,
  validateAutomationOverrideDraft
} from "../automationFormUtils.js";
import useUnsavedChanges from "../useUnsavedChanges.js";
import { deriveMachineDetailView } from "./machineDetailsUtils.js";

const emptyOverrideDraft = buildAutomationOverrideDraft();

// Estado, carregamento do detalhe da agenda e acoes de recorrencia
// personalizada do modal de detalhes da maquina.
export default function useAutomationMachineDetails({
  machine,
  open,
  saving,
  onClose,
  onSaveOverride,
  onRemoveOverride,
  onLoadDetails
}) {
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [editingOverride, setEditingOverride] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [overrideDraft, setOverrideDraft] = useState(emptyOverrideDraft);
  const [overrideBaseline, setOverrideBaseline] = useState(emptyOverrideDraft);
  const [overrideErrors, setOverrideErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const onLoadDetailsRef = useRef(onLoadDetails);

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
  const isOverrideDirty = editingOverride && !automationDraftsEqual(overrideDraft, overrideBaseline);
  const unsavedChanges = useUnsavedChanges(isOverrideDirty);

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

    onLoadDetailsRef.current(selectedPlan.id, machine.assetId)
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

  function requestClose() {
    unsavedChanges.requestAction(onClose);
  }

  const busy = saving || submitting;
  const view = selectedPlan ? deriveMachineDetailView(selectedPlan, detail) : null;

  function updateOverride(field, value) {
    setOverrideDraft((current) => ({ ...current, [field]: value }));
    setOverrideErrors((current) => ({ ...current, [field]: undefined }));
  }

  // Grava ou remove a recorrencia e, se o servidor devolver o detalhe, atualiza o painel.
  async function persistOverride(action) {
    setSubmitting(true);
    try {
      const response = await action();
      if (response) {
        const nextDraft = buildAutomationOverrideDraft({
          override: response.override,
          schedule: response.schedule,
          plan: response.plan || selectedPlan
        });
        setDetail(response);
        setOverrideDraft(nextDraft);
        setOverrideBaseline(nextDraft);
      }
      setEditingOverride(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOverride(event) {
    event.preventDefault();
    if (busy) return;
    const errors = validateAutomationOverrideDraft(overrideDraft);
    setOverrideErrors(errors);
    if (Object.keys(errors).length) return;
    await persistOverride(() => onSaveOverride(selectedPlan.id, machine.assetId, overrideDraft));
  }

  async function removeOverride() {
    if (busy) return;
    await persistOverride(() => onRemoveOverride(selectedPlan.id, machine.assetId));
  }

  function switchPlan(planId) {
    unsavedChanges.requestAction(() => {
      setSelectedPlanId(planId);
      setDetail(null);
      setEditingOverride(false);
    });
  }

  function cancelOverrideEditing() {
    unsavedChanges.requestAction(() => {
      setOverrideDraft(overrideBaseline);
      setOverrideErrors({});
      setEditingOverride(false);
    });
  }

  return {
    unsavedChanges,
    requestClose,
    busy,
    selectedPlan,
    switchPlan,
    detail,
    detailLoading,
    detailError,
    view,
    editingOverride,
    startEditingOverride: () => setEditingOverride(true),
    cancelOverrideEditing,
    confirmingRemoval,
    setConfirmingRemoval,
    overrideDraft,
    overrideErrors,
    updateOverride,
    submitOverride,
    removeOverride
  };
}
