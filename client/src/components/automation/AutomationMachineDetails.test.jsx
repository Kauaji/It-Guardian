import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AutomationMachineDetails from "./AutomationMachineDetails.jsx";

const planA = {
  id: "pa",
  planName: "Limpeza mensal",
  active: true,
  indicatorColor: "#2563eb",
  recurrenceType: "monthly",
  preferredTime: "08:00",
  timezone: "America/Sao_Paulo",
  nextRunAt: "2026-07-01T12:00:00.000Z",
  scriptCount: 1,
  assetCount: 3,
  scripts: [{ id: "sc1", name: "Limpar temporários" }]
};
const planB = { id: "pb", planName: "Auditoria", active: false, indicatorColor: "#dc2626", recurrenceType: "weekly", assetCount: 1, scriptCount: 0, scripts: [] };
const machine = { assetId: "d1", assetName: "PC-01", plans: [planA, planB] };

function detailResponse(overrides = {}) {
  return {
    plan: planA,
    schedule: { recurrenceType: "weekly", recurrenceSource: "machine", preferredTime: "10:00", timezone: "UTC", nextRunAt: "2026-07-08T12:00:00.000Z", lastPreparedAt: "2026-06-01T12:00:00.000Z", latestRun: { status: "success" } },
    override: { active: true, recurrenceType: "weekly", preferredTime: "10:00" },
    history: [{ id: "h1", message: "Recorrência alterada", userName: "Ana", createdAt: "2026-06-02T12:00:00.000Z" }],
    ...overrides
  };
}

function setup(props = {}) {
  const handlers = {
    onClose: vi.fn(),
    onOpenPlan: vi.fn(),
    onSaveOverride: vi.fn().mockResolvedValue(undefined),
    onRemoveOverride: vi.fn().mockResolvedValue(undefined),
    onRemoveAsset: vi.fn(),
    onDeletePlan: vi.fn(),
    onLoadDetails: vi.fn().mockResolvedValue(detailResponse())
  };
  const merged = { machine, open: true, canManageOverride: true, canRemoveAsset: true, canDeletePlan: true, saving: false, ...handlers, ...props };
  const view = render(<AutomationMachineDetails {...merged} />);
  return { ...handlers, ...view, props: merged, user: userEvent.setup() };
}

