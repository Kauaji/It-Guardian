import SettingsFormModal from "./records/SettingsFormModal.jsx";
import SettingsTable from "./records/SettingsTable.jsx";
import SettingsToolbar from "./records/SettingsToolbar.jsx";
import { sections } from "./records/settingsConfigs.js";
import { useSettingsRecords } from "./records/useSettingsRecords.js";

function SettingsHero({ businessMode }) {
  return (
    <header className="settings-hero">
      <div>
        <span className="section-eyebrow">Fase 2</span>
        <h2>Configurações</h2>
        <p>
          {businessMode
            ? "Modo Business ativo: clientes, técnicos, produtos e regras ajudam a deixar a OS mais completa."
            : "Modo Local ativo: setores e serviços organizam atendimentos internos sem exigir cliente."}
        </p>
      </div>
    </header>
  );
}

function SettingsTabs({ sectionId, onSelect }) {
  return (
    <div className="settings-tabs">
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <button key={section.id} type="button" className={sectionId === section.id ? "active" : ""} onClick={() => onSelect(section.id)}>
            <Icon size={17} />
            {section.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsView({ token, notify, systemMode = "local", forcedSection = "", hideHero = false, hideTabs = false }) {
  const state = useSettingsRecords({ token, notify, systemMode, forcedSection });

  return (
    <section className="settings-view">
      {!hideHero && <SettingsHero businessMode={state.businessMode} />}
      {!hideTabs && <SettingsTabs sectionId={state.sectionId} onSelect={state.selectSection} />}

      <section className="settings-panel">
        <SettingsToolbar
          config={state.config}
          search={state.search}
          onSearch={state.setSearch}
          fileInputRef={state.fileInputRef}
          onImportFile={state.importFile}
          onCreate={state.openCreate}
        />
        <SettingsTable
          columns={state.visibleColumns}
          records={state.filteredRecords}
          onEdit={state.openEdit}
          onRemove={state.removeRecord}
        />
      </section>

      {state.formOpen && (
        <SettingsFormModal
          sectionId={state.sectionId}
          record={state.editingRecord}
          records={state.records}
          businessMode={state.businessMode}
          clients={state.clientOptions}
          saving={state.saving}
          onClose={() => state.setFormOpen(false)}
          onSubmit={state.saveRecord}
        />
      )}
    </section>
  );
}
