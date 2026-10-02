import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import AutomationMachineList from "./AutomationMachineList.jsx";
import AutomationManagementTabs from "./AutomationManagementTabs.jsx";
import AutomationPlansView from "./AutomationPlansView.jsx";
import AutomationAgendaView from "./AutomationAgendaView.jsx";
import AutomationManagementDialogs from "./management/AutomationManagementDialogs.jsx";
import AutomationMachinesToolbar from "./management/AutomationMachinesToolbar.jsx";
import useAutomationManagementSelection from "./management/useAutomationManagementSelection.js";
import { buildAutomationManagementGroups } from "./automationUtils.js";

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
  const selection = useAutomationManagementSelection(management);

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
  const ready = !loading && !error;

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

      {activeView === "machines" && (
        <AutomationMachinesToolbar
          search={machineSearch}
          status={machineStatusFilter}
          onSearch={setMachineSearch}
          onStatus={setMachineStatusFilter}
        />
      )}

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
      {ready && activeView === "machines" && groups.length > 0 && (
        <AutomationMachineList groups={groups} onSelectPlan={selection.openPlan} onOpenMachine={selection.setSelectedMachine} />
      )}
      {ready && activeView === "machines" && !groups.length && (
        <p className="empty">Nenhuma máquina com automatização encontrada para os filtros atuais.</p>
      )}
      {ready && activeView === "plans" && (
        <AutomationPlansView
          plans={management?.plans || []}
          search={planSearch}
          status={planStatusFilter}
          onSearch={setPlanSearch}
          onStatus={setPlanStatusFilter}
          onOpenPlan={selection.setSelectedPlan}
        />
      )}
      {ready && activeView === "agenda" && (
        <AutomationAgendaView
          plans={management?.plans || []}
          onLoad={onFetchAgenda}
          onOpenPlan={selection.setSelectedPlan}
          status={agendaStatusFilter}
          onStatus={setAgendaStatusFilter}
        />
      )}

      <AutomationManagementDialogs
        selection={selection}
        scripts={scripts}
        permissions={permissions}
        actions={{
          onSavePlan,
          onPausePlan,
          onReactivatePlan,
          onDeletePlan,
          onSaveOverride,
          onRemoveOverride,
          onRemoveAsset,
          onFetchAssetDetails,
          onFetchPlanHistory
        }}
      />
    </section>
  );
}
