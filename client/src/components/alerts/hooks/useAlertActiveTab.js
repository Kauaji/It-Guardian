import { useEffect, useState } from "react";

// Decide para qual aba voltar quando a atual deixa de estar disponivel
// (permissao revogada ou planos de automacao removidos). Retorna null se nada muda.
export function resolveAlertTab(activeTab, { canShowAutomationManagement, canUsePreventiveArea, canViewAlerts }) {
  if (activeTab === "automation") {
    if (canShowAutomationManagement) return null;
    if (canUsePreventiveArea) return "preventives";
    if (canViewAlerts) return "suggestions";
    return null;
  }
  if (activeTab === "suggestions" && !canViewAlerts) {
    return canUsePreventiveArea ? "preventives" : null;
  }
  if (activeTab === "preventives" && !canUsePreventiveArea && canViewAlerts) {
    return "suggestions";
  }
  return null;
}

export default function useAlertActiveTab({ canShowAutomationManagement, canUsePreventiveArea, canViewAlerts }) {
  const [activeTab, setActiveTab] = useState("suggestions");

  useEffect(() => {
    const nextTab = resolveAlertTab(activeTab, { canShowAutomationManagement, canUsePreventiveArea, canViewAlerts });
    if (nextTab) setActiveTab(nextTab);
  }, [activeTab, canShowAutomationManagement, canUsePreventiveArea, canViewAlerts]);

  return [activeTab, setActiveTab];
}
