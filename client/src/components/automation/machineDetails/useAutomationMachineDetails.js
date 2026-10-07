import { useState } from "react";
import { automationDraftsEqual, buildAutomationOverrideDraft, validateAutomationOverrideDraft } from "../automationFormUtils.js";
import useUnsavedChanges from "../useUnsavedChanges.js";
import { deriveMachineDetailView } from "./machineDetailsUtils.js";
import { useMachinePlanDetail } from "./useMachinePlanDetail.js";
import { useOverrideDraftState } from "./useOverrideDraftState.js";

// Estado, carregamento do detalhe da agenda e acoes de recorrencia
// personalizada do modal de detalhes da maquina.
export default function useAutomationMachineDetails({ machine, open, saving, onClose, onSaveOverride, onRemoveOverride, onLoadDetails }) {
  const draftState = useOverrideDraftState();
  const {
    editingOverride,
    setEditingOverride,
    confirmingRemoval,
    setConfirmingRemoval,
    overrideDraft,
    setOverrideDraft,
    overrideBaseline,
    setOverrideBaseline,
    overrideErrors,
    setOverrideErrors
  } = draftState;
  const [submitting, setSubmitting] = useState(false);
  const { selectedPlan, setSelectedPlanId, detail, setDetail, detailLoading, detailError } = useMachinePlanDetail({
    machine,
    open,
    onLoadDetails,
    draftState
  });

  const isOverrideDirty = editingOverride && !automationDraftsEqual(overrideDraft, overrideBaseline);
  const unsavedChanges = useUnsavedChanges(isOverrideDirty);

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
