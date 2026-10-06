import { useState } from "react";
import { buildAutomationOverrideDraft } from "../automationFormUtils.js";

export const emptyOverrideDraft = buildAutomationOverrideDraft();

/** Estado do editor de recorrência personalizada (rascunho, base de comparação, erros e modos). */
export function useOverrideDraftState() {
  const [editingOverride, setEditingOverride] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState(emptyOverrideDraft);
  const [overrideBaseline, setOverrideBaseline] = useState(emptyOverrideDraft);
  const [overrideErrors, setOverrideErrors] = useState({});

  return {
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
  };
}
