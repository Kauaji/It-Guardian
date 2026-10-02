import { useState } from "react";
import { buildReactivationPayload } from "./preventiveAutomationPanelUtils.js";

// Interruptor de ativo/inativo da lista de planos: desativa pelo endpoint
// proprio e reativa regravando o plano com `active: true`.
export default function usePreventiveAutomationToggle({ onSave, onDisable }) {
  const [togglingId, setTogglingId] = useState(null);

  async function toggleAutomationPlan(plan) {
    if (togglingId) return;
    setTogglingId(plan.id);
    try {
      if (plan.active !== false && onDisable) {
        await onDisable(plan.id);
        return;
      }
      if (!onSave) return;
      await onSave(plan.id, buildReactivationPayload(plan));
    } finally {
      setTogglingId(null);
    }
  }

  return { togglingId, toggleAutomationPlan };
}
