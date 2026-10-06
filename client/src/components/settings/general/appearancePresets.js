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
    values: {
      "--app-bg": "#eaf8f5",
      "--app-bg-layer": "linear-gradient(135deg, #eaf8f5 0%, #eef9ff 48%, #e7fff6 100%)",
      "--surface": "#ffffff",
      "--surface-soft": "#edf8f5",
      "--surface-muted": "#dcefeb",
      "--accent": "#0f766e",
      "--accent-hover": "#115e59",
      "--primary-button-bg": "#0f766e",
      "--primary-button-hover": "#115e59",
      "--sidebar-bg": "#082f36",
      "--sidebar-bg-2": "#0f4f55",
      "--sidebar-text": "#d8fff6",
      "--sidebar-muted": "#9ee7d6",
      "--border": "#cde6df",
      "--border-strong": "#a9d3c9"
    }
  },
  {
    id: "nebula",
    name: "Nebulosa",
    description: "Roxo espacial com ciano.",
    preview: "linear-gradient(135deg, #111827, #6d28d9, #06b6d4)",
    values: {
      "--app-bg": "#edf0ff",
      "--app-bg-layer": "radial-gradient(circle at 18% 12%, rgba(109, 40, 217, 0.2), transparent 30%), linear-gradient(135deg, #edf0ff 0%, #eef8ff 100%)",
      "--surface": "#ffffff",
      "--surface-soft": "#f2f0ff",
      "--surface-muted": "#e4e2fb",
      "--accent": "#6d28d9",
      "--accent-hover": "#5b21b6",
      "--primary-button-bg": "#6d28d9",
      "--primary-button-hover": "#5b21b6",
      "--sidebar-bg": "#111827",
      "--sidebar-bg-2": "#312e81",
      "--sidebar-text": "#e0f2fe",
      "--sidebar-muted": "#c4b5fd",
      "--border": "#d9d6f7",
      "--border-strong": "#bbb3ef"
    }
  },
  {
    id: "ocean",
    name: "Oceano",
    description: "Azul petroleo limpo.",
    preview: "linear-gradient(135deg, #e0f2fe, #0f4c81)",
    values: {
      "--app-bg": "#eaf4fb",
      "--app-bg-layer": "linear-gradient(135deg, #eaf4fb 0%, #f8fbff 100%)",
      "--surface": "#ffffff",
      "--surface-soft": "#eef7fb",
      "--surface-muted": "#deedf4",
      "--accent": "#0f4c81",
      "--accent-hover": "#0b3a63",
      "--primary-button-bg": "#0f4c81",
      "--primary-button-hover": "#0b3a63",
      "--sidebar-bg": "#092238",
      "--sidebar-bg-2": "#0f3655",
      "--sidebar-text": "#e0f7ff",
      "--sidebar-muted": "#a8d6ea",
      "--border": "#cfdfeb",
      "--border-strong": "#abc7da"
    }
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Laranja e rosa controlados.",
    preview: "linear-gradient(135deg, #f97316, #db2777)",
    values: {
      "--app-bg": "#fff1ec",
      "--app-bg-layer": "linear-gradient(135deg, #fff1ec 0%, #fff7ed 48%, #fdf2f8 100%)",
      "--surface": "#ffffff",
      "--surface-soft": "#fff6f0",
      "--surface-muted": "#ffe5d7",
      "--accent": "#db2777",
      "--accent-hover": "#be185d",
      "--primary-button-bg": "#c2410c",
      "--primary-button-hover": "#9a3412",
      "--sidebar-bg": "#30131f",
      "--sidebar-bg-2": "#7c2d12",
      "--sidebar-text": "#fff7ed",
      "--sidebar-muted": "#fed7aa",
      "--border": "#f3d2c5",
      "--border-strong": "#e9b59f"
    }
  },
  {
    id: "emerald",
    name: "Esmeralda",
    description: "Verde escuro enterprise.",
    preview: "linear-gradient(135deg, #052e24, #10b981)",
    values: {
      "--app-bg": "#ecfdf5",
      "--app-bg-layer": "linear-gradient(135deg, #ecfdf5 0%, #f8fffb 100%)",
      "--surface": "#ffffff",
      "--surface-soft": "#eefbf4",
      "--surface-muted": "#dff3e9",
      "--accent": "#047857",
      "--accent-hover": "#065f46",
      "--primary-button-bg": "#047857",
      "--primary-button-hover": "#065f46",
      "--sidebar-bg": "#052e24",
      "--sidebar-bg-2": "#064e3b",
      "--sidebar-text": "#ecfdf5",
      "--sidebar-muted": "#a7f3d0",
      "--border": "#ccebdc",
      "--border-strong": "#a6d8c1"
    }
  },
  {
    id: "cyber",
    name: "Cyber Blue",
    description: "Azul vivo e moderno.",
    preview: "linear-gradient(135deg, #0f172a, #2563eb, #22d3ee)",
    values: {
      "--app-bg": "#eef6ff",
      "--app-bg-layer": "radial-gradient(circle at 80% 0%, rgba(34, 211, 238, 0.18), transparent 30%), linear-gradient(135deg, #eef6ff 0%, #f8fbff 100%)",
      "--surface": "#ffffff",
      "--surface-soft": "#eff6ff",
      "--surface-muted": "#dbeafe",
      "--accent": "#2563eb",
      "--accent-hover": "#1d4ed8",
      "--primary-button-bg": "#2563eb",
      "--primary-button-hover": "#1d4ed8",
      "--sidebar-bg": "#0f172a",
      "--sidebar-bg-2": "#1e3a8a",
      "--sidebar-text": "#e0f2fe",
      "--sidebar-muted": "#93c5fd",
      "--border": "#cfe0f7",
      "--border-strong": "#a9c6ee"
    }
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Escuro elegante.",
    preview: "linear-gradient(135deg, #020617, #334155)",
    values: {
      "--app-bg": "#101827",
      "--app-bg-layer": "linear-gradient(135deg, #101827 0%, #0f172a 100%)",
      "--surface": "#172235",
      "--surface-soft": "#1f2b3d",
      "--surface-muted": "#111827",
      "--accent": "#38bdf8",
      "--accent-hover": "#0ea5e9",
      "--primary-button-bg": "#0ea5e9",
      "--primary-button-hover": "#0284c7",
      "--sidebar-bg": "#020617",
      "--sidebar-bg-2": "#0f172a",
      "--sidebar-text": "#f8fafc",
      "--sidebar-muted": "#bae6fd",
      "--border": "#334155",
      "--border-strong": "#475569"
    }
  }
];

export const defaultGeneralPreferences = {
  fontScale: "normal",
  appearancePreset: "default",
  customTheme: defaultCustomTheme
};
