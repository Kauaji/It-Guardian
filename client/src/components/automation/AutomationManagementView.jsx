import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import AutomationMachineList from "./AutomationMachineList.jsx";
import AutomationMachineDetails from "./AutomationMachineDetails.jsx";
import AutomationPlanDetails from "./AutomationPlanDetails.jsx";
import AutomationManagementTabs from "./AutomationManagementTabs.jsx";
import AutomationPlansView from "./AutomationPlansView.jsx";
import AutomationAgendaView from "./AutomationAgendaView.jsx";
import { buildAutomationManagementGroups } from "./automationUtils.js";

const machineStatusOptions = [
  ["all", "Todos"],
  ["active", "Ativos"],
  ["inactive", "Inativos"],
  ["error", "Com erro"],
  ["without_schedule", "Sem próxima agenda"]
];

export default function AutomationManagementView({
  management,
  devices = [],
  segments = [],
  segmentGroups = [],
  inventoryTabs = [],
  scripts = [],
  loading,
  error,
  permissions,
  onRetry,
  onSavePlan,
  onPausePlan,
  onReactivatePlan,
  onDeletePlan,
  onSaveOverride,
  onRemoveOverride,
  onRemoveAsset,
  onFetchAssetDetails,
  onFetchAgenda,
  onFetchPlanHistory
}) {
  const [activeView, setActiveView] = useState("machines");
  const [machineSearch, setMachineSearch] = useState("");
  const [machineStatusFilter, setMachineStatusFilter] = useState("active");
  const [planSearch, setPlanSearch] = useState("");
  const [planStatusFilter, setPlanStatusFilter] = useState("all");
  const [agendaStatusFilter, setAgendaStatusFilter] = useState("all");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedPlan) return;
    const refreshed = management?.plans?.find((plan) => String(plan.id) === String(selectedPlan.id));
    if (refreshed) setSelectedPlan(refreshed);
  }, [management, selectedPlan?.id]);

  useEffect(() => {
    if (!selectedMachine) return;
    const refreshed = management?.machines?.find((machine) => String(machine.assetId) === String(selectedMachine.assetId));
    if (refreshed) setSelectedMachine(refreshed);
    else setSelectedMachine(null);
  }, [management, selectedMachine?.assetId]);

  const groups = useMemo(() => {
    return buildAutomationManagementGroups({
      machines: management?.machines || [],
      devices,
      segments,
      groups: segmentGroups,
      tabs: inventoryTabs,
      search: machineSearch,
      status: machineStatusFilter
    });
  }, [devices, inventoryTabs, machineSearch, machineStatusFilter, management, segmentGroups, segments]);

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

  return (
    <section className="panel automation-management-view">
      <div className="panel-heading">
        <div>
          <h2>Automatizações</h2>
          <p>Máquinas com planos de automatização</p>
        </div>
        <button type="button" className="icon-button" onClick={onRetry} title="Atualizar automatizações" aria-label="Atualizar automatizações">
          <RefreshCw size={18} />
        </button>
      </div>
      <AutomationManagementTabs value={activeView} onChange={setActiveView} />

      {activeView === "machines" && <div className="automation-management-toolbar machines-toolbar">
        <label className="compact-search">
          <Search size={18} />
          <input
            value={machineSearch}
            onChange={(event) => setMachineSearch(event.target.value)}
            placeholder="Buscar máquina, grupo, segmento, ambiente ou plano"
          />
        </label>
        <select value={machineStatusFilter} onChange={(event) => setMachineStatusFilter(event.target.value)} aria-label="Filtrar automatizações por status">
          {machineStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>}

      {loading && (
        <div className="automation-management-skeleton" aria-label="Carregando automatizações">
          <span /><span /><span />
        </div>
      )}
      {!loading && error && (
        <div className="automation-management-error">
          <p>{error}</p>
          <button type="button" className="secondary-action compact-action" onClick={onRetry}>Tentar novamente</button>
        </div>
      )}
      {!loading && !error && activeView === "machines" && groups.length > 0 && (
        <AutomationMachineList groups={groups} onSelectPlan={openPlan} onOpenMachine={setSelectedMachine} />
      )}
      {!loading && !error && activeView === "machines" && !groups.length && (
        <p className="empty">Nenhuma máquina com automatização encontrada para os filtros atuais.</p>
      )}
      {!loading && !error && activeView === "plans" && (
        <AutomationPlansView
          plans={management?.plans || []}
          search={planSearch}
          status={planStatusFilter}
          onSearch={setPlanSearch}
          onStatus={setPlanStatusFilter}
          onOpenPlan={setSelectedPlan}
        />
      )}
      {!loading && !error && activeView === "agenda" && (
        <AutomationAgendaView
          plans={management?.plans || []}
          onLoad={onFetchAgenda}
          onOpenPlan={setSelectedPlan}
          status={agendaStatusFilter}
          onStatus={setAgendaStatusFilter}
        />
      )}

      <AutomationPlanDetails
        plan={selectedPlan}
        scripts={scripts}
        open={Boolean(selectedPlan)}
        canEdit={permissions.update}
        canDisable={permissions.disable}
        canDelete={permissions.delete}
        saving={saving}
        onClose={() => setSelectedPlan(null)}
        onSave={(planId, payload) => run(() => onSavePlan(planId, payload))}
        onPausePlan={onPausePlan ? (planId) => run(() => onPausePlan(planId)) : undefined}
        onReactivatePlan={onReactivatePlan ? (planId) => run(() => onReactivatePlan(planId)) : undefined}
        onDelete={(plan) => run(async () => {
          await onDeletePlan(plan.id);
          setSelectedPlan(null);
        })}
        onLoadHistory={onFetchPlanHistory}
      />
      <AutomationMachineDetails
        machine={selectedMachine}
        open={Boolean(selectedMachine)}
        canManageOverride={permissions.manageOverride}
        canRemoveAsset={permissions.removeAsset}
        canDeletePlan={permissions.delete}
        saving={saving}
        onClose={() => setSelectedMachine(null)}
        onOpenPlan={openPlan}
        onSaveOverride={(planId, assetId, payload) => run(() => onSaveOverride(planId, assetId, payload))}
        onRemoveOverride={(planId, assetId) => run(() => onRemoveOverride(planId, assetId))}
        onRemoveAsset={(planId, assetId) => run(async () => {
          await onRemoveAsset(planId, assetId);
          setSelectedMachine(null);
        })}
        onDeletePlan={(plan) => run(async () => {
          await onDeletePlan(plan.id);
          setSelectedMachine(null);
        })}
        onLoadDetails={onFetchAssetDetails}
      />
    </section>
  );
}
