import { Palette, RotateCcw } from "lucide-react";
import { appearancePresets } from "./appearancePresets.js";

const customThemeFields = [
  { field: "background", label: "Fundo do sistema" },
  { field: "surface", label: "Áreas principais" },
  { field: "surfaceSoft", label: "Áreas secundárias" },
  { field: "text", label: "Cor das letras" },
  { field: "accent", label: "Cor principal" },
  { field: "sidebar", label: "Fundo da sidebar" },
  { field: "sidebarIcon", label: "Ícones da sidebar" },
  { field: "primaryButton", label: "Botões principais" }
];

const previewSwatches = ["background", "surface", "text", "accent", "sidebar", "primaryButton"];

function presetCardClass(active) {
  return active ? "appearance-preset-card active" : "appearance-preset-card";
}

function PresetGrid({ preferences, onSelectPreset }) {
  const { customTheme } = preferences;
  return (
    <div className="appearance-preset-grid" aria-label="Presets de aparência">
      {appearancePresets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={presetCardClass(preferences.appearancePreset === preset.id)}
          onClick={() => onSelectPreset(preset.id)}
        >
          <span className="appearance-preset-preview" style={{ background: preset.preview }} />
          <strong>{preset.name}</strong>
          <small>{preset.description}</small>
        </button>
      ))}
      <button
        type="button"
        className={presetCardClass(preferences.appearancePreset === "custom")}
        onClick={() => onSelectPreset("custom")}
      >
        <span
          className="appearance-preset-preview"
          style={{
            background: `linear-gradient(135deg, ${customTheme.sidebar}, ${customTheme.accent}, ${customTheme.background})`
          }}
        />
        <strong>Personalizado</strong>
        <small>Monte sua própria combinação.</small>
      </button>
    </div>
  );
}

function CustomThemePanel({ customTheme, onChangeCustomTheme }) {
  return (
    <div className="custom-theme-panel">
      <div>
        <strong>Cores personalizadas</strong>
        <span>Ao editar uma cor, o tema personalizado é aplicado automaticamente.</span>
      </div>
      <div className="custom-theme-grid">
        {customThemeFields.map(({ field, label }) => (
          <label key={field}>
            {label}
            <input
              type="color"
              value={customTheme[field]}
              onChange={(event) => onChangeCustomTheme(field, event.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="theme-preview-card">
        <span>Prévia rápida</span>
        <div>
          {previewSwatches.map((field) => (
            <span key={field} style={{ background: customTheme[field] }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AppearanceSection({
  preferences,
  theme,
  onToggleTheme,
  onRestoreDefault,
  onSelectPreset,
  onChangeCustomTheme
}) {
  return (
    <div className="general-settings-section">
      <Palette size={22} />
      <h3>Aparência</h3>
      <p>Presets e cores globais do sistema. As cores próprias de abas, grupos e segmentos continuam independentes.</p>
      <div className="appearance-top-actions">
        <button type="button" className="secondary-action compact-action" onClick={onToggleTheme}>
          Alternar para modo {theme === "dark" ? "claro" : "noturno"}
        </button>
        <button type="button" className="ghost-action compact-action" onClick={onRestoreDefault}>
          <RotateCcw size={15} />
          Restaurar padrão visual
        </button>
      </div>
      <PresetGrid preferences={preferences} onSelectPreset={onSelectPreset} />
      <CustomThemePanel customTheme={preferences.customTheme} onChangeCustomTheme={onChangeCustomTheme} />
    </div>
  );
}
