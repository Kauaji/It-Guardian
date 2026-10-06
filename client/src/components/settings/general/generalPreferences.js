// Leitura, cálculo e aplicação das preferências gerais (escala de fonte e tema) no <html>.
import {
  appearancePresets,
  appearanceVariableNames,
  defaultCustomTheme,
  defaultGeneralPreferences,
  fontScaleOptions,
  generalPreferencesKey
} from "./appearancePresets.js";

export function readGeneralPreferences() {
  if (typeof window === "undefined") return defaultGeneralPreferences;

  try {
    const stored = JSON.parse(localStorage.getItem(generalPreferencesKey) || "{}");
    return {
      ...defaultGeneralPreferences,
      ...stored,
      customTheme: {
        ...defaultCustomTheme,
        ...(stored.customTheme || {})
      }
    };
  } catch {
    return defaultGeneralPreferences;
  }
}

export function getFontScaleValue(fontScale) {
  return fontScaleOptions.find((option) => option.id === fontScale)?.scale || 1;
}

export function customThemeToVariables(theme) {
  return {
    "--app-bg": theme.background,
    "--app-bg-layer": `linear-gradient(135deg, ${theme.background} 0%, ${theme.surfaceSoft} 100%)`,
    "--surface": theme.surface,
    "--surface-soft": theme.surfaceSoft,
    "--surface-muted": theme.surfaceSoft,
    "--text": theme.text,
    "--text-strong": theme.text,
    "--text-muted": `color-mix(in srgb, ${theme.text} 72%, ${theme.surface})`,
    "--text-soft": `color-mix(in srgb, ${theme.text} 58%, ${theme.surface})`,
    "--accent": theme.accent,
    "--accent-hover": theme.primaryButton,
    "--primary-button-bg": theme.primaryButton,
    "--primary-button-hover": theme.accent,
    "--sidebar-bg": theme.sidebar,
    "--sidebar-bg-2": theme.sidebar,
    "--sidebar-text": theme.sidebarIcon,
    "--sidebar-muted": theme.sidebarIcon
  };
}

export function isDarkThemeActive() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "dark" || localStorage.getItem("it_guardian_theme") === "dark";
}

export function ensureReadableAppearanceVariables(variables, darkMode) {
  if (!variables) return variables;

  if (darkMode) {
    return {
      ...variables,
      "--app-bg": "#0b111b",
      "--app-bg-layer": `radial-gradient(circle at 18% 0%, color-mix(in srgb, ${variables["--accent"] || "#38bdf8"} 22%, transparent), transparent 34%), linear-gradient(135deg, #0b111b 0%, #111827 100%)`,
      "--surface": "#111827",
      "--surface-soft": "#172235",
      "--surface-muted": "#0f1724",
      "--text": variables["--text"] || "#eaf2ff",
      "--text-strong": variables["--text-strong"] || variables["--text"] || "#ffffff",
      "--text-muted": variables["--text-muted"] || "#c5d1df",
      "--text-soft": variables["--text-soft"] || "#9fb0c4",
      "--border": "#253247",
      "--border-strong": "#33435d"
    };
  }

  return {
    ...variables,
    "--text": variables["--text"] || "#122034",
    "--text-strong": variables["--text-strong"] || variables["--text"] || "#071326",
    "--text-muted": variables["--text-muted"] || "#516177",
    "--text-soft": variables["--text-soft"] || "#718096",
    "--border": variables["--border"] || "#d7e0ea",
    "--border-strong": variables["--border-strong"] || "#b8c6d6"
  };
}

export function clearRuntimeAppearancePreferences() {
  if (typeof document === "undefined") return;

  appearanceVariableNames.forEach((name) => document.documentElement.style.removeProperty(name));
  document.documentElement.style.removeProperty("--app-font-scale");
  document.documentElement.dataset.appearancePreset = "default";
}

export function applyGeneralPreferences(preferences) {
  if (typeof document === "undefined") return;

  document.documentElement.style.setProperty("--app-font-scale", String(getFontScaleValue(preferences.fontScale)));

  const preset = appearancePresets.find((item) => item.id === preferences.appearancePreset) || appearancePresets[0];
  const variables = preferences.appearancePreset === "custom"
    ? customThemeToVariables(preferences.customTheme || defaultCustomTheme)
    : preset.values;

  if (!variables) {
    appearanceVariableNames.forEach((name) => document.documentElement.style.removeProperty(name));
    document.documentElement.dataset.appearancePreset = "default";
    return;
  }

  const readableVariables = ensureReadableAppearanceVariables(variables, isDarkThemeActive());

  Object.entries(readableVariables).forEach(([name, value]) => {
    document.documentElement.style.setProperty(name, value);
  });
  document.documentElement.dataset.appearancePreset = preferences.appearancePreset;
}

export function applyStoredGeneralPreferences() {
  applyGeneralPreferences(readGeneralPreferences());
}
