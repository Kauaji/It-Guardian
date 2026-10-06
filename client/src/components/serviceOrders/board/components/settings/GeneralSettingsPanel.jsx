import { maxServiceOrderStatuses } from "../../../serviceOrderBoardUtils.js";
import SettingsAccordionSection from "../../../../settings/SettingsAccordionSection.jsx";
import AutoPriorityFields from "./AutoPriorityFields.jsx";
import NumberFormatFields from "./NumberFormatFields.jsx";
import SlaFields from "./SlaFields.jsx";
import StatusSettings from "./StatusSettings.jsx";

function LayoutField({ settings, updateSetting }) {
  return (
    <div className="service-order-number-settings service-order-general-settings">
      <label>
        Modo de exibição
        <select
          value={settings.boardLayout}
          onChange={(event) => updateSetting("boardLayout", event.target.value)}
        >
          <option value="horizontal">Lista horizontal</option>
          <option value="vertical">Lista vertical</option>
        </select>
      </label>
    </div>
  );
}

// Aba Geral: secoes recolhiveis com layout, numero, prioridade, SLA e status.
export default function GeneralSettingsPanel({ editor, activeSection, onToggleSection, showPriorityColorConfig, onToggleColors }) {
  const { serviceOrderSettings: settings } = editor;
  return (
    <section className="service-order-settings-panel">
      <header>
        <div>
          <strong>Geral</strong>
          <span>Regras principais da Ordem de Serviço.</span>
        </div>
        <button type="button" className="primary-action compact-action" onClick={editor.saveServiceOrderSettings} disabled={editor.settingsSaving}>
          {editor.settingsSaving ? "Salvando..." : "Salvar"}
        </button>
      </header>
      <div className="service-order-settings-accordion-list">
        <SettingsAccordionSection
          id="layout"
          title="Visualização do painel"
          description="Define como as ordens são exibidas no painel."
          activeSection={activeSection}
          onToggle={onToggleSection}
        >
          <LayoutField settings={settings} updateSetting={editor.updateServiceOrderSetting} />
        </SettingsAccordionSection>

        <SettingsAccordionSection
          id="number"
          title="Formato do número da OS"
          description="Define a numeração das próximas ordens."
          activeSection={activeSection}
          onToggle={onToggleSection}
        >
          <NumberFormatFields settings={settings} updateField={editor.updateServiceOrderSettingsField} />
        </SettingsAccordionSection>

        <SettingsAccordionSection
          id="priority"
          title="Prioridade automática"
          description="Controla escalonamento por tempo e cores das urgências."
          activeSection={activeSection}
          onToggle={onToggleSection}
        >
          <AutoPriorityFields editor={editor} showPriorityColorConfig={showPriorityColorConfig} onToggleColors={onToggleColors} />
        </SettingsAccordionSection>

        <SettingsAccordionSection
          id="sla"
          title="SLA (prazo de atendimento)"
          description="Define o prazo por prioridade e quando exigir checklist para finalizar."
          activeSection={activeSection}
          onToggle={onToggleSection}
        >
          <SlaFields settings={settings} updateField={editor.updateServiceOrderSettingsField} updateSetting={editor.updateServiceOrderSetting} />
        </SettingsAccordionSection>

        <SettingsAccordionSection
          id="statuses"
          title="Segmentos/Status da OS"
          description={`Configure até ${maxServiceOrderStatuses} status para o painel.`}
          activeSection={activeSection}
          onToggle={onToggleSection}
        >
          <StatusSettings editor={editor} />
        </SettingsAccordionSection>
      </div>
    </section>
  );
}