describe("AutomationMachineDetails - visão geral", () => {
  it("não renderiza fechado ou sem máquina/plano", () => {
    const { container, rerender, props } = setup({ open: false });
    expect(container).toBeEmptyDOMElement();

    rerender(<AutomationMachineDetails {...props} open machine={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AutomationMachineDetails {...props} open machine={{ ...machine, plans: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("carrega os detalhes do primeiro plano e mostra recorrência efetiva e histórico", async () => {
    const { onLoadDetails } = setup();

    expect(screen.getByText("Carregando detalhes da agenda...")).toBeInTheDocument();
    expect(await screen.findByText("Recorrência alterada")).toBeInTheDocument();
    expect(onLoadDetails).toHaveBeenCalledWith("pa", "d1");
    expect(screen.queryByText("Carregando detalhes da agenda...")).toBeNull();

    const dialog = screen.getByRole("dialog", { name: "PC-01" });
    expect(within(dialog).getByText("Agenda ativa")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Personalizada para esta máquina")).toHaveLength(2);
    expect(within(dialog).getByText("10:00")).toBeInTheDocument();
    expect(within(dialog).getByText("UTC")).toBeInTheDocument();
    expect(within(dialog).getByText("success")).toBeInTheDocument();
    expect(within(dialog).getByText("Limpar temporários")).toBeInTheDocument();
    expect(within(dialog).getByText(/08\/07/)).toBeInTheDocument();
  });

  it("usa os dados do plano como contingência enquanto não há detalhes", () => {
    setup({ onLoadDetails: undefined });

    expect(screen.queryByText("Carregando detalhes da agenda...")).toBeNull();
    expect(screen.getByText("Herdada do plano", { selector: "span.pill" })).toBeInTheDocument();
    expect(screen.getByText("Sem execução registrada")).toBeInTheDocument();
  });

  it("exibe o erro de carregamento", async () => {
    setup({ onLoadDetails: vi.fn().mockRejectedValue(new Error("Falha na API")) });

    expect(await screen.findByText("Falha na API")).toBeInTheDocument();
  });

  it("troca de plano e recarrega os detalhes", async () => {
    const { user, onLoadDetails } = setup();

    await screen.findByText("Recorrência alterada");
    fireEvent.change(screen.getByLabelText("Plano que deseja gerenciar"), { target: { value: "pb" } });

    await waitFor(() => expect(onLoadDetails).toHaveBeenCalledWith("pb", "d1"));
    expect(screen.getByText("Agenda inativa")).toBeInTheDocument();
    expect(screen.getByText("Nenhum script identificado.")).toBeInTheDocument();
    expect(user).toBeDefined();
  });

  it("só oferece a troca quando existe mais de um plano", () => {
    setup({ machine: { ...machine, plans: [planA] } });

    expect(screen.queryByLabelText("Plano que deseja gerenciar")).toBeNull();
  });

  it("abre os detalhes do plano e fecha o diálogo", async () => {
    const { user, onOpenPlan, onClose } = setup();

    await user.click(screen.getByRole("button", { name: /Ver detalhes do plano/ }));
    expect(onOpenPlan).toHaveBeenCalledWith(planA, machine);

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    await user.click(screen.getByRole("button", { name: "Fechar ações da máquina" }));
    fireEvent.mouseDown(document.querySelector(".automation-management-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("respeita as permissões de recorrência e remoção", () => {
    setup({ canManageOverride: false, canRemoveAsset: false });

    expect(screen.queryByRole("button", { name: /Definir recorrência personalizada/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remover plano da máquina" })).toBeNull();
  });
});

describe("AutomationMachineDetails - recorrência personalizada", () => {
  async function startOverride(options) {
    const rendered = setup(options);
    await screen.findByText("Recorrência alterada");
    await rendered.user.click(screen.getByRole("button", { name: /Definir recorrência personalizada/ }));
    return rendered;
  }

  it("valida e salva a recorrência desta máquina", async () => {
    const { user, onSaveOverride } = await startOverride();

    expect(screen.getByText("Esta recorrência substitui a configuração herdada apenas para PC-01.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Recorrência"), { target: { value: "custom_days" } });
    fireEvent.change(screen.getByLabelText("Dias"), { target: { value: "500" } });
    await user.click(screen.getByRole("button", { name: "Salvar recorrência" }));
    expect(screen.getByText("Informe um intervalo entre 1 e 365 dias.")).toBeInTheDocument();
    expect(onSaveOverride).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Dias/), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "22:30" } });
    await user.click(screen.getByRole("button", { name: "Salvar recorrência" }));

    await waitFor(() => expect(onSaveOverride).toHaveBeenCalledTimes(1));
    expect(onSaveOverride).toHaveBeenCalledWith("pa", "d1", {
      recurrenceType: "custom_days",
      recurrenceIntervalDays: 20,
      preferredTime: "22:30",
      active: true
    });
    await waitFor(() => expect(screen.queryByLabelText("Dias")).toBeNull());
  });

  it("atualiza o painel com a resposta do salvamento", async () => {
    const response = detailResponse({
      schedule: { recurrenceType: "daily", recurrenceSource: "machine", preferredTime: "05:00", timezone: "UTC" },
      history: [{ id: "h2", message: "Nova recorrência salva", userName: null, createdAt: "2026-06-03T12:00:00.000Z" }]
    });
    const { user } = await startOverride({ onSaveOverride: vi.fn().mockResolvedValue(response) });

    await user.click(screen.getByRole("button", { name: "Salvar recorrência" }));

    expect(await screen.findByText("Nova recorrência salva")).toBeInTheDocument();
    expect(screen.getByText("05:00")).toBeInTheDocument();
  });

  it("volta para a recorrência herdada", async () => {
    const { user, onRemoveOverride } = await startOverride();

    await user.click(screen.getByRole("button", { name: "Usar recorrência herdada" }));

    await waitFor(() => expect(onRemoveOverride).toHaveBeenCalledWith("pa", "d1"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Salvar recorrência" })).toBeNull());
  });

  it("pede confirmação ao cancelar com alterações pendentes", async () => {
    const { user } = await startOverride();

    fireEvent.change(screen.getByLabelText("Horário"), { target: { value: "23:00" } });
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Descartar alterações" }));

    expect(screen.queryByRole("button", { name: "Salvar recorrência" })).toBeNull();
    expect(screen.getByRole("button", { name: /Definir recorrência personalizada/ })).toBeInTheDocument();
  });

  it("oferece a recorrência herdada somente quando existe override ativo", async () => {
    await startOverride({ onLoadDetails: vi.fn().mockResolvedValue(detailResponse({ override: null })) });

    expect(screen.queryByRole("button", { name: "Usar recorrência herdada" })).toBeNull();
  });
});

describe("AutomationMachineDetails - remoção do plano", () => {
  it("remove a máquina do plano quando existem outras máquinas", async () => {
    const { user, onRemoveAsset } = setup();

    await user.click(screen.getByRole("button", { name: "Remover plano da máquina" }));
    expect(screen.getByText("As outras máquinas continuarão vinculadas ao plano.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir plano" })).toBeNull();
    await user.click(screen.getAllByRole("button", { name: "Remover plano da máquina" }).at(-1));

    expect(onRemoveAsset).toHaveBeenCalledWith("pa", "d1");
  });

  it("alerta quando é a última máquina e oferece excluir o plano", async () => {
    const { user, onRemoveAsset, onDeletePlan } = setup({ machine: { ...machine, plans: [{ ...planA, assetCount: 1 }] } });

    await user.click(screen.getByRole("button", { name: "Remover plano da máquina" }));
    expect(screen.getByText(/Esta é a última máquina ativa do plano/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Excluir plano" }));
    expect(onDeletePlan).toHaveBeenCalledWith(expect.objectContaining({ id: "pa" }));

    await user.click(screen.getByRole("button", { name: "Manter plano inativo" }));
    expect(onRemoveAsset).toHaveBeenCalledWith("pa", "d1");
  });

  it("não oferece exclusão sem permissão e permite cancelar", async () => {
    const { user } = setup({ machine: { ...machine, plans: [{ ...planA, assetCount: 1 }] }, canDeletePlan: false });

    await user.click(screen.getByRole("button", { name: "Remover plano da máquina" }));
    expect(screen.queryByRole("button", { name: "Excluir plano" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByRole("button", { name: /Ver detalhes do plano/ })).toBeInTheDocument();
  });
});
