import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api.js", () => ({
  createSector: vi.fn(),
  createUser: vi.fn(),
  deleteSector: vi.fn(),
  deleteUser: vi.fn(),
  fetchPermissions: vi.fn(),
  fetchSectors: vi.fn(),
  fetchUsers: vi.fn(),
  updateSector: vi.fn(),
  updateUserAccess: vi.fn(),
  createProductKey: vi.fn(),
  deactivateProductKeyActivation: vi.fn(),
  fetchIntegrationStatus: vi.fn(),
  fetchProductKeyActivations: vi.fn(),
  fetchProductKeys: vi.fn(),
  synchronizeIntegration: vi.fn(),
  testIntegrationConnection: vi.fn(),
  updateProductKeyStatus: vi.fn()
}));
vi.mock("../../api/identityApi.js");

import * as api from "../../api.js";
import GeneralSettingsModal, {
  applyGeneralPreferences,
  applyStoredGeneralPreferences,
  clearRuntimeAppearancePreferences
} from "./GeneralSettingsModal.jsx";

const admin = { id: "u1", role: "admin", isAdmin: true };
const operator = { id: "u9", role: "operator" };

const sectorsFixture = [
  { id: "s1", name: "Financeiro", description: "", active: true, permissions: ["a", "b"], updatedAt: "2026-01-02T12:00:00Z" },
  { id: "s2", name: "Antigo", description: "Setor velho", active: false, permissions: [], createdAt: "2026-01-01T12:00:00Z" }
];
const usersFixture = [
  { id: "u1", name: "Admin Root", email: "root@x.com", role: "admin", isAdmin: true, active: true, sectorName: "Financeiro", jobTitle: "CTO", updatedAt: "2026-01-02T12:00:00Z" },
  { id: "u2", name: "Bruno", email: "bruno@x.com", role: "operator", active: false, sectorId: "s1", permissions: ["x"] }
];
const permissionGroupsFixture = [
  { id: "g1", label: "Grupo 1", permissions: [{ id: "p1", label: "Permissão 1" }, { id: "p2", label: "Permissão 2" }] }
];

let notify;
let onClose;
let onToggleTheme;
let onSystemModeChange;

function mount(props = {}) {
  notify = vi.fn();
  onClose = vi.fn();
  onToggleTheme = vi.fn();
  onSystemModeChange = vi.fn();
  const ui = (extra = {}) => (
    <GeneralSettingsModal
      open
      token="tok"
      user={admin}
      theme="light"
      systemMode="local"
      onClose={onClose}
      onToggleTheme={onToggleTheme}
      onSystemModeChange={onSystemModeChange}
      notify={notify}
      {...props}
      {...extra}
    />
  );
  const view = render(ui());
  return { ...view, user: userEvent.setup(), rerender: (extra) => view.rerender(ui(extra)) };
}

