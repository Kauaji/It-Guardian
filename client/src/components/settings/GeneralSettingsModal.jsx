import { X } from "lucide-react";
import { useModalLifecycle } from "../../hooks/useModalLifecycle.js";
import AdminSection from "./general/AdminSection.jsx";
import AppearanceSection from "./general/AppearanceSection.jsx";
import SystemModeSection from "./general/SystemModeSection.jsx";
import UsabilitySection from "./general/UsabilitySection.jsx";
import { useAdminSettings } from "./general/useAdminSettings.js";
import { useGeneralPreferences } from "./general/useGeneralPreferences.js";
import { useGeneralSections } from "./general/useGeneralSections.js";

export {
  applyGeneralPreferences,
  applyStoredGeneralPreferences,
  clearRuntimeAppearancePreferences
} from "./general/generalPreferences.js";

export default function GeneralSettingsModal({
  open,
  token,
  user,
  theme,
  systemMode = "local",
  onClose,
  onSystemModeChange,
  onToggleTheme,
  notify
}) {
  const isAdmin = user?.role === "admin" || user?.isAdmin;
  const { section, setSection, sections } = useGeneralSections(open, isAdmin);
  const prefs = useGeneralPreferences(theme);
  const admin = useAdminSettings({ open, section, token, isAdmin, notify });
  const dialogRef = useModalLifecycle(open, onClose);

  if (!open) return null;

  return (
    <div className="modal-backdrop general-settings-backdrop" role="presentation">
      <section ref={dialogRef} className="general-settings-modal" role="dialog" aria-modal="true" aria-label="Configurações gerais">
        <header className="general-settings-header">
          <div>
            <span className="section-eyebrow">Sistema</span>
            <h2>Configurações Gerais</h2>
            <p>Ajustes globais do IT Guardian. As configurações de OS ficam dentro de Ordens de Serviço.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="general-settings-layout">
          <aside className="general-settings-tabs">
            {sections.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={section === item.id ? "active" : ""}
                  onClick={() => setSection(item.id)}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </aside>

          <section className="general-settings-content">
            {section === "usability" && (
              <UsabilitySection preferences={prefs.preferences} onChangeFontScale={prefs.changeFontScale} />
            )}
            {section === "appearance" && (
              <AppearanceSection
                preferences={prefs.preferences}
                theme={theme}
                onToggleTheme={onToggleTheme}
                onRestoreDefault={prefs.restoreDefaultAppearance}
                onSelectPreset={prefs.selectAppearancePreset}
                onChangeCustomTheme={prefs.changeCustomTheme}
              />
            )}
            {section === "admin" && isAdmin && (
              <AdminSection admin={admin} token={token} user={user} notify={notify} />
            )}
            {section === "mode" && (
              <SystemModeSection systemMode={systemMode} onSystemModeChange={onSystemModeChange} />
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
