import { MoreHorizontal } from "lucide-react";
import AutomationIndicatorDots from "../AutomationIndicatorDots.jsx";
import {
  formatAutomationMachineStatusSummary,
  getAutomationMachineStatusSummary
} from "./automationStatusUtils.js";

function AutomationMachineRow({ machine, location, onSelectPlan, onOpenMachine }) {
  const statusSummary = getAutomationMachineStatusSummary(machine);

  return (
    <article className="automation-machine-row">
      <button
        type="button"
        className="automation-machine-main"
        onClick={() => onOpenMachine(machine)}
        aria-label={`Gerenciar automações de ${machine.assetName}`}
      >
        <span className="automation-machine-name-line">
          <strong>{machine.assetName}</strong>
          <AutomationIndicatorDots
            indicators={machine.plans}
            maxVisible={4}
            compact
            onSelectPlan={(plan) => onSelectPlan(plan, machine)}
          />
        </span>
        <small>
          {machine.assetType || "Ativo"}
          {machine.operatingSystem ? ` • ${machine.operatingSystem}` : ""}
          {machine.loggedUser ? ` • Usuário: ${machine.loggedUser}` : ""}
        </small>
        <span>{location.groupName} • {location.segmentName}</span>
      </button>
      <div className="automation-machine-status">
        <span className={`pill ${statusSummary.errorCount ? "danger" : statusSummary.activeCount ? "ok" : "muted"}`}>
          {formatAutomationMachineStatusSummary(machine)}
        </span>
        <small>{statusSummary.totalCount} plano(s) no total</small>
      </div>
      <button
        type="button"
        className="icon-button automation-machine-menu-trigger"
        onClick={() => onOpenMachine(machine)}
        aria-label={`Abrir ações de ${machine.assetName}`}
        title="Ações da máquina"
      >
        <MoreHorizontal size={18} />
      </button>
    </article>
  );
}

export default function AutomationMachineList({
  groups,
  onSelectPlan,
  onOpenMachine
}) {
  return (
    <div className="automation-management-groups">
      {groups.map((group) => (
        <section className="automation-management-group" key={group.key}>
          <header>
            <div>
              <small>{group.tabName}</small>
              <strong>{group.groupName} • {group.segmentName}</strong>
              <span>{group.machines.length} máquina(s) com automação neste segmento</span>
            </div>
          </header>
          <div className="automation-machine-list">
            {group.machines.map(({ machine, location }) => (
              <AutomationMachineRow
                key={machine.assetId}
                machine={machine}
                location={location}
                onSelectPlan={onSelectPlan}
                onOpenMachine={onOpenMachine}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