async function openAdmin() {
  const ctx = mount();
  await ctx.user.click(screen.getByRole("button", { name: "Admin" }));
  await screen.findByText("Admin Root");
  return ctx;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("style");
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.appearancePreset;
  api.fetchUsers.mockResolvedValue({ users: usersFixture });
  api.fetchSectors.mockResolvedValue({ sectors: sectorsFixture });
  api.fetchPermissions.mockResolvedValue({ permissionGroups: permissionGroupsFixture });
  api.fetchProductKeys.mockResolvedValue({ productKeys: [] });
  api.fetchIntegrationStatus.mockResolvedValue({ configuration: { enabled: false } });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("GeneralSettingsModal - estrutura e secoes", () => {
  it("fechado nao renderiza nada", () => {
    const { container } = render(<GeneralSettingsModal open={false} token="t" user={admin} theme="light" notify={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("abre em Usabilidade, com dialogo rotulado e botao fechar", async () => {
    const { user } = mount();
    expect(screen.getByRole("dialog", { name: "Configurações gerais" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Configurações Gerais" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Usabilidade" })).toBeInTheDocument();
    await user.click(screen.getByTitle("Fechar"));
    expect(onClose).toHaveBeenCalled();
  });

  it("nao-admin nao ve a aba Admin; admin ve na ordem Usabilidade, Aparencia, Admin, Modo", () => {
    mount({ user: operator });
    const tabs = within(document.querySelector(".general-settings-tabs")).getAllByRole("button").map((b) => b.textContent);
    expect(tabs).toEqual(["Usabilidade", "Aparência", "Modo do sistema"]);
  });

  it("admin ve as quatro abas", () => {
    mount();
    const tabs = within(document.querySelector(".general-settings-tabs")).getAllByRole("button").map((b) => b.textContent);
    expect(tabs).toEqual(["Usabilidade", "Aparência", "Admin", "Modo do sistema"]);
  });

  it("modo do sistema reflete o estado e dispara a troca", async () => {
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "Modo do sistema" }));
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText("Modo Local ativo")).toBeInTheDocument();
    await user.click(checkbox);
    expect(onSystemModeChange).toHaveBeenCalledWith("business");
  });

  it("modo business marcado desliga para local", async () => {
    const { user } = mount({ systemMode: "business" });
    await user.click(screen.getByRole("button", { name: "Modo do sistema" }));
    expect(screen.getByText("Business ativo")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    expect(onSystemModeChange).toHaveBeenCalledWith("local");
  });
});

describe("GeneralSettingsModal - usabilidade e aparencia", () => {
  it("troca a escala de fonte, persiste e aplica a variavel CSS", async () => {
    const { user } = mount();
    const group = screen.getByRole("group", { name: "Tamanho geral das fontes" });
    expect(within(group).getAllByRole("button")).toHaveLength(4);
    await user.click(within(group).getByRole("button", { name: /Grande/ }));
    expect(JSON.parse(localStorage.getItem("it_guardian_general_preferences")).fontScale).toBe("large");
    expect(document.documentElement.style.getPropertyValue("--app-font-scale")).toBe("1.1");
    expect(within(group).getByRole("button", { name: /Grande/ })).toHaveClass("active");
  });

  it("le preferencias salvas ao abrir e mescla o tema personalizado", async () => {
    localStorage.setItem("it_guardian_general_preferences", JSON.stringify({ fontScale: "small", customTheme: { accent: "#123456" } }));
    mount();
    expect(screen.getByRole("button", { name: /Pequena/ })).toHaveClass("active");
    expect(document.documentElement.style.getPropertyValue("--app-font-scale")).toBe("0.9");
  });

  it("JSON invalido nas preferencias volta ao padrao", () => {
    localStorage.setItem("it_guardian_general_preferences", "{nao-json");
    mount();
    expect(screen.getByRole("button", { name: /Normal/ })).toHaveClass("active");
  });

  it("aparencia: seleciona preset, aplica variaveis e permite voltar ao padrao", async () => {
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "Aparência" }));
    expect(screen.getByLabelText("Presets de aparência")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Aurora/ }));
    expect(document.documentElement.dataset.appearancePreset).toBe("aurora");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#0f766e");
    expect(screen.getByRole("button", { name: /Aurora/ })).toHaveClass("active");

    await user.click(screen.getByRole("button", { name: /Restaurar padrão visual/ }));
    expect(document.documentElement.dataset.appearancePreset).toBe("default");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
  });

  it("alternar tema chama o callback com o rotulo certo", async () => {
    const { user, rerender } = mount();
    await user.click(screen.getByRole("button", { name: "Aparência" }));
    await user.click(screen.getByRole("button", { name: "Alternar para modo noturno" }));
    expect(onToggleTheme).toHaveBeenCalled();
    rerender({ theme: "dark" });
    expect(screen.getByRole("button", { name: "Alternar para modo claro" })).toBeInTheDocument();
  });

  it("cores personalizadas ativam o preset custom e guardam a cor principal", async () => {
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "Aparência" }));
    const accent = screen.getByLabelText("Cor principal");
    // input[type=color] aceita fireEvent.input/change com valor hexadecimal
    fireEvent.change(accent, { target: { value: "#ff0000" } });
    expect(localStorage.getItem("it_guardian_accent_color")).toBe("#ff0000");
    const stored = JSON.parse(localStorage.getItem("it_guardian_general_preferences"));
    expect(stored.appearancePreset).toBe("custom");
    expect(stored.customTheme.accent).toBe("#ff0000");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#ff0000");

    fireEvent.change(screen.getByLabelText("Fundo do sistema"), { target: { value: "#000000" } });
    expect(JSON.parse(localStorage.getItem("it_guardian_general_preferences")).customTheme.background).toBe("#000000");
    expect(localStorage.getItem("it_guardian_accent_color")).toBe("#ff0000");

    await user.click(screen.getByRole("button", { name: /Restaurar padrão visual/ }));
    expect(localStorage.getItem("it_guardian_accent_color")).toBeNull();
  });

  it("card Personalizado seleciona o preset custom", async () => {
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "Aparência" }));
    await user.click(screen.getByRole("button", { name: /Personalizado/ }));
    expect(document.documentElement.dataset.appearancePreset).toBe("custom");
    expect(screen.getByRole("button", { name: /Personalizado/ })).toHaveClass("active");
  });

  it("mudar o tema reaplica as preferencias (modo escuro)", async () => {
    localStorage.setItem("it_guardian_general_preferences", JSON.stringify({ appearancePreset: "ocean" }));
    const { rerender } = mount();
    expect(document.documentElement.style.getPropertyValue("--surface")).toBe("#ffffff");
    document.documentElement.dataset.theme = "dark";
    rerender({ theme: "dark" });
    expect(document.documentElement.style.getPropertyValue("--surface")).toBe("#111827");
  });
});

