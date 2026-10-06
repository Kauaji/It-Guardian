import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AutomationManagementView from "./AutomationManagementView.jsx";

const devices = [
  { id: "d1", name: "PC-01", segmentId: "s1" },
  { id: "d2", name: "PC-02", segmentId: "s1" }
];
const segments = [{ id: "s1", name: "Recepção", groupId: "g1" }];
const segmentGroups = [{ id: "g1", name: "Matriz", tabId: "t1" }];
const inventoryTabs = [{ id: "t1", name: "Ambiente 1" }];
const scripts = [{ id: "sc1", name: "Limpar temporários", category: "Limpeza" }];

const planActive = {
  id: "p1",
  name: "Limpeza mensal",
  description: "Rotina de limpeza",
  active: true,
  recurrenceType: "monthly",
  preferredTime: "08:00",
  timezone: "America/Sao_Paulo",
  indicatorColor: "#2563eb",
  defaultScriptIds: ["sc1"],
  assetCount: 2,
  scriptCount: 1,
  assetSchedules: []
};
const planPaused = { ...planActive, id: "p2", name: "Auditoria", active: false, indicatorColor: "#dc2626", assetCount: 1 };

const management = {
  plans: [planActive, planPaused],
  machines: [
    {
      assetId: "d1",
      assetName: "PC-01",
      assetType: "Desktop",
      plans: [
        {
          id: "p1",
          automationPlanId: "p1",
          planName: "Limpeza mensal",
          active: true,
          nextRunAt: "2026-07-01T12:00:00.000Z",
          indicatorColor: "#2563eb",
          assetCount: 2
        }
      ]
    },
    {
      assetId: "d2",
      assetName: "PC-02",
      assetType: "Notebook",
      plans: [{ id: "p2", automationPlanId: "p2", planName: "Auditoria", active: false, indicatorColor: "#dc2626", assetCount: 1 }]
    }
  ],
  metadata: { planCount: 2, machineCount: 2 }
};

const permissions = { update: true, disable: true, delete: true, removeAsset: true, manageOverride: true };

function setup(props = {}) {
  const handlers = {
    onRetry: vi.fn(),
    onSavePlan: vi.fn().mockResolvedValue(undefined),
    onPausePlan: vi.fn().mockResolvedValue(undefined),
    onReactivatePlan: vi.fn().mockResolvedValue(undefined),
    onDeletePlan: vi.fn().mockResolvedValue(undefined),
    onSaveOverride: vi.fn().mockResolvedValue(undefined),
    onRemoveOverride: vi.fn().mockResolvedValue(undefined),
    onRemoveAsset: vi.fn().mockResolvedValue(undefined),
    onFetchAssetDetails: vi.fn().mockResolvedValue({ plan: planActive, history: [] }),
    onFetchAgenda: vi.fn().mockResolvedValue({ items: [], summary: {} }),
    onFetchPlanHistory: vi.fn().mockResolvedValue({ items: [] })
  };
  const merged = {
    management,
    devices,
    segments,
    segmentGroups,
    inventoryTabs,
    scripts,
    loading: false,
    error: "",
    permissions,
    ...handlers,
    ...props
  };
  const view = render(<AutomationManagementView {...merged} />);
  return { ...handlers, ...view, props: merged, user: userEvent.setup() };
}

