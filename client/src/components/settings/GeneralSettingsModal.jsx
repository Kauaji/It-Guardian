import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  MonitorCog,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  UserCog,
  X
} from "lucide-react";
import {
  createSector,
  createUser,
  deleteSector,
  deleteUser,
  fetchPermissions,
  fetchSectors,
  fetchUsers,
  updateSector,
  updateUserAccess
} from "../../api.js";
import { permissionGroups } from "../../permissions.js";

const accentColorKey = "it_guardian_accent_color";
const generalPreferencesKey = "it_guardian_general_preferences";

const fontScaleOptions = [
  { id: "small", label: "Pequena", hint: "90%", scale: 0.9 },
  { id: "normal", label: "Normal", hint: "100%", scale: 1 },
  { id: "large", label: "Grande", hint: "110%", scale: 1.1 },
  { id: "xlarge", label: "Muito grande", hint: "120%", scale: 1.2 }
];

const defaultCustomTheme = {
  background: "#eef2f7",
  surface: "#ffffff",
  surfaceSoft: "#f6f8fb",
  text: "#122034",
  accent: "#1f7a61",
  sidebar: "#111c2a",
  sidebarIcon: "#f3f8ff",
  primaryButton: "#1f7a61"
};

const appearanceVariableNames = [
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

const appearancePresets = [
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

const defaultGeneralPreferences = {
  fontScale: "normal",
  appearancePreset: "default",
  customTheme: defaultCustomTheme
};

const roleLabels = {
  admin: "Admin",
  operator: "Operador",
  viewer: "Visualizador"
};

function emptyUserForm() {
  return {
    id: "",
    name: "",
    email: "",
    password: "",
    role: "viewer",
    active: true,
    sectorId: "",
    jobTitle: "",
    permissions: []
  };
}

function emptySectorForm() {
  return {
    id: "",
    name: "",
    description: "",
    active: true,
    permissions: []
  };
}

function formatDateTime(value) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function PermissionChecklist({ value, onChange, disabled = false, groups = permissionGroups }) {
  const selected = new Set(value || []);

  function toggle(permissionId) {
    if (disabled) return;
    const next = selected.has(permissionId)
      ? (value || []).filter((item) => item !== permissionId)
      : [...(value || []), permissionId];
    onChange?.(next);
  }

  return (
    <div className="permission-groups">
      {groups.map((group) => (
        <section key={group.id} className="permission-group-card">
          <strong>{group.label}</strong>
          <div>
            {group.permissions.map((permission) => (
              <label key={permission.id} className="permission-check">
                <input
                  type="checkbox"
                  checked={selected.has(permission.id)}
                  disabled={disabled}
                  onChange={() => toggle(permission.id)}
                />
                <span>{permission.label}</span>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function readGeneralPreferences() {
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

function getFontScaleValue(fontScale) {
  return fontScaleOptions.find((option) => option.id === fontScale)?.scale || 1;
}

function customThemeToVariables(theme) {
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

function isDarkThemeActive() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "dark" || localStorage.getItem("it_guardian_theme") === "dark";
}

function ensureReadableAppearanceVariables(variables, darkMode) {
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
  const [section, setSection] = useState("usability");
  const [preferences, setPreferences] = useState(readGeneralPreferences);
  const [users, setUsers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [availablePermissionGroups, setAvailablePermissionGroups] = useState(permissionGroups);
  const [adminTab, setAdminTab] = useState("users");
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [sectorForm, setSectorForm] = useState(emptySectorForm);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [userPermissionsOpen, setUserPermissionsOpen] = useState(false);

  const isAdmin = user?.role === "admin" || user?.isAdmin;

  const sections = useMemo(() => {
    const items = [
      { id: "usability", label: "Usabilidade", icon: SlidersHorizontal },
      { id: "appearance", label: "Aparência", icon: Palette }
    ];

    if (isAdmin) {
      items.push({ id: "admin", label: "Admin", icon: UserCog });
    }

    items.push({ id: "mode", label: "Modo do sistema", icon: BriefcaseBusiness });
    return items;
  }, [isAdmin]);

  useEffect(() => {
    if (open && section === "admin" && !isAdmin) {
      setSection("usability");
    }
    if (open && section === "account") {
      setSection("usability");
    }
  }, [open, section, isAdmin]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeydown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || section !== "admin" || !token || !isAdmin) return;
    loadAdminData();
  }, [open, section, token, isAdmin]);

  useEffect(() => {
    applyGeneralPreferences(preferences);
  }, [theme]);

  function savePreferences(nextPreferences) {
    setPreferences(nextPreferences);
    localStorage.setItem(generalPreferencesKey, JSON.stringify(nextPreferences));
    applyGeneralPreferences(nextPreferences);
  }

  function changeFontScale(fontScale) {
    savePreferences({
      ...preferences,
      fontScale
    });
  }

  function selectAppearancePreset(presetId) {
    savePreferences({
      ...preferences,
      appearancePreset: presetId
    });
  }

  function changeCustomTheme(field, value) {
    const nextPreferences = {
      ...preferences,
      appearancePreset: "custom",
      customTheme: {
        ...preferences.customTheme,
        [field]: value
      }
    };
    if (field === "accent") {
      localStorage.setItem(accentColorKey, value);
    }
    savePreferences(nextPreferences);
  }

  function restoreDefaultAppearance() {
    const nextPreferences = {
      ...preferences,
      appearancePreset: "default",
      customTheme: defaultCustomTheme
    };
    localStorage.removeItem(accentColorKey);
    savePreferences(nextPreferences);
  }

  async function loadAdminData() {
    setLoadingAdmin(true);
    try {
      const [usersResponse, sectorsResponse, permissionsResponse] = await Promise.all([
        fetchUsers(token),
        fetchSectors(token),
        fetchPermissions(token)
      ]);
      setUsers(usersResponse.users || []);
      setSectors(sectorsResponse.sectors || []);
      setAvailablePermissionGroups(permissionsResponse.permissionGroups || permissionGroups);
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setLoadingAdmin(false);
    }
  }

  function editUser(item) {
    setAdminTab("users");
    setUserPermissionsOpen(false);
    setUserForm({
      id: item.id,
      name: item.name || "",
      email: item.email || "",
      password: "",
      role: item.isAdmin ? "admin" : item.role || "operator",
      active: item.active !== false,
      sectorId: item.sectorId || "",
      jobTitle: item.jobTitle || "",
      permissions: item.permissions || []
    });
  }

  function editSector(item) {
    setAdminTab("sectors");
    setSectorForm({
      id: item.id,
      name: item.name || "",
      description: item.description || "",
      active: item.active !== false,
      permissions: item.permissions || []
    });
  }

  async function submitUserForm(event) {
    event.preventDefault();

    if (!userForm.name.trim() || !userForm.email.trim()) {
      notify("Informe nome e e-mail do usuário.", "danger");
      return;
    }

    if (!userForm.id && userForm.password.trim().length < 6) {
      notify("Informe uma senha temporaria com pelo menos 6 caracteres.", "danger");
      return;
    }

    setSavingAdmin(true);
    try {
      const payload = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        role: userForm.role,
        active: userForm.active,
        sectorId: userForm.sectorId || null,
        jobTitle: userForm.jobTitle.trim(),
        permissions: userForm.role === "admin" ? [] : userForm.permissions
      };

      const response = userForm.id
        ? await updateUserAccess(token, userForm.id, payload)
        : await createUser(token, { ...payload, password: userForm.password });

      setUsers((current) => {
        if (userForm.id) {
          return current.map((item) => (item.id === response.user.id ? response.user : item));
        }
        return [response.user, ...current];
      });
      setUserForm(emptyUserForm());
      setUserPermissionsOpen(false);
      notify(userForm.id ? "Usuario atualizado." : "Usuario criado.", "ok");
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSavingAdmin(false);
    }
  }

  async function submitSectorForm(event) {
    event.preventDefault();

    if (!sectorForm.name.trim()) {
      notify("Informe o nome do setor.", "danger");
      return;
    }

    setSavingAdmin(true);
    try {
      const payload = {
        name: sectorForm.name.trim(),
        description: sectorForm.description.trim(),
        active: sectorForm.active,
        permissions: sectorForm.permissions
      };
      const response = sectorForm.id
        ? await updateSector(token, sectorForm.id, payload)
        : await createSector(token, payload);

      setSectors((current) => {
        if (sectorForm.id) {
          return current.map((item) => (item.id === response.sector.id ? response.sector : item));
        }
        return [response.sector, ...current];
      });
      setSectorForm(emptySectorForm());
      notify(sectorForm.id ? "Setor atualizado." : "Setor criado.", "ok");
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSavingAdmin(false);
    }
  }

  async function deactivateSector(id) {
    if (!window.confirm("Deseja desativar este setor? Os usuários continuam existindo.")) return;

    setSavingAdmin(true);
    try {
      const response = await deleteSector(token, id);
      setSectors((current) => current.map((item) => (item.id === id ? response.sector : item)));
      notify("Setor desativado.", "ok");
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSavingAdmin(false);
    }
  }

  async function deactivateUser(id) {
    if (!window.confirm("Tem certeza que deseja excluir este usuário? Essa ação não poderá ser desfeita.")) return;

    setSavingAdmin(true);
    try {
      const response = await deleteUser(token, id);
      setUsers((current) => current.map((item) => (item.id === id ? response.user : item)));
      if (userForm.id === id) {
        setUserForm(emptyUserForm());
        setUserPermissionsOpen(false);
      }
      notify("Usuário excluído.", "ok");
    } catch (error) {
      notify(error.message, "danger");
    } finally {
      setSavingAdmin(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop general-settings-backdrop" role="presentation">
      <section className="general-settings-modal" role="dialog" aria-modal="true" aria-label="Configurações gerais">
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
              <div className="general-settings-section">
                <MonitorCog size={22} />
                <h3>Usabilidade</h3>
                <p>Preferencias simples para leitura, comportamento e acessibilidade da interface.</p>
                <div className="font-scale-card">
                  <div>
                    <strong>Tamanho geral das fontes</strong>
                    <span>Ajuste a escala sem alterar a estrutura dos cards, tabelas e modais.</span>
                  </div>
                  <div className="font-scale-options" role="group" aria-label="Tamanho geral das fontes">
                    {fontScaleOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={preferences.fontScale === option.id ? "active" : ""}
                        onClick={() => changeFontScale(option.id)}
                      >
                        <span>{option.label}</span>
                        <small>{option.hint}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {section === "appearance" && (
              <div className="general-settings-section">
                <Palette size={22} />
                <h3>Aparência</h3>
                <p>Presets e cores globais do sistema. As cores próprias de abas, grupos e segmentos continuam independentes.</p>
                <div className="appearance-top-actions">
                  <button type="button" className="secondary-action compact-action" onClick={onToggleTheme}>
                    Alternar para modo {theme === "dark" ? "claro" : "noturno"}
                  </button>
                  <button
                    type="button"
                    className="ghost-action compact-action"
                    onClick={restoreDefaultAppearance}
                  >
                    <RotateCcw size={15} />
                    Restaurar padrao visual
                  </button>
                </div>
                <div className="appearance-preset-grid" aria-label="Presets de aparencia">
                  {appearancePresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={preferences.appearancePreset === preset.id ? "appearance-preset-card active" : "appearance-preset-card"}
                      onClick={() => selectAppearancePreset(preset.id)}
                    >
                      <span className="appearance-preset-preview" style={{ background: preset.preview }} />
                      <strong>{preset.name}</strong>
                      <small>{preset.description}</small>
                    </button>
                  ))}
                  <button
                    type="button"
                    className={preferences.appearancePreset === "custom" ? "appearance-preset-card active" : "appearance-preset-card"}
                    onClick={() => selectAppearancePreset("custom")}
                  >
                    <span
                      className="appearance-preset-preview"
                      style={{
                        background: `linear-gradient(135deg, ${preferences.customTheme.sidebar}, ${preferences.customTheme.accent}, ${preferences.customTheme.background})`
                      }}
                    />
                    <strong>Personalizado</strong>
                    <small>Monte sua propria combinacao.</small>
                  </button>
                </div>
                <div className="custom-theme-panel">
                  <div>
                    <strong>Cores personalizadas</strong>
                    <span>Ao editar uma cor, o tema personalizado é aplicado automaticamente.</span>
                  </div>
                  <div className="custom-theme-grid">
                    <label>
                      Fundo do sistema
                      <input
                        type="color"
                        value={preferences.customTheme.background}
                        onChange={(event) => changeCustomTheme("background", event.target.value)}
                      />
                    </label>
                    <label>
                      Areas principais
                      <input
                        type="color"
                        value={preferences.customTheme.surface}
                        onChange={(event) => changeCustomTheme("surface", event.target.value)}
                      />
                    </label>
                    <label>
                      Areas secundarias
                      <input
                        type="color"
                        value={preferences.customTheme.surfaceSoft}
                        onChange={(event) => changeCustomTheme("surfaceSoft", event.target.value)}
                      />
                    </label>
                    <label>
                      Cor das letras
                      <input
                        type="color"
                        value={preferences.customTheme.text}
                        onChange={(event) => changeCustomTheme("text", event.target.value)}
                      />
                    </label>
                    <label>
                      Cor principal
                      <input
                        type="color"
                        value={preferences.customTheme.accent}
                        onChange={(event) => changeCustomTheme("accent", event.target.value)}
                      />
                    </label>
                    <label>
                      Fundo da sidebar
                      <input
                        type="color"
                        value={preferences.customTheme.sidebar}
                        onChange={(event) => changeCustomTheme("sidebar", event.target.value)}
                      />
                    </label>
                    <label>
                      Ícones da sidebar
                      <input
                        type="color"
                        value={preferences.customTheme.sidebarIcon}
                        onChange={(event) => changeCustomTheme("sidebarIcon", event.target.value)}
                      />
                    </label>
                    <label>
                      Botões principais
                      <input
                        type="color"
                        value={preferences.customTheme.primaryButton}
                        onChange={(event) => changeCustomTheme("primaryButton", event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="theme-preview-card">
                    <span>Prévia rápida</span>
                    <div>
                      <span style={{ background: preferences.customTheme.background }} />
                      <span style={{ background: preferences.customTheme.surface }} />
                      <span style={{ background: preferences.customTheme.text }} />
                      <span style={{ background: preferences.customTheme.accent }} />
                      <span style={{ background: preferences.customTheme.sidebar }} />
                      <span style={{ background: preferences.customTheme.primaryButton }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {section === "admin" && isAdmin && (
              <div className="general-settings-section admin-settings-section">
                <UserCog size={22} />
                <h3>Admin</h3>
                <p>Gerencie usuários, setores e permissões da empresa atual.</p>

                <div className="admin-settings-tabs" role="tablist" aria-label="Administração">
                  <button type="button" className={adminTab === "users" ? "active" : ""} onClick={() => setAdminTab("users")}>
                    Usuários
                  </button>
                  <button type="button" className={adminTab === "sectors" ? "active" : ""} onClick={() => setAdminTab("sectors")}>
                    Setores
                  </button>
                  <button type="button" className={adminTab === "permissions" ? "active" : ""} onClick={() => setAdminTab("permissions")}>
                    Permissões
                  </button>
                </div>

                {loadingAdmin && <p className="empty">Carregando administração...</p>}

                {adminTab === "users" && (
                  <div className="admin-settings-grid">
                    <form className="admin-form-card" onSubmit={submitUserForm}>
                      <div className="admin-form-header">
                        <strong>{userForm.id ? "Editar usuário" : "Novo usuário"}</strong>
                        {userForm.id && (
                          <button
                            type="button"
                            className="ghost-action compact-action"
                            onClick={() => {
                              setUserForm(emptyUserForm());
                              setUserPermissionsOpen(false);
                            }}
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                      <div className="admin-form-grid">
                        <label>
                          Nome
                          <input value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} />
                        </label>
                        <label>
                          E-mail
                          <input value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} />
                        </label>
                        {!userForm.id && (
                          <label>
                            Senha temporaria
                            <input
                              type="password"
                              value={userForm.password}
                              onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                              placeholder="Minimo 6 caracteres"
                            />
                          </label>
                        )}
                        <label>
                          Setor
                          <select value={userForm.sectorId} onChange={(event) => setUserForm((current) => ({ ...current, sectorId: event.target.value }))}>
                            <option value="">Sem setor</option>
                            {sectors.filter((sector) => sector.active !== false).map((sector) => (
                              <option key={sector.id} value={sector.id}>{sector.name}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Funcao/cargo
                          <input value={userForm.jobTitle} onChange={(event) => setUserForm((current) => ({ ...current, jobTitle: event.target.value }))} />
                        </label>
                        <label>
                          Perfil
                          <select value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))}>
                            {Object.entries(roleLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="admin-inline-check">
                        <input
                          type="checkbox"
                          checked={userForm.active}
                          onChange={(event) => setUserForm((current) => ({ ...current, active: event.target.checked }))}
                        />
                        Usuario ativo
                      </label>
                      <section className={`admin-form-collapsible${userPermissionsOpen ? " open" : ""}`}>
                        <button
                          type="button"
                          className="admin-form-collapsible-trigger"
                          aria-expanded={userPermissionsOpen}
                          onClick={() => setUserPermissionsOpen((current) => !current)}
                        >
                          <span>
                            <strong>Permissões individuais</strong>
                            <small>Somam com as permissões herdadas do setor.</small>
                          </span>
                          {userPermissionsOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                        {userPermissionsOpen && (
                          <div className="admin-permission-editor">
                            <span>Administradores sempre possuem acesso total.</span>
                            <PermissionChecklist
                              value={userForm.permissions}
                              groups={availablePermissionGroups}
                              disabled={userForm.role === "admin"}
                              onChange={(permissions) => setUserForm((current) => ({ ...current, permissions }))}
                            />
                          </div>
                        )}
                      </section>
                      <button type="submit" className="primary-action compact-action" disabled={savingAdmin}>
                        {savingAdmin ? "Salvando..." : userForm.id ? "Salvar usuário" : "Criar usuário"}
                      </button>
                    </form>

                    <div className="admin-record-list">
                      {users.map((item) => (
                        <article key={item.id} className={item.active === false ? "inactive" : ""}>
                          <div>
                            <strong>{item.name}</strong>
                            <small>
                              {roleLabels[item.role] || item.role}
                              {item.sectorName ? ` - ${item.sectorName}` : ""}
                              {item.jobTitle ? ` - ${item.jobTitle}` : ""}
                            </small>
                          </div>
                          <div className="admin-record-meta">
                            <span className={item.active === false ? "admin-badge muted" : "admin-badge"}>{item.active === false ? "Inativo" : "Ativo"}</span>
                            {item.isAdmin && <span className="admin-badge accent">Admin</span>}
                            <small>{formatDateTime(item.updatedAt || item.createdAt)}</small>
                          </div>
                          <div className="admin-record-actions">
                            <button type="button" className="secondary-action compact-action" onClick={() => editUser(item)}>
                              Editar
                            </button>
                            <button
                              type="button"
                              className="danger-action compact-action icon-only"
                              onClick={() => deactivateUser(item.id)}
                              disabled={savingAdmin || item.active === false}
                              title="Excluir usuário"
                              aria-label={`Excluir usuário ${item.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {adminTab === "sectors" && (
                  <div className="admin-settings-grid">
                    <form className="admin-form-card" onSubmit={submitSectorForm}>
                      <div className="admin-form-header">
                        <strong>{sectorForm.id ? "Editar setor" : "Novo setor"}</strong>
                        {sectorForm.id && (
                          <button type="button" className="ghost-action compact-action" onClick={() => setSectorForm(emptySectorForm())}>
                            Limpar
                          </button>
                        )}
                      </div>
                      <label>
                        Nome do setor
                        <input value={sectorForm.name} onChange={(event) => setSectorForm((current) => ({ ...current, name: event.target.value }))} />
                      </label>
                      <label>
                        Descrição
                        <textarea value={sectorForm.description} onChange={(event) => setSectorForm((current) => ({ ...current, description: event.target.value }))} />
                      </label>
                      <label className="admin-inline-check">
                        <input
                          type="checkbox"
                          checked={sectorForm.active}
                          onChange={(event) => setSectorForm((current) => ({ ...current, active: event.target.checked }))}
                        />
                        Setor ativo
                      </label>
                      <div className="admin-permission-editor">
                        <strong>Permissões padrão do setor</strong>
                        <span>Usuários deste setor herdam estas permissões automaticamente.</span>
                        <PermissionChecklist
                          value={sectorForm.permissions}
                          groups={availablePermissionGroups}
                          onChange={(permissions) => setSectorForm((current) => ({ ...current, permissions }))}
                        />
                      </div>
                      <button type="submit" className="primary-action compact-action" disabled={savingAdmin}>
                        {savingAdmin ? "Salvando..." : sectorForm.id ? "Salvar setor" : "Criar setor"}
                      </button>
                    </form>

                    <div className="admin-record-list">
                      {sectors.map((item) => (
                        <article key={item.id} className={item.active === false ? "inactive" : ""}>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.description || "Sem descrição"}</span>
                            <small>{item.permissions.length} permissoes padrao</small>
                          </div>
                          <div className="admin-record-meta">
                            <span className={item.active === false ? "admin-badge muted" : "admin-badge"}>{item.active === false ? "Inativo" : "Ativo"}</span>
                            <small>{formatDateTime(item.updatedAt || item.createdAt)}</small>
                          </div>
                          <div className="admin-record-actions">
                            <button type="button" className="secondary-action compact-action" onClick={() => editSector(item)}>
                              Editar
                            </button>
                            {item.active !== false && (
                              <button type="button" className="danger-action compact-action" onClick={() => deactivateSector(item.id)}>
                                Desativar
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {adminTab === "permissions" && (
                  <div className="admin-permissions-overview">
                    <p>Permissões são validadas no frontend para exibir menus e no backend para bloquear chamadas diretas de API.</p>
                    <PermissionChecklist
                      value={availablePermissionGroups.flatMap((group) => group.permissions.map((permission) => permission.id))}
                      groups={availablePermissionGroups}
                      disabled
                    />
                  </div>
                )}
              </div>
            )}

            {section === "mode" && (
              <div className="general-settings-section">
                <BriefcaseBusiness size={22} />
                <h3>Modo do sistema</h3>
                <p>Define se as Ordens de Serviço seguem o fluxo simples de uso interno ou o fluxo Business, mais completo e exigente.</p>
                <label className="business-mode-card">
                  <input
                    type="checkbox"
                    checked={systemMode === "business"}
                    onChange={(event) => onSystemModeChange?.(event.target.checked ? "business" : "local")}
                  />
                  <span>
                    <strong>Ativar modo Business</strong>
                    <small>{systemMode === "business" ? "Business ativo" : "Modo Local ativo"}</small>
                  </span>
                </label>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
