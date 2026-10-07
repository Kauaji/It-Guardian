import { useEffect, useMemo, useState } from "react";
import { automationDraftsEqual, buildAutomationPlanDraft, validateAutomationPlanDraft } from "../automationFormUtils.js";
import useUnsavedChanges from "../useUnsavedChanges.js";
import useAutomationPlanHistory from "./useAutomationPlanHistory.js";

// Estado e acoes do modal de detalhes do plano: abas, edicao do rascunho,
// confirmacoes de pausa/exclusao e protecao contra perda de alteracoes.
export default function useAutomationPlanDetails({
  plan,
  scripts,
  open,
  saving,
  onClose,
  onSave,
  onPausePlan,
  onReactivatePlan,
  onLoadHistory
}) {
  const [activeTab, setActiveTab] = useState("summary");
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [draft, setDraft] = useState(() => buildAutomationPlanDraft(plan));
  const [baseline, setBaseline] = useState(() => buildAutomationPlanDraft(plan));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const { history, historyLoading } = useAutomationPlanHistory({ open, activeTab, planId: plan?.id, onLoadHistory });
  const linkedScripts = useMemo(
    () => scripts.filter((script) => draft.defaultScriptIds.includes(script.id)),
    [draft.defaultScriptIds, scripts]
  );
  const isDirty = editing && !automationDraftsEqual(draft, baseline);
  const unsavedChanges = useUnsavedChanges(isDirty);
  const busy = saving || submitting;

  useEffect(() => {
    const nextDraft = buildAutomationPlanDraft(plan);
    setDraft(nextDraft);
    setBaseline(nextDraft);
    setEditing(false);
    setConfirmingDelete(false);
    setConfirmingStatus(false);
    setDeleteConfirmation("");
    setErrors({});
    setActiveTab("summary");
  }, [plan?.id]);

  function requestClose() {
    unsavedChanges.requestAction(onClose);
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function toggleScript(scriptId) {
    setDraft((current) => ({
      ...current,
      defaultScriptIds: current.defaultScriptIds.includes(scriptId)
        ? current.defaultScriptIds.filter((id) => id !== scriptId)
        : [...current.defaultScriptIds, scriptId]
    }));
    setErrors((current) => ({ ...current, defaultScriptIds: undefined }));
  }

  function cancelEditing() {
    unsavedChanges.requestAction(() => {
      setDraft(baseline);
      setErrors({});
      setEditing(false);
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const nextErrors = validateAutomationPlanDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const savedPlan = await onSave(plan.id, draft);
      const nextBaseline = buildAutomationPlanDraft(savedPlan || draft);
      setDraft(nextBaseline);
      setBaseline(nextBaseline);
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus() {
    if (busy) return;
    const action = plan.active === false ? onReactivatePlan : onPausePlan;
    if (!action) return;
    setSubmitting(true);
    try {
      const savedPlan = await action(plan.id);
      const nextBaseline = buildAutomationPlanDraft(savedPlan || { ...plan, active: plan.active === false });
      setDraft(nextBaseline);
      setBaseline(nextBaseline);
      setConfirmingStatus(false);
    } finally {
      setSubmitting(false);
    }
  }

  return {
    unsavedChanges,
    requestClose,
    busy,
    activeTab,
    setActiveTab,
    history,
    historyLoading,
    linkedScripts,
    editing,
    startEditing: () => setEditing(true),
    cancelEditing,
    draft,
    errors,
    updateDraft,
    toggleScript,
    submit,
    confirmingStatus,
    setConfirmingStatus,
    changeStatus,
    confirmingDelete,
    setConfirmingDelete,
    deleteConfirmation,
    setDeleteConfirmation
  };
}