describe("AutomationManagementView - máquinas", () => {
  it("lista máquinas com automação agrupadas por segmento (padrão: somente ativas)", () => {
    setup();

    expect(screen.getByRole("heading", { name: "Automatizações" })).toBeInTheDocument();
    expect(screen.getByText("Matriz • Recepção", { selector: "header strong" })).toBeInTheDocument();
    expect(screen.getByText("1 máquina(s) com automação neste segmento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerenciar automações de PC-01" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerenciar automações de PC-02" })).toBeNull();
  });

  it("filtra por status e por busca textual", async () => {
    const { user } = setup();

    fireEvent.change(screen.getByLabelText("Filtrar automatizações por status"), { target: { value: "inactive" } });
    expect(screen.getByRole("button", { name: "Gerenciar automações de PC-02" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerenciar automações de PC-01" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Filtrar automatizações por status"), { target: { value: "all" } });
    await user.type(screen.getByPlaceholderText("Buscar máquina, grupo, segmento, ambiente ou plano"), "notebook xyz");
    expect(screen.getByText("Nenhuma máquina com automatização encontrada para os filtros atuais.")).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText("Buscar máquina, grupo, segmento, ambiente ou plano"));
    await user.type(screen.getByPlaceholderText("Buscar máquina, grupo, segmento, ambiente ou plano"), "auditoria");
    expect(screen.getByRole("button", { name: "Gerenciar automações de PC-02" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerenciar automações de PC-01" })).toBeNull();
  });

  it("mostra o carregamento, o erro e permite tentar novamente", async () => {
    const view = setup({ loading: true });
    expect(screen.getByLabelText("Carregando automatizações")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerenciar automações de PC-01" })).toBeNull();

    view.rerender(<AutomationManagementView {...view.props} loading={false} error="Falha ao carregar" />);
    expect(screen.getByText("Falha ao carregar")).toBeInTheDocument();
    await view.user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(view.onRetry).toHaveBeenCalledTimes(1);
    await view.user.click(screen.getByRole("button", { name: "Atualizar automatizações" }));
    expect(view.onRetry).toHaveBeenCalledTimes(2);
  });

  it("abre os detalhes da máquina e carrega a agenda dela", async () => {
    const { user, onFetchAssetDetails } = setup();

    await user.click(screen.getByRole("button", { name: "Gerenciar automações de PC-01" }));

    const dialog = await screen.findByRole("dialog", { name: "PC-01" });
    await waitFor(() => expect(onFetchAssetDetails).toHaveBeenCalledWith("p1", "d1"));
    expect(within(dialog).getByText("Configuração desta máquina")).toBeInTheDocument();
  });

  it("fecha os detalhes da máquina ao remover a última associação", async () => {
    const { user, onRemoveAsset } = setup({
      management: {
        ...management,
        machines: [{ ...management.machines[0], plans: [{ ...management.machines[0].plans[0], assetCount: 1 }] }]
      }
    });

    await user.click(screen.getByRole("button", { name: "Gerenciar automações de PC-01" }));
    const dialog = await screen.findByRole("dialog", { name: "PC-01" });
    await user.click(within(dialog).getByRole("button", { name: "Remover plano da máquina" }));
    await user.click(within(dialog).getByRole("button", { name: "Manter plano inativo" }));

    await waitFor(() => expect(onRemoveAsset).toHaveBeenCalledWith("p1", "d1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("exclui o plano a partir dos detalhes da máquina e fecha o diálogo", async () => {
    const { user, onDeletePlan } = setup({
      management: {
        ...management,
        machines: [{ ...management.machines[0], plans: [{ ...management.machines[0].plans[0], assetCount: 1 }] }]
      }
    });

    await user.click(screen.getByRole("button", { name: "Gerenciar automações de PC-01" }));
    const dialog = await screen.findByRole("dialog", { name: "PC-01" });
    await user.click(within(dialog).getByRole("button", { name: "Remover plano da máquina" }));
    await user.click(within(dialog).getByRole("button", { name: "Excluir plano" }));

    await waitFor(() => expect(onDeletePlan).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("salva e remove a recorrência personalizada repassando ids e payload", async () => {
    const { user, onSaveOverride } = setup();

    await user.click(screen.getByRole("button", { name: "Gerenciar automações de PC-01" }));
    const dialog = await screen.findByRole("dialog", { name: "PC-01" });
    await user.click(within(dialog).getByRole("button", { name: /Definir recorrência personalizada/ }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar recorrência" }));

    await waitFor(() => expect(onSaveOverride).toHaveBeenCalledWith("p1", "d1", expect.objectContaining({ recurrenceType: "monthly" })));
  });

  it("abre os detalhes do plano a partir da máquina e fecha os detalhes da máquina", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Gerenciar automações de PC-01" }));
    const dialog = await screen.findByRole("dialog", { name: "PC-01" });
    await user.click(within(dialog).getByRole("button", { name: /Ver detalhes do plano/ }));

    expect(await screen.findByRole("dialog", { name: "Limpeza mensal" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "PC-01" })).toBeNull();
  });

  it("abre o plano pelo indicador de cor da máquina", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /^Limpeza mensal\./ }));

    expect(await screen.findByRole("dialog", { name: "Limpeza mensal" })).toBeInTheDocument();
  });
});

describe("AutomationManagementView - planos e agenda", () => {
  it("navega para a aba de planos e filtra", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("tab", { name: "Planos" }));

    expect(screen.queryByPlaceholderText("Buscar máquina, grupo, segmento, ambiente ou plano")).toBeNull();
    expect(screen.getByText("2 plano(s)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filtrar planos"), { target: { value: "paused" } });
    expect(screen.getByText("1 plano(s)")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Buscar plano"), "zzz");
    expect(screen.getByText("Nenhum plano encontrado para os filtros atuais.")).toBeInTheDocument();
  });

  it("abre um plano pelo botão Gerenciar e pausa com o indicador de gravação", async () => {
    const { user, onPausePlan } = setup();

    await user.click(screen.getByRole("tab", { name: "Planos" }));
    const card = screen.getByText("Limpeza mensal", { selector: "strong" }).closest("article");
    await user.click(within(card).getByRole("button", { name: /Gerenciar/ }));
    const dialog = await screen.findByRole("dialog", { name: "Limpeza mensal" });
    await user.click(within(dialog).getByRole("button", { name: "Pausar automação" }));
    await user.click(within(dialog).getByRole("button", { name: "Pausar automação" }));

    await waitFor(() => expect(onPausePlan).toHaveBeenCalledWith("p1"));
  });

  it("reativa um plano pausado pelos detalhes", async () => {
    const { user, onReactivatePlan } = setup();

    await user.click(screen.getByRole("tab", { name: "Planos" }));
    const card = screen.getByText("Auditoria", { selector: "strong" }).closest("article");
    await user.click(within(card).getByRole("button", { name: /Gerenciar/ }));
    const dialog = await screen.findByRole("dialog", { name: "Auditoria" });
    await user.click(within(dialog).getByRole("button", { name: "Reativar automação" }));
    await user.click(within(dialog).getByRole("button", { name: "Reativar automação" }));

    await waitFor(() => expect(onReactivatePlan).toHaveBeenCalledWith("p2"));
  });

  it("exclui um plano e fecha os detalhes", async () => {
    const { user, onDeletePlan } = setup();

    await user.click(screen.getByRole("tab", { name: "Planos" }));
    const card = screen.getByText("Limpeza mensal", { selector: "strong" }).closest("article");
    await user.click(within(card).getByRole("button", { name: /Gerenciar/ }));
    const dialog = await screen.findByRole("dialog", { name: "Limpeza mensal" });
    await user.click(within(dialog).getByRole("button", { name: "Excluir plano" }));
    await user.type(within(dialog).getByLabelText("Digite o nome do plano para confirmar"), "Limpeza mensal");
    await user.click(within(dialog).getAllByRole("button", { name: "Excluir plano" }).at(-1));

    await waitFor(() => expect(onDeletePlan).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("salva a edição do plano repassando id e rascunho", async () => {
    const { user, onSavePlan } = setup();

    await user.click(screen.getByRole("tab", { name: "Planos" }));
    const card = screen.getByText("Limpeza mensal", { selector: "strong" }).closest("article");
    await user.click(within(card).getByRole("button", { name: /Gerenciar/ }));
    const dialog = await screen.findByRole("dialog", { name: "Limpeza mensal" });
    await user.click(within(dialog).getByRole("button", { name: /Editar/ }));
    await user.click(within(dialog).getByRole("button", { name: /Salvar alterações/ }));

    await waitFor(() => expect(onSavePlan).toHaveBeenCalledWith("p1", expect.objectContaining({ name: "Limpeza mensal" })));
  });

  it("carrega a agenda com o filtro de status", async () => {
    const { user, onFetchAgenda } = setup();

    await user.click(screen.getByRole("tab", { name: "Agenda" }));

    await waitFor(() => expect(onFetchAgenda).toHaveBeenCalledWith({ status: "all", limit: 300 }));
    expect(await screen.findByText("Nenhum compromisso encontrado na agenda.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar agenda"), { target: { value: "overdue" } });
    await waitFor(() => expect(onFetchAgenda).toHaveBeenLastCalledWith({ status: "overdue", limit: 300 }));
  });

  it("sincroniza o plano aberto quando a gestão é atualizada", async () => {
    const { user, rerender, props } = setup();

    await user.click(screen.getByRole("tab", { name: "Planos" }));
    const card = screen.getByText("Limpeza mensal", { selector: "strong" }).closest("article");
    await user.click(within(card).getByRole("button", { name: /Gerenciar/ }));
    await screen.findByRole("dialog", { name: "Limpeza mensal" });

    rerender(
      <AutomationManagementView
        {...props}
        management={{ ...management, plans: [{ ...planActive, name: "Limpeza renomeada" }, planPaused] }}
      />
    );

    expect(await screen.findByRole("dialog", { name: "Limpeza renomeada" })).toBeInTheDocument();
  });

  it("fecha os detalhes da máquina quando ela some da gestão", async () => {
    const { user, rerender, props } = setup();

    await user.click(screen.getByRole("button", { name: "Gerenciar automações de PC-01" }));
    await screen.findByRole("dialog", { name: "PC-01" });

    rerender(<AutomationManagementView {...props} management={{ ...management, machines: [management.machines[1]] }} />);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
