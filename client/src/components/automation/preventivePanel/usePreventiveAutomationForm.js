import { useEffect, useRef, useState } from "react";
import { useModalLifecycle } from "../../../hooks/useModalLifecycle.js";
import {
  applyAutomationFormField,
  buildAutomationFormFromDefaults,
  buildAutomationFormFromPlan,
  buildAutomationPayload,
  buildEmptyAutomationForm,
  buildEmptyOverrideDraft,
  buildOverrideFromDraft,
  findDuplicateAutomationIdentity,
  isInvalidCustomInterval,
  resolveFormRecurrenceInterval,
  toggleListItem
} from "./preventiveAutomationPanelUtils.js";

// Estado e acoes do modal de criacao/edicao de automacao preventiva, incluindo
// o assistente (etapa 3) aberto pela aba Preventivas.
export default function usePreventiveAutomationForm({
  plans,
  onSave,
  onCreateAutomatedPreventivePlan,
  createRequest,
  onCreateRequestHandled
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(buildEmptyAutomationForm);
  const [wizardMode, setWizardMode] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [wizardContext, setWizardContext] = useState(null);
  const [overrideDraft, setOverrideDraft] = useState(buildEmptyOverrideDraft);
  const [saving, setSaving] = useState(false);
  const [overridesOpen, setOverridesOpen] = useState(false);
  const lastCreateRequestId = useRef(null);
  const identity = findDuplicateAutomationIdentity(plans, form);
  const closeModal = () => setModalOpen(false);
  const dialogRef = useModalLifecycle(modalOpen, closeModal);

  useEffect(() => {
    if (!createRequest?.id || lastCreateRequestId.current === createRequest.id) return;
    lastCreateRequestId.current = createRequest.id;
    openCreateModal(createRequest.defaults || {}, { wizard: true });
    onCreateRequestHandled?.(createRequest.id);
  }, [createRequest, onCreateRequestHandled]);

  function openCreateModal(defaults = {}, options = {}) {
    const { context = null, ...formDefaults } = defaults;
    const nextWizardMode = options.wizard || defaults.wizardMode === true;
    setWizardMode(nextWizardMode);
    setReviewMode(false);
    setWizardContext(context);
    setForm((current) => buildAutomationFormFromDefaults(current, formDefaults, nextWizardMode && wizardMode));
    setOverridesOpen(false);
    setOverrideDraft(buildEmptyOverrideDraft());
    setModalOpen(true);
  }

  function openEditModal(plan) {
    setWizardMode(false);
    setReviewMode(false);
    setWizardContext(null);
    setForm(buildAutomationFormFromPlan(plan));
    setOverridesOpen(false);
    setModalOpen(true);
  }

  function updateForm(field, value) {
    setForm((current) => applyAutomationFormField(current, field, value));
  }

  function toggleScript(scriptId) {
    setForm((current) => ({ ...current, defaultScriptIds: toggleListItem(current.defaultScriptIds || [], scriptId) }));
  }

  function addOverride() {
    const override = buildOverrideFromDraft(overrideDraft, form.overrides || []);
    if (!override) return;
    setForm((current) => ({ ...current, overrides: [...(current.overrides || []), override] }));
    setOverrideDraft((current) => ({ ...current, targetId: "" }));
  }

  function removeOverride(index) {
    setForm((current) => ({
      ...current,
      overrides: (current.overrides || []).filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  async function submitForm(event) {
    event.preventDefault();
    if ((!onSave && !onCreateAutomatedPreventivePlan) || saving || identity.hasDuplicateAutomationIdentity) return;
    if (isInvalidCustomInterval(form.recurrenceType, resolveFormRecurrenceInterval(form))) return;
    if (wizardMode && !reviewMode) {
      setReviewMode(true);
      return;
    }
    setSaving(true);
    try {
      const automationPayload = buildAutomationPayload(form);
      if (wizardMode && !form.id && onCreateAutomatedPreventivePlan) {
        await onCreateAutomatedPreventivePlan(automationPayload, wizardContext);
      } else {
        await onSave(form.id, automationPayload);
      }
      setModalOpen(false);
      setReviewMode(false);
    } finally {
      setSaving(false);
    }
  }

  return {
    modalOpen,
    closeModal,
    dialogRef,
    form,
    wizardMode,
    reviewMode,
    setReviewMode,
    wizardContext,
    overrideDraft,
    setOverrideDraft,
    overridesOpen,
    toggleOverridesOpen: () => setOverridesOpen((current) => !current),
    saving,
    identity,
    openCreateModal,
    openEditModal,
    updateForm,
    toggleScript,
    addOverride,
    removeOverride,
    submitForm
  };
}
