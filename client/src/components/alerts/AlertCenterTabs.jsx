import { Plus, Settings as SettingsIcon } from "lucide-react";
import { useAlertCenterView } from "./AlertCenterViewContext.jsx";

function TabButton({ id, activeTab, onChange, children }) {
  return (
    <button type="button" className={activeTab === id ? "active" : ""} onClick={() => onChange(id)}>
      {children}
    </button>
  );
}

// Barra de abas internas da Central de Avisos, com os atalhos de log e configuracoes.
export default function AlertCenterTabs({ activeTab, canShowAutomationManagement, onChange, onOpenLog, onOpenSettings }) {
  const { perms } = useAlertCenterView();

  return (
    <nav className="alerts-internal-tabs" aria-label="Áreas da Central de Avisos">
      {perms.canViewAlerts && (
        <TabButton id="suggestions" activeTab={activeTab} onChange={onChange}>
          Sugestões de OS
        </TabButton>
      )}
      {perms.canUsePreventiveArea && (
        <TabButton id="preventives" activeTab={activeTab} onChange={onChange}>
          Preventivas
        </TabButton>
      )}
      {canShowAutomationManagement && (
        <TabButton id="automation" activeTab={activeTab} onChange={onChange}>
          Automatizações
        </TabButton>
      )}
      {perms.canViewScriptLogs && (
        <button
          type="button"
          className="icon-button alerts-log-tab-button"
          onClick={onOpenLog}
          title="Abrir tela de log"
          aria-label="Abrir tela de log"
        >
          <Plus size={18} />
        </button>
      )}
      {perms.canOpenSettings && (
        <button
          type="button"
          className="icon-button alerts-settings-trigger alerts-settings-tab-button"
          onClick={onOpenSettings}
          title="Configurações de aviso"
          aria-label="Configurações de aviso"
        >
          <SettingsIcon size={18} />
        </button>
      )}
    </nav>
  );
}
