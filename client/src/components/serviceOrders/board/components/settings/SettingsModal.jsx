import { X } from "lucide-react";
import SettingsView from "../../../../settings/SettingsView.jsx";
import ServiceOrderChecklistTemplatesSettings from "../../../ServiceOrderChecklistTemplatesSettings.jsx";
import GeneralSettingsPanel from "./GeneralSettingsPanel.jsx";

const SETTINGS_VIEW_TABS = ["clients", "technicians", "products", "services", "problemTypes"];

// Modal "Configuracao da OS": abas, painel Geral e telas de cadastros delegadas.
export default function SettingsModal({ modal, editor, token, notify, systemMode, onClose }) {
  const { settingsTab } = modal;
  return (
    <div className="modal-backdrop service-order-settings-backdrop" role="presentation">
      <section ref={modal.dialogRef} className="service-order-settings-modal" role="dialog" aria-modal="true" aria-label="Configurações da OS">
        <header className="service-order-settings-modal-header">
          <div>
            <span className="section-eyebrow">Ordens de Serviço</span>
            <h2>Configuração da OS</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="service-order-settings-tabs">
          {modal.visibleSettingsTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={settingsTab === tab.id ? "active" : ""}
              onClick={() => modal.setSettingsTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="service-order-settings-content">
          {settingsTab === "general" && (
            <GeneralSettingsPanel
              editor={editor}
              activeSection={modal.generalSettingsSection}
              onToggleSection={modal.setGeneralSettingsSection}
              showPriorityColorConfig={modal.showPriorityColorConfig}
              onToggleColors={modal.togglePriorityColorConfig}
            />
          )}

          {SETTINGS_VIEW_TABS.includes(settingsTab) && (
            <SettingsView
              token={token}
              notify={notify}
              systemMode={systemMode}
              forcedSection={settingsTab}
              hideHero
              hideTabs
            />
          )}

          {settingsTab === "checklists" && (
            <ServiceOrderChecklistTemplatesSettings token={token} notify={notify} />
          )}
        </div>
      </section>
    </div>
  );
}
