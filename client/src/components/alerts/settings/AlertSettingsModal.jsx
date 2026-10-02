import { XCircle } from "lucide-react";
import { useAlertCenterData } from "../../../context/AlertCenterContext.jsx";
import { useModalLifecycle } from "../../../hooks/useModalLifecycle.js";
import MaintenanceScriptsPanel from "../../maintenance/MaintenanceScriptsPanel.jsx";
import { useAlertCenterView } from "../AlertCenterViewContext.jsx";
import AlertPrioritySection from "./AlertPrioritySection.jsx";
import AlertRulesSection from "./AlertRulesSection.jsx";
import SettingsAccordion from "./SettingsAccordion.jsx";

function ScriptsSection({ devices, serviceOrders }) {
  const { perms } = useAlertCenterView();
  const center = useAlertCenterData();

  return (
    <div className="alert-settings-accordion-body">
      <MaintenanceScriptsPanel
        scripts={center.scripts}
        devices={devices}
        serviceOrders={serviceOrders}
        alerts={center.alerts}
        canManage={perms.canManageScripts}
        canRegisterSimulation={perms.canRegisterScriptSimulation}
        showHeader={false}
        showSafetyBanner={false}
        showSimulation={false}
        onAnalyze={center.onAnalyzeMaintenanceScript}
        onSave={center.onSaveMaintenanceScript}
        onDeactivate={center.onDeactivateMaintenanceScript}
        onRegisterSimulation={center.onRegisterMaintenanceScriptSimulation}
      />
    </div>
  );
}

// Modal "Configuracoes de aviso". `settings` vem de useAlertSettings.
export default function AlertSettingsModal({ settings, devices, serviceOrders }) {
  const { perms } = useAlertCenterView();
  const dialogRef = useModalLifecycle(true, settings.closeSettings);
  const { sectionsOpen, toggleSection } = settings;

  return (
    <div className="modal-backdrop alert-settings-backdrop" onMouseDown={settings.closeSettings}>
      <section
        ref={dialogRef}
        className="modal-panel alert-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-settings-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="alert-settings-modal-header">
          <div>
            <span>AVISOS</span>
            <h2 id="alert-settings-modal-title">Configurações de aviso</h2>
            <p>Regras de recorrência, limites e cadastro seguro de scripts de manutenção.</p>
          </div>
          <button type="button" className="icon-button" onClick={settings.closeSettings}>
            <XCircle size={18} />
          </button>
        </header>

        {perms.canViewAlerts && (
          <SettingsAccordion
            title="Regras de aviso"
            description="Limites usados para sugerir Ordens de Serviço."
            open={sectionsOpen.rules}
            onToggle={() => toggleSection("rules")}
          >
            <AlertRulesSection settings={settings} />
          </SettingsAccordion>
        )}

        {perms.canViewAlerts && (
          <SettingsAccordion
            title="Prioridade"
            description="Cores e tempos usados pelas prioridades das Ordens de Serviço."
            open={sectionsOpen.priority}
            onToggle={() => toggleSection("priority")}
          >
            <AlertPrioritySection settings={settings} />
          </SettingsAccordion>
        )}

        {perms.canViewScripts && (
          <SettingsAccordion
            title="Scripts de manutenção"
            description="Cadastro seguro, análise textual e scripts disponíveis nos cards."
            open={sectionsOpen.scripts}
            onToggle={() => toggleSection("scripts")}
          >
            <ScriptsSection devices={devices} serviceOrders={serviceOrders} />
          </SettingsAccordion>
        )}
      </section>
    </div>
  );
}
