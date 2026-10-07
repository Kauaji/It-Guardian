import { useEffect, useState } from "react";

// Selecao de plano/maquina abertos nos modais de detalhe. Mantem os objetos
// sincronizados com a gestao recarregada e serializa as gravacoes (`run`).
export default function useAutomationManagementSelection(management) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedPlan) return;
    const refreshed = management?.plans?.find((plan) => String(plan.id) === String(selectedPlan.id));
    if (refreshed) {
      setSelectedPlan((current) => (current === refreshed ? current : refreshed));
    }
  }, [management, selectedPlan?.id]);

  useEffect(() => {
    if (!selectedMachine) return;
    const refreshed = management?.machines?.find((machine) => String(machine.assetId) === String(selectedMachine.assetId));
    setSelectedMachine((current) => {
      if (refreshed) return current === refreshed ? current : refreshed;
      return current ? null : current;
    });
  }, [management, selectedMachine?.assetId]);

  function openPlan(plan, machine) {
    const fullPlan = management?.plans?.find((item) => String(item.id) === String(plan.id || plan.automationPlanId));
    setSelectedPlan(fullPlan || plan);
    if (machine) setSelectedMachine(null);
  }

  async function run(action) {
    if (saving) return;
    setSaving(true);
    try {
      await action();
    } finally {
      setSaving(false);
    }
  }

  return { selectedPlan, setSelectedPlan, selectedMachine, setSelectedMachine, openPlan, saving, run };
}
