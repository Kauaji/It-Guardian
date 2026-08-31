import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import NetworkTopologyToolbar from "./NetworkTopologyToolbar.jsx";

function renderToolbar(overrides = {}) {
  const props = {
    editMode: true,
    canManage: true,
    canLink: true,
    linkItemLabel: "ativos",
    nodeCount: 2,
    linkCount: 1,
    onToggleEditMode: vi.fn(),
    onCenterView: vi.fn(),
    onSaveLayout: vi.fn(),
    hasDirtyPositions: true,
    saving: false,
    onResetLayout: vi.fn(),
    onGenerateAutoLayout: vi.fn(),
    generatingLayout: false,
    linkDraftActive: false,
    onToggleLinkDraft: vi.fn(),
    availableDevicesToAdd: [{ id: "financeiro", name: "Servidor Financeiro", ip: "203.0.113.21", status: "online", type: "server" }],
    availableClustersToAdd: [{ id: "infra", name: "Infraestrutura", nodeType: "group", segmentCount: 1, deviceCount: 2, status: "online" }],
    onAddAsset: vi.fn(),
    onAddCluster: vi.fn(),
    addingAsset: false,
    filters: { search: "", status: "", segmentId: "", assetType: "" },
    onFiltersChange: vi.fn(),
    segments: [{ id: "servers", name: "Servidores" }],
    assetTypeOptions: [{ value: "server", label: "Servidor" }],
    ...overrides
  };
  return { props, ...render(<NetworkTopologyToolbar {...props} />) };
}

