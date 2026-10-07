import { AlertTriangle, Bell, CheckCircle, ClipboardList, Monitor, RefreshCw } from "lucide-react";
import SummaryCard from "../ui/SummaryCard.jsx";

// Indicadores do topo da aba Sugestoes de OS.
export function SuggestionsSummary({ summary }) {
  return (
    <div className="alerts-view-header">
      <section className="summary-grid compact-summary alerts-summary">
        <SummaryCard icon={Bell} label="Avisos ativos" value={summary.activeMachines} tone="warning" />
        <SummaryCard icon={AlertTriangle} label="Críticos" value={summary.criticalAlerts} tone="danger" />
        <SummaryCard icon={ClipboardList} label="Sugestões pendentes" value={summary.pendingSuggestions} tone="warning" />
        <SummaryCard icon={CheckCircle} label="OS criadas por aviso" value={summary.acceptedSuggestions} tone="ok" />
        <SummaryCard icon={RefreshCw} label="Avisos recorrentes" value={summary.recurringAlerts} tone="info" />
        <SummaryCard icon={Monitor} label="Máquinas em risco" value={summary.machinesAtRisk} tone="danger" />
      </section>
    </div>
  );
}

// Indicadores do topo da aba Preventivas.
export function PreventiveSummary({ summary, plans, automationPlans }) {
  const planCount = plans.length;
  const automatedPlanCount = automationPlans.filter((plan) => plan.active !== false).length;

  return (
    <div className="alerts-view-header preventive-summary-header">
      <section className="summary-grid compact-summary alerts-summary preventive-summary-grid" aria-label="Resumo preventivo">
        <SummaryCard icon={ClipboardList} label="Sem preventiva" value={summary.withoutPreventive} tone="info" />
        <SummaryCard icon={AlertTriangle} label="Preventivas vencidas" value={summary.overdue} tone="danger" />
        <SummaryCard icon={CheckCircle} label="Preventivas em dia" value={summary.upToDate} tone="ok" />
        <SummaryCard icon={Bell} label="Com avisos ativos" value={summary.withAlerts} tone="warning" />
        <SummaryCard icon={ClipboardList} label="Planos registrados" value={planCount} tone="info" />
        <SummaryCard icon={RefreshCw} label="Planos automatizados" value={automatedPlanCount} tone="info" />
      </section>
    </div>
  );
}
