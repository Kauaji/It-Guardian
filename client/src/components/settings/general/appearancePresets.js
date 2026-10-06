// Constantes de aparência e usabilidade das Configurações Gerais (dados puros).

export const accentColorKey = "it_guardian_accent_color";
export const generalPreferencesKey = "it_guardian_general_preferences";

export const fontScaleOptions = [
  { id: "small", label: "Pequena", hint: "90%", scale: 0.9 },
  { id: "normal", label: "Normal", hint: "100%", scale: 1 },
  { id: "large", label: "Grande", hint: "110%", scale: 1.1 },
  { id: "xlarge", label: "Muito grande", hint: "120%", scale: 1.2 }
];

export const defaultCustomTheme = {
  background: "#eef2f7",
  surface: "#ffffff",
  surfaceSoft: "#f6f8fb",
  text: "#122034",
  accent: "#1f7a61",
  sidebar: "#111c2a",
  sidebarIcon: "#f3f8ff",
  primaryButton: "#1f7a61"
};

export const appearanceVariableNames = [
  "--app-bg",
  "--app-bg-layer",
  "--surface",
  "--surface-soft",
  "--surface-muted",
  "--accent",
  "--accent-hover",
  "--primary-button-bg",
  "--primary-button-hover",
  "--sidebar-bg",
  "--sidebar-bg-2",
  "--sidebar-text",
  "--sidebar-muted",
  "--text",
  "--text-strong",
  "--text-muted",
  "--text-soft",
  "--border",
  "--border-strong"
];

// Ordem das colunas de `presetValues` (a mesma de aplicação das variáveis CSS do preset).
const presetVariableOrder = [
  "--app-bg",
  "--app-bg-layer",
  "--surface",
  "--surface-soft",
  "--surface-muted",
  "--accent",
  "--accent-hover",
  "--primary-button-bg",
  "--primary-button-hover",
  "--sidebar-bg",
  "--sidebar-bg-2",
  "--sidebar-text",
  "--sidebar-muted",
  "--border",
  "--border-strong"
];

function presetValues(values) {
  return Object.fromEntries(presetVariableOrder.map((name, index) => [name, values[index]]));
}

export const appearancePresets = [
  {
    id: "default",
    name: "Padrão",
    description: "Visual original do IT Guardian.",
    preview: "linear-gradient(135deg, #eef2f7, #1f7a61)",
    values: null
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Verde, azul e luz suave.",
    preview: "linear-gradient(135deg, #071b2d, #0f766e, #67e8f9)",
    values: presetValues([
      "#eaf8f5",
      "linear-gradient(135deg, #eaf8f5 0%, #eef9ff 48%, #e7fff6 100%)",
      "#ffffff",
      "#edf8f5",
      "#dcefeb",
      "#0f766e",
      "#115e59",
      "#0f766e",
      "#115e59",
      "#082f36",
      "#0f4f55",
      "#d8fff6",
      "#9ee7d6",
      "#cde6df",
      "#a9d3c9"
    ])
  },
  {
    id: "nebula",
    name: "Nebulosa",
    description: "Roxo espacial com ciano.",
    preview: "linear-gradient(135deg, #111827, #6d28d9, #06b6d4)",
    values: presetValues([
      "#edf0ff",
      "radial-gradient(circle at 18% 12%, rgba(109, 40, 217, 0.2), transparent 30%), linear-gradient(135deg, #edf0ff 0%, #eef8ff 100%)",
      "#ffffff",
      "#f2f0ff",
      "#e4e2fb",
      "#6d28d9",
      "#5b21b6",
      "#6d28d9",
      "#5b21b6",
      "#111827",
      "#312e81",
      "#e0f2fe",
      "#c4b5fd",
      "#d9d6f7",
      "#bbb3ef"
    ])
  },
  {
    id: "ocean",
    name: "Oceano",
    description: "Azul petroleo limpo.",
    preview: "linear-gradient(135deg, #e0f2fe, #0f4c81)",
    values: presetValues([
      "#eaf4fb",
      "linear-gradient(135deg, #eaf4fb 0%, #f8fbff 100%)",
      "#ffffff",
      "#eef7fb",
      "#deedf4",
      "#0f4c81",
      "#0b3a63",
      "#0f4c81",
      "#0b3a63",
      "#092238",
      "#0f3655",
      "#e0f7ff",
      "#a8d6ea",
      "#cfdfeb",
      "#abc7da"
    ])
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Laranja e rosa controlados.",
    preview: "linear-gradient(135deg, #f97316, #db2777)",
    values: presetValues([
      "#fff1ec",
      "linear-gradient(135deg, #fff1ec 0%, #fff7ed 48%, #fdf2f8 100%)",
      "#ffffff",
      "#fff6f0",
      "#ffe5d7",
      "#db2777",
      "#be185d",
      "#c2410c",
      "#9a3412",
      "#30131f",
      "#7c2d12",
      "#fff7ed",
      "#fed7aa",
      "#f3d2c5",
      "#e9b59f"
    ])
  },
  {
    id: "emerald",
    name: "Esmeralda",
    description: "Verde escuro enterprise.",
    preview: "linear-gradient(135deg, #052e24, #10b981)",
    values: presetValues([
      "#ecfdf5",
      "linear-gradient(135deg, #ecfdf5 0%, #f8fffb 100%)",
      "#ffffff",
      "#eefbf4",
      "#dff3e9",
      "#047857",
      "#065f46",
      "#047857",
      "#065f46",
      "#052e24",
      "#064e3b",
      "#ecfdf5",
      "#a7f3d0",
      "#ccebdc",
      "#a6d8c1"
    ])
  },
  {
    id: "cyber",
    name: "Cyber Blue",
    description: "Azul vivo e moderno.",
    preview: "linear-gradient(135deg, #0f172a, #2563eb, #22d3ee)",
    values: presetValues([
      "#eef6ff",
      "radial-gradient(circle at 80% 0%, rgba(34, 211, 238, 0.18), transparent 30%), linear-gradient(135deg, #eef6ff 0%, #f8fbff 100%)",
      "#ffffff",
      "#eff6ff",
      "#dbeafe",
      "#2563eb",
      "#1d4ed8",
      "#2563eb",
      "#1d4ed8",
      "#0f172a",
      "#1e3a8a",
      "#e0f2fe",
      "#93c5fd",
      "#cfe0f7",
      "#a9c6ee"
    ])
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Escuro elegante.",
    preview: "linear-gradient(135deg, #020617, #334155)",
    values: presetValues([
      "#101827",
      "linear-gradient(135deg, #101827 0%, #0f172a 100%)",
      "#172235",
      "#1f2b3d",
      "#111827",
      "#38bdf8",
      "#0ea5e9",
      "#0ea5e9",
      "#0284c7",
      "#020617",
      "#0f172a",
      "#f8fafc",
      "#bae6fd",
      "#334155",
      "#475569"
    ])
  }
];

export const defaultGeneralPreferences = {
  fontScale: "normal",
  appearancePreset: "default",
  customTheme: defaultCustomTheme
};