describe("NetworkTopologyToolbar", () => {
  it("mantém centralizar e não oferece ajustar à tela", () => {
    const { props } = renderToolbar();
    expect(screen.queryByTitle("Ajustar à tela")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Centralizar"));
    expect(props.onCenterView).toHaveBeenCalledOnce();
  });

  it.each([
    ["grupos", true],
    ["segmentos", true],
    ["ativos", false]
  ])("mantém Conectar %s visível fora do modo de edição", (linkItemLabel, isClusterLevel) => {
    const { props } = renderToolbar({ editMode: false, linkItemLabel, isClusterLevel });
    const action = screen.getByRole("button", { name: `Conectar ${linkItemLabel}` });
    expect(action).toBeVisible();
    fireEvent.click(action);
    expect(props.onToggleLinkDraft).toHaveBeenCalledOnce();
  });

  it("explica uma aba mista e bloqueia a ação sem dois itens compatíveis", () => {
    const { props } = renderToolbar({
      editMode: false,
      nodeCount: 2,
      canStartLink: false,
      linkItemLabel: "itens do mesmo tipo",
      isClusterLevel: true
    });
    const action = screen.getByRole("button", { name: "Conectar itens do mesmo tipo" });
    expect(action).toBeDisabled();
    fireEvent.click(action);
    expect(props.onToggleLinkDraft).not.toHaveBeenCalled();
  });

  it.each([false, true])("não mostra inserção manual por padrão, mesmo editando (clusters: %s)", (isClusterLevel) => {
    renderToolbar({ isClusterLevel });
    expect(screen.queryByPlaceholderText("Adicionar ativo ao mapa...")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Adicionar grupo ou segmento ao mapa...")).not.toBeInTheDocument();
  });

  it("libera inserção de ativo somente com opt-in no modo autorizado", () => {
    const { props } = renderToolbar({ showManualAdd: true });
    const picker = screen.getByPlaceholderText("Adicionar ativo ao mapa...");
    fireEvent.focus(picker);
    fireEvent.click(screen.getByRole("option", { name: /Servidor Financeiro/ }));
    expect(props.onAddAsset).toHaveBeenCalledWith("financeiro");
    expect(props.onAddCluster).not.toHaveBeenCalled();
  });

  it("preserva o picker de grupos e segmentos para usos manuais explícitos", () => {
    const { props } = renderToolbar({ showManualAdd: true, isClusterLevel: true });
    const picker = screen.getByPlaceholderText("Adicionar grupo ou segmento ao mapa...");
    fireEvent.focus(picker);
    fireEvent.click(screen.getByRole("option", { name: /Infraestrutura/ }));
    expect(props.onAddCluster).toHaveBeenCalledWith("group", "infra");
    expect(props.onAddAsset).not.toHaveBeenCalled();
  });

  it.each([
    { editMode: false, canManage: true },
    { editMode: true, canManage: false },
    { editMode: false, canManage: false }
  ])("não usa showManualAdd para contornar edição/permissão: %j", (permissionProps) => {
    renderToolbar({ showManualAdd: true, ...permissionProps });
    expect(screen.queryByPlaceholderText("Adicionar ativo ao mapa...")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Adicionar grupo ou segmento ao mapa...")).not.toBeInTheDocument();
  });

  it("mantém layout e conexões sem depender dos pickers", () => {
    const { props } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Salvar layout" }));
    fireEvent.click(screen.getByRole("button", { name: "Resetar" }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar automático" }));
    fireEvent.click(screen.getByRole("button", { name: "Conectar ativos" }));
    expect(props.onSaveLayout).toHaveBeenCalledOnce();
    expect(props.onResetLayout).toHaveBeenCalledOnce();
    expect(props.onGenerateAutoLayout).toHaveBeenCalledOnce();
    expect(props.onToggleLinkDraft).toHaveBeenCalledOnce();
    expect(screen.getByText("2 ativo(s)")).toBeInTheDocument();
    expect(screen.getByText("1 conexão(ões)")).toBeInTheDocument();
  });

  it("permissão de conectar não concede controles de layout ou inserção", () => {
    renderToolbar({ canManage: false, showManualAdd: true });
    expect(screen.getByRole("button", { name: "Conectar ativos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar layout" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerar automático" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Adicionar ativo ao mapa...")).not.toBeInTheDocument();
  });

  it("mantém filtros de ativos independentes da inserção manual", () => {
    const { props } = renderToolbar();
    fireEvent.change(screen.getByPlaceholderText("Buscar por nome ou IP"), { target: { value: "financeiro" } });
    expect(props.onFiltersChange).toHaveBeenCalledWith({ ...props.filters, search: "financeiro" });
    fireEvent.change(screen.getByDisplayValue("Todos os status"), { target: { value: "offline" } });
    expect(props.onFiltersChange).toHaveBeenCalledWith({ ...props.filters, status: "offline" });
  });

  it("mantém controles de edição bloqueados em somente leitura", () => {
    renderToolbar({ editMode: false, canManage: false, canLink: false, showManualAdd: true });
    expect(screen.getByRole("button", { name: "Visualizando" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Conectar ativos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar layout" })).not.toBeInTheDocument();
  });

  it.each([
    ["salvamento", { saving: true }],
    ["geração", { generatingLayout: true }]
  ])("bloqueia operações concorrentes durante %s e mantém centralizar ativo", (_label, busyProps) => {
    const { props } = renderToolbar({ showManualAdd: true, ...busyProps });
    const controls = [
      screen.getByRole("button", { name: "Editando" }),
      screen.getByRole("button", { name: busyProps.saving ? "Salvando..." : "Salvar layout" }),
      screen.getByRole("button", { name: "Resetar" }),
      screen.getByRole("button", { name: busyProps.generatingLayout ? "Gerando..." : "Gerar automático" }),
      screen.getByRole("button", { name: "Conectar ativos" })
    ];
    for (const control of controls) {
      expect(control).toBeDisabled();
      fireEvent.click(control);
    }
    expect(screen.getByPlaceholderText("Adicionar ativo ao mapa...")).toBeDisabled();
    expect(props.onToggleEditMode).not.toHaveBeenCalled();
    expect(props.onSaveLayout).not.toHaveBeenCalled();
    expect(props.onResetLayout).not.toHaveBeenCalled();
    expect(props.onGenerateAutoLayout).not.toHaveBeenCalled();
    expect(props.onToggleLinkDraft).not.toHaveBeenCalled();
    const center = screen.getByTitle("Centralizar");
    expect(center).toBeEnabled();
    fireEvent.click(center);
    expect(props.onCenterView).toHaveBeenCalledOnce();
  });

  it.each([false, true])("bloqueia também opções de um picker já aberto durante geração (clusters: %s)", async (isClusterLevel) => {
    const user = userEvent.setup();
    const { props, rerender } = renderToolbar({ showManualAdd: true, isClusterLevel });
    const input = screen.getByPlaceholderText(isClusterLevel ? "Adicionar grupo ou segmento ao mapa..." : "Adicionar ativo ao mapa...");
    fireEvent.focus(input);
    const option = screen.getByRole("option", { name: isClusterLevel ? /Infraestrutura/ : /Servidor Financeiro/ });
    rerender(<NetworkTopologyToolbar {...props} generatingLayout />);
    expect(input).toBeDisabled();
    expect(option).toBeDisabled();
    await user.click(option);
    expect(props.onAddAsset).not.toHaveBeenCalled();
    expect(props.onAddCluster).not.toHaveBeenCalled();
    rerender(<NetworkTopologyToolbar {...props} />);
    expect(input).toBeEnabled();
    expect(option).toBeEnabled();
    await user.click(option);
    if (isClusterLevel) expect(props.onAddCluster).toHaveBeenCalledWith("group", "infra");
    else expect(props.onAddAsset).toHaveBeenCalledWith("financeiro");
  });

  it("mantém a geração bloqueada quando não há itens no mapa", () => {
    renderToolbar({ nodeCount: 0 });
    expect(screen.getByRole("button", { name: "Gerar automático" })).toBeDisabled();
  });
});