describe("applyGeneralPreferences e utilitarios exportados", () => {
  it("applyStoredGeneralPreferences usa o localStorage e clear remove tudo", () => {
    localStorage.setItem("it_guardian_general_preferences", JSON.stringify({ appearancePreset: "sunset", fontScale: "xlarge" }));
    applyStoredGeneralPreferences();
    expect(document.documentElement.dataset.appearancePreset).toBe("sunset");
    expect(document.documentElement.style.getPropertyValue("--app-font-scale")).toBe("1.2");
    expect(document.documentElement.style.getPropertyValue("--primary-button-bg")).toBe("#c2410c");
    clearRuntimeAppearancePreferences();
    expect(document.documentElement.dataset.appearancePreset).toBe("default");
    expect(document.documentElement.style.getPropertyValue("--primary-button-bg")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--app-font-scale")).toBe("");
  });

  it("preset custom gera variaveis a partir do tema; tema escuro guardado em localStorage", () => {
    localStorage.setItem("it_guardian_theme", "dark");
    applyGeneralPreferences({
      fontScale: "normal",
      appearancePreset: "custom",
      customTheme: {
        background: "#111111",
        surface: "#222222",
        surfaceSoft: "#333333",
        text: "#444444",
        accent: "#555555",
        sidebar: "#666666",
        sidebarIcon: "#777777",
        primaryButton: "#888888"
      }
    });
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--accent")).toBe("#555555");
    expect(style.getPropertyValue("--surface")).toBe("#111827");
    expect(style.getPropertyValue("--text")).toBe("#444444");
    expect(style.getPropertyValue("--border")).toBe("#253247");
    expect(style.getPropertyValue("--app-font-scale")).toBe("1");
  });

  it("preset custom sem tema usa o padrao; preset desconhecido vira padrao visual", () => {
    applyGeneralPreferences({ fontScale: "x", appearancePreset: "custom" });
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#1f7a61");
    expect(document.documentElement.style.getPropertyValue("--app-font-scale")).toBe("1");
    applyGeneralPreferences({ fontScale: "normal", appearancePreset: "inexistente" });
    expect(document.documentElement.dataset.appearancePreset).toBe("default");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
  });
});

describe("GeneralSettingsModal - admin: usuarios", () => {
  it("carrega usuarios, setores e permissoes ao abrir a aba", async () => {
    await openAdmin();
    expect(api.fetchUsers).toHaveBeenCalledWith("tok");
    expect(api.fetchSectors).toHaveBeenCalledWith("tok");
    expect(api.fetchPermissions).toHaveBeenCalledWith("tok");
    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(screen.getByText("Inativo")).toBeInTheDocument();
    expect(screen.getByText("Operador", { selector: "small" })).toBeInTheDocument();
    expect(screen.getByText("Admin - Financeiro - CTO")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir usuário Bruno" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Excluir usuário Admin Root" })).toBeEnabled();
    expect(screen.getByRole("tablist", { name: "Administração" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redefinir senha de Bruno" })).toBeInTheDocument();
  });

  it("falha ao carregar notifica o erro", async () => {
    api.fetchUsers.mockRejectedValue(new Error("Falhou geral"));
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "Admin" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Falhou geral", "danger"));
  });

  it("sem lista de permissoes do servidor usa o catalogo local", async () => {
    api.fetchPermissions.mockResolvedValue({});
    const { user } = mount();
    await user.click(screen.getByRole("button", { name: "Admin" }));
    await screen.findByText("Admin Root");
    await user.click(screen.getByRole("button", { name: "Permissões" }));
    expect(document.querySelectorAll(".permission-group-card").length).toBeGreaterThan(1);
  });

  it("valida nome/e-mail e senha minima antes de criar", async () => {
    const { user } = await openAdmin();
    await user.click(screen.getByRole("button", { name: "Criar usuário" }));
    expect(notify).toHaveBeenCalledWith("Informe nome e e-mail do usuário.", "danger");

    await user.type(screen.getByLabelText("Nome"), "Carla");
    await user.type(screen.getByLabelText("E-mail"), "carla@x.com");
    await user.type(screen.getByLabelText("Senha temporária"), "curta");
    await user.click(screen.getByRole("button", { name: "Criar usuário" }));
    expect(notify).toHaveBeenLastCalledWith(
      "Informe uma senha temporária com pelo menos 12 caracteres. A pessoa troca no primeiro acesso.",
      "danger"
    );
    expect(api.createUser).not.toHaveBeenCalled();
  });

  it("cria usuario (com permissoes individuais) e o coloca no topo da lista", async () => {
    api.createUser.mockResolvedValue({ user: { id: "u3", name: "Carla", role: "viewer", active: true } });
    const { user } = await openAdmin();
    await user.type(screen.getByLabelText("Nome"), "  Carla ");
    await user.type(screen.getByLabelText("E-mail"), "carla@x.com");
    await user.type(screen.getByLabelText("Senha temporária"), "senha-bem-longa-1");
    await user.type(screen.getByLabelText("Funcao/cargo"), " Analista ");
    await user.selectOptions(screen.getByLabelText("Setor"), "s1");
    await user.selectOptions(screen.getByLabelText("Perfil"), "operator");
    await user.click(screen.getByLabelText("Usuário ativo"));

    const trigger = screen.getByRole("button", { name: /Permissões individuais/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByLabelText("Permissão 1"));

    await user.click(screen.getByRole("button", { name: "Criar usuário" }));
    await waitFor(() => expect(api.createUser).toHaveBeenCalled());
    expect(api.createUser).toHaveBeenCalledWith("tok", {
      name: "Carla",
      email: "carla@x.com",
      role: "operator",
      active: false,
      sectorId: "s1",
      jobTitle: "Analista",
      permissions: ["p1"],
      password: "senha-bem-longa-1"
    });
    expect(notify).toHaveBeenCalledWith("Usuário criado.", "ok");
    const names = Array.from(document.querySelectorAll(".admin-record-list article strong")).map((n) => n.textContent);
    expect(names[0]).toBe("Carla");
    expect(screen.getByLabelText("Nome")).toHaveValue("");
    expect(screen.queryByText("Permissões individuais")).toBeInTheDocument();
    expect(screen.queryByText("Administradores sempre possuem acesso total.")).not.toBeInTheDocument();
  });

  it("edita usuario: preenche o formulario, esconde senha, desabilita permissoes de admin e atualiza", async () => {
    api.updateUserAccess.mockResolvedValue({ user: { ...usersFixture[0], name: "Admin Novo" } });
    const { user } = await openAdmin();
    const card = screen.getByText("Admin Root").closest("article");
    await user.click(within(card).getByRole("button", { name: "Editar" }));
    expect(screen.getByText("Editar usuário")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Admin Root");
    expect(screen.queryByLabelText("Senha temporária")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Perfil")).toHaveValue("admin");

    await user.click(screen.getByRole("button", { name: /Permissões individuais/ }));
    expect(screen.getByLabelText("Permissão 1")).toBeDisabled();

    await user.clear(screen.getByLabelText("Nome"));
    await user.type(screen.getByLabelText("Nome"), "Admin Novo");
    await user.click(screen.getByRole("button", { name: "Salvar usuário" }));
    await waitFor(() => expect(api.updateUserAccess).toHaveBeenCalled());
    expect(api.updateUserAccess).toHaveBeenCalledWith("tok", "u1", expect.objectContaining({ name: "Admin Novo", permissions: [] }));
    expect(notify).toHaveBeenCalledWith("Usuário atualizado.", "ok");
    expect(await screen.findByText("Admin Novo")).toBeInTheDocument();
    expect(screen.getByText("Novo usuário")).toBeInTheDocument();
  });

  it("Limpar volta ao formulario de novo usuario", async () => {
    const { user } = await openAdmin();
    const card = screen.getByText("Bruno").closest("article");
    await user.click(within(card).getByRole("button", { name: "Editar" }));
    expect(screen.getByLabelText("Perfil")).toHaveValue("operator");
    await user.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByText("Novo usuário")).toBeInTheDocument();
  });

  it("erro do servidor ao salvar notifica e reabilita o botao", async () => {
    api.createUser.mockRejectedValue(new Error("E-mail duplicado"));
    const { user } = await openAdmin();
    await user.type(screen.getByLabelText("Nome"), "Carla");
    await user.type(screen.getByLabelText("E-mail"), "c@x.com");
    await user.type(screen.getByLabelText("Senha temporária"), "senha-bem-longa-1");
    await user.click(screen.getByRole("button", { name: "Criar usuário" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("E-mail duplicado", "danger"));
    expect(screen.getByRole("button", { name: "Criar usuário" })).toBeEnabled();
  });

  it("exclui usuario somente apos confirmar e limpa o formulario se era o editado", async () => {
    api.deleteUser.mockResolvedValue({ user: { ...usersFixture[0], active: false } });
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { user } = await openAdmin();
    const card = screen.getByText("Admin Root").closest("article");
    await user.click(within(card).getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Excluir usuário Admin Root" }));
    expect(api.deleteUser).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Excluir usuário Admin Root" }));
    await waitFor(() => expect(api.deleteUser).toHaveBeenCalledWith("tok", "u1"));
    expect(confirm).toHaveBeenCalledWith("Tem certeza que deseja excluir este usuário? Essa ação não poderá ser desfeita.");
    expect(notify).toHaveBeenCalledWith("Usuário excluído.", "ok");
    expect(screen.getByText("Novo usuário")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir usuário Admin Root" })).toBeDisabled();
  });

  it("erro ao excluir usuario notifica", async () => {
    api.deleteUser.mockRejectedValue(new Error("Nao pode"));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user } = await openAdmin();
    await user.click(screen.getByRole("button", { name: "Excluir usuário Admin Root" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Nao pode", "danger"));
  });
});

describe("GeneralSettingsModal - admin: setores, permissoes e cloud", () => {
  async function openSectors() {
    const ctx = await openAdmin();
    await ctx.user.click(screen.getByRole("button", { name: "Setores" }));
    return ctx;
  }

  it("lista setores com descricao padrao, contagem e badge", async () => {
    await openSectors();
    expect(screen.getByText("Sem descrição")).toBeInTheDocument();
    expect(screen.getByText("2 permissões padrão")).toBeInTheDocument();
    expect(screen.getByText("Setor velho")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Desativar" })).toHaveLength(1);
  });

  it("valida o nome, cria o setor e o coloca no topo", async () => {
    api.createSector.mockResolvedValue({ sector: { id: "s3", name: "RH", description: "", active: true, permissions: ["p2"] } });
    const { user } = await openSectors();
    await user.click(screen.getByRole("button", { name: "Criar setor" }));
    expect(notify).toHaveBeenCalledWith("Informe o nome do setor.", "danger");

    await user.type(screen.getByLabelText("Nome do setor"), " RH ");
    await user.type(screen.getByLabelText("Descrição"), " Pessoas ");
    await user.click(screen.getByLabelText("Setor ativo"));
    await user.click(screen.getByLabelText("Permissão 2"));
    await user.click(screen.getByRole("button", { name: "Criar setor" }));
    await waitFor(() => expect(api.createSector).toHaveBeenCalled());
    expect(api.createSector).toHaveBeenCalledWith("tok", { name: "RH", description: "Pessoas", active: false, permissions: ["p2"] });
    expect(notify).toHaveBeenCalledWith("Setor criado.", "ok");
    expect(document.querySelector(".admin-record-list article strong").textContent).toBe("RH");
  });

  it("edita setor e atualiza; Limpar volta ao novo", async () => {
    api.updateSector.mockResolvedValue({ sector: { ...sectorsFixture[0], name: "Fin" } });
    const { user } = await openSectors();
    const card = screen.getByText("Financeiro", { selector: "article strong" }).closest("article");
    await user.click(within(card).getByRole("button", { name: "Editar" }));
    expect(screen.getByText("Editar setor")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Nome do setor"));
    await user.type(screen.getByLabelText("Nome do setor"), "Fin");
    await user.click(screen.getByRole("button", { name: "Salvar setor" }));
    await waitFor(() => expect(api.updateSector).toHaveBeenCalledWith("tok", "s1", expect.objectContaining({ name: "Fin" })));
    expect(notify).toHaveBeenCalledWith("Setor atualizado.", "ok");
    expect(await screen.findByText("Fin", { selector: "article strong" })).toBeInTheDocument();

    const again = screen.getByText("Fin", { selector: "article strong" }).closest("article");
    await user.click(within(again).getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByText("Novo setor")).toBeInTheDocument();
  });

  it("erro ao salvar setor notifica", async () => {
    api.createSector.mockRejectedValue(new Error("Duplicado"));
    const { user } = await openSectors();
    await user.type(screen.getByLabelText("Nome do setor"), "X");
    await user.click(screen.getByRole("button", { name: "Criar setor" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Duplicado", "danger"));
  });

  it("desativa setor apos confirmar; cancelar nao chama a API; erro notifica", async () => {
    api.deleteSector.mockResolvedValueOnce({ sector: { ...sectorsFixture[0], active: false } }).mockRejectedValueOnce(new Error("Em uso"));
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    const { user } = await openSectors();
    await user.click(screen.getByRole("button", { name: "Desativar" }));
    expect(api.deleteSector).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(api.deleteSector).toHaveBeenCalledWith("tok", "s1"));
    expect(confirm).toHaveBeenCalledWith("Deseja desativar este setor? Os usuários continuam existindo.");
    expect(notify).toHaveBeenCalledWith("Setor desativado.", "ok");
    expect(screen.queryByRole("button", { name: "Desativar" })).not.toBeInTheDocument();
  });

  it("erro ao desativar setor", async () => {
    api.deleteSector.mockRejectedValue(new Error("Em uso"));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user } = await openSectors();
    await user.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Em uso", "danger"));
  });

  it("aba Permissoes mostra o catalogo do servidor, tudo marcado e desabilitado", async () => {
    const { user } = await openAdmin();
    await user.click(screen.getByRole("button", { name: "Permissões" }));
    expect(screen.getByText(/validadas no frontend/)).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    boxes.forEach((box) => {
      expect(box).toBeChecked();
      expect(box).toBeDisabled();
    });
  });

  it("aba Cloud e coletores renderiza o painel", async () => {
    const { user } = await openAdmin();
    await user.click(screen.getByRole("button", { name: "Cloud e coletores" }));
    expect(await screen.findByText("Integrações opcionais")).toBeInTheDocument();
    expect(api.fetchProductKeys).toHaveBeenCalledWith("tok");
  });

  it("se deixar de ser admin volta para Usabilidade", async () => {
    const { user, rerender } = mount();
    await user.click(screen.getByRole("button", { name: "Admin" }));
    await screen.findByText("Admin Root");
    rerender({ user: operator });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Usabilidade" })).toBeInTheDocument());
  });
});
