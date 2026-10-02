import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AutomationPlanDetails from "./AutomationPlanDetails.jsx";

const scripts = [
  { id: "sc1", name: "Limpar temporários", category: "Limpeza", risk: "baixo" },
  { id: "sc2", name: "Verificar disco" }
];

const plan = {
  id: "p1",
  name: "Limpeza mensal",
  description: "Rotina de limpeza",
  notes: "Executar fora do expediente",
  active: true,
  recurrenceType: "monthly",
  preferredTime: "09:30",
  timezone: "America/Sao_Paulo",
  indicatorColor: "#2563eb",
  defaultScriptIds: ["sc1"],
  nextRunAt: "2026-07-01T12:00:00.000Z",
  lastPreparedAt: null,
  assetCount: 2,
  scriptCount: 1,
  overrideCount: 0,
  createdByName: "Ana",
  createdAt: "2026-05-01T12:00:00.000Z",
  preventivePlanName: "Plano base",
  assetSchedules: [
    { assetId: "d1", assetName: "PC-01", recurrenceType: "monthly", nextRunAt: "2026-07-01T12:00:00.000Z", active: true, recurrenceSource: "plan" },
    { assetId: "d2", assetName: "PC-02", recurrenceType: "weekly", nextRunAt: null, active: false, recurrenceSource: "override" }
  ]
};

function setup(props = {}) {
  const handlers = {
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onPausePlan: vi.fn().mockResolvedValue(undefined),
    onReactivatePlan: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn(),
    onLoadHistory: vi.fn().mockResolvedValue({ items: [{ id: "h1", message: "Plano criado", userName: "Ana", createdAt: "2026-05-01T12:00:00.000Z" }] })
  };
  const merged = { plan, scripts, open: true, canEdit: true, canDisable: true, canDelete: true, saving: false, ...handlers, ...props };
  const view = render(<AutomationPlanDetails {...merged} />);
  return { ...handlers, ...view, props: merged, user: userEvent.setup() };
}

function dialog() {
  return screen.getByRole("dialog", { name: "Limpeza mensal" });
}

describe("AutomationPlanDetails - visão geral", () => {
  it("não renderiza fechado ou sem plano", () => {
    const { container, rerender, props } = setup({ open: false });
    expect(container).toBeEmptyDOMElement();

    rerender(<AutomationPlanDetails {...props} open plan={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("resume o plano, os scripts vinculados e as observações", () => {
    setup();

    expect(within(dialog()).getByText("Configuração geral do plano")).toBeInTheDocument();
    expect(within(dialog()).getByText("Ativo")).toBeInTheDocument();
    expect(within(dialog()).getByText("Mensal")).toBeInTheDocument();
    expect(within(dialog()).getByText("09:30 • America/Sao_Paulo")).toBeInTheDocument();
    expect(within(dialog()).getByText("Ainda não preparada")).toBeInTheDocument();
    expect(within(dialog()).getByText("Ana")).toBeInTheDocument();
    expect(within(dialog()).getByText("Plano base")).toBeInTheDocument();
    expect(within(dialog()).getByText("#2563eb")).toBeInTheDocument();
    expect(within(dialog()).getByText("Rotina de limpeza")).toBeInTheDocument();
    expect(within(dialog()).getByText("Executar fora do expediente")).toBeInTheDocument();
    const linked = dialog().querySelector(".automation-plan-linked-scripts");
    expect(within(linked).getByText("Limpar temporários")).toBeInTheDocument();
    expect(within(linked).queryByText("Verificar disco")).toBeNull();
  });

  it("mostra ações conforme as permissões", () => {
    setup({ canEdit: false, canDisable: false, canDelete: false });

    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pausar automação" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir plano" })).toBeNull();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
  });

  it("fecha pelo botão, pelo X e pelo fundo", async () => {
    const { user, onClose } = setup();

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    await user.click(screen.getByRole("button", { name: "Fechar detalhes do plano" }));
    fireEvent.mouseDown(document.querySelector(".automation-management-backdrop"));
    fireEvent.mouseDown(dialog());

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("AutomationPlanDetails - abas", () => {
  it("alterna entre agenda, máquinas, scripts e histórico", async () => {
    const { user, onLoadHistory } = setup();
    const tabs = screen.getByRole("tablist", { name: "Detalhes do plano" });

    await user.click(within(tabs).getByRole("tab", { name: "Agenda" }));
    expect(screen.getByRole("heading", { name: "Agenda por máquina" })).toBeInTheDocument();
    expect(screen.getByText("Sem próxima agenda")).toBeInTheDocument();
    expect(screen.getByText("Mensal")).toBeInTheDocument();

    await user.click(within(tabs).getByRole("tab", { name: "Máquinas" }));
    expect(screen.getByRole("heading", { name: "Máquinas vinculadas" })).toBeInTheDocument();
    expect(screen.getByText("Pausada")).toBeInTheDocument();
    expect(screen.getByText("Recorrência personalizada")).toBeInTheDocument();
    expect(screen.getByText("Recorrência herdada")).toBeInTheDocument();

    await user.click(within(tabs).getByRole("tab", { name: "Scripts" }));
    expect(screen.getByRole("heading", { name: "Scripts vinculados" })).toBeInTheDocument();
    expect(screen.getByText("baixo")).toBeInTheDocument();

    await user.click(within(tabs).getByRole("tab", { name: "Histórico" }));
    expect(await screen.findByText("Plano criado")).toBeInTheDocument();
    expect(onLoadHistory).toHaveBeenCalledWith("p1");

    await user.click(within(tabs).getByRole("tab", { name: "Resumo" }));
    await user.click(within(tabs).getByRole("tab", { name: "Histórico" }));
    expect(onLoadHistory).toHaveBeenCalledTimes(1);
  });

  it("mostra o carregamento e a mensagem de histórico vazio", async () => {
    let resolveHistory;
    const onLoadHistory = vi.fn().mockReturnValue(new Promise((resolve) => { resolveHistory = resolve; }));
    const { user } = setup({ onLoadHistory });

    await user.click(screen.getByRole("tab", { name: "Histórico" }));

    expect(screen.getByText("Carregando histórico...")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum evento registrado.")).toBeNull();
    resolveHistory({ items: [] });
    expect(await screen.findByText("Nenhum evento registrado.")).toBeInTheDocument();
    expect(screen.queryByText("Carregando histórico...")).toBeNull();
  });

  it("indica quando não há agenda ou scripts vinculados", async () => {
    const { user } = setup({ plan: { ...plan, assetSchedules: [], defaultScriptIds: [] } });

    await user.click(screen.getByRole("tab", { name: "Agenda" }));
    expect(screen.getByText("Nenhuma agenda vinculada.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Scripts" }));
    expect(screen.getByText("Nenhum script vinculado.")).toBeInTheDocument();
  });

  it("volta ao resumo ao trocar de plano", async () => {
    const { user, rerender, props } = setup();

    await user.click(screen.getByRole("tab", { name: "Agenda" }));
    rerender(<AutomationPlanDetails {...props} plan={{ ...plan, id: "p2", name: "Outro plano" }} />);

    expect(screen.getByRole("dialog", { name: "Outro plano" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Resumo" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("AutomationPlanDetails - edição", () => {
  async function startEditing(options) {
    const rendered = setup(options);
    await rendered.user.click(screen.getByRole("button", { name: "Editar" }));
    return rendered;
  }

  it("valida o rascunho antes de salvar", async () => {
    const { user, onSave } = await startEditing();

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "ab" } });
    await user.click(screen.getByLabelText(/Limpar temporários/));
    fireEvent.change(screen.getByLabelText("Recorrência"), { target: { value: "custom_days" } });
    fireEvent.change(screen.getByLabelText("Dias"), { target: { value: "0" } });
    await user.click(screen.getByRole("button", { name: /Salvar alterações/ }));

    expect(screen.getByText("O nome precisa ter pelo menos 3 caracteres.")).toBeInTheDocument();
    expect(screen.getByText("Selecione pelo menos um script.")).toBeInTheDocument();
    expect(screen.getByText("Informe um intervalo entre 1 e 365 dias.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: "Plano ok" } });
    expect(screen.queryByText("O nome precisa ter pelo menos 3 caracteres.")).toBeNull();
  });

  it("salva as alterações e volta para a visão geral", async () => {
    const { user, onSave } = await startEditing();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Limpeza trimestral" } });
    await user.click(screen.getByLabelText(/Verificar disco/));
    await user.click(screen.getByRole("button", { name: "Usar cor #dc2626" }));
    await user.click(screen.getByRole("button", { name: /Salvar alterações/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith("p1", {
      name: "Limpeza trimestral",
      description: "Rotina de limpeza",
      notes: "Executar fora do expediente",
      active: true,
      recurrenceType: "monthly",
      recurrenceIntervalDays: 30,
      preferredTime: "09:30",
      timezone: "America/Sao_Paulo",
      indicatorColor: "#dc2626",
      defaultScriptIds: ["sc1", "sc2"]
    });
    await waitFor(() => expect(screen.queryByRole("form")).toBeNull());
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("pede confirmação ao cancelar com alterações pendentes", async () => {
    const { user } = await startEditing();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Alterado" } });
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByLabelText("Nome")).toHaveValue("Alterado");

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(screen.getByRole("button", { name: "Descartar alterações" }));
    expect(screen.queryByLabelText("Nome")).toBeNull();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("cancela direto quando não há alterações", async () => {
    const { user } = await startEditing();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("protege o fechamento do diálogo quando há alterações pendentes", async () => {
    const { user, onClose } = await startEditing();

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Alterado" } });
    await user.click(screen.getByRole("button", { name: "Fechar detalhes do plano" }));

    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Descartar alterações" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("esconde as abas durante a edição", async () => {
    await startEditing();

    expect(screen.queryByRole("tablist")).toBeNull();
  });
});

describe("AutomationPlanDetails - pausar, reativar e excluir", () => {
  it("pausa o plano após confirmação", async () => {
    const { user, onPausePlan } = setup();

    await user.click(screen.getByRole("button", { name: "Pausar automação" }));
    expect(screen.getByText("As agendas vinculadas serão pausadas sem apagar o plano ou seu histórico.")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Pausar automação" }));

    await waitFor(() => expect(onPausePlan).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument());
  });

  it("reativa um plano inativo", async () => {
    const { user, onReactivatePlan } = setup({ plan: { ...plan, active: false } });

    expect(screen.getByText("Inativo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reativar automação" }));
    expect(screen.getByText("As agendas vinculadas voltarão a ficar ativas e serão sincronizadas.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reativar automação" }));

    await waitFor(() => expect(onReactivatePlan).toHaveBeenCalledWith("p1"));
  });

  it("cancela a confirmação de status", async () => {
    const { user, onPausePlan } = setup();

    await user.click(screen.getByRole("button", { name: "Pausar automação" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onPausePlan).not.toHaveBeenCalled();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("esconde o botão de status sem as ações de pausa/reativação", () => {
    setup({ onPausePlan: undefined, onReactivatePlan: undefined });

    expect(screen.queryByRole("button", { name: "Pausar automação" })).toBeNull();
  });

  it("só habilita a exclusão após digitar o nome do plano", async () => {
    const { user, onDelete } = setup();

    await user.click(screen.getByRole("button", { name: "Excluir plano" }));
    expect(screen.getByRole("heading", { name: "Excluir plano" })).toBeInTheDocument();
    expect(screen.getByText(/será removido de 2 máquina\(s\)/)).toBeInTheDocument();
    const confirm = screen.getAllByRole("button", { name: "Excluir plano" }).at(-1);
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText("Digite o nome do plano para confirmar"), "Limpeza mensal");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(onDelete).toHaveBeenCalledWith(plan);
  });

  it("volta da confirmação de exclusão sem excluir", async () => {
    const { user, onDelete } = setup();

    await user.click(screen.getByRole("button", { name: "Excluir plano" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("desabilita as confirmações enquanto salva", async () => {
    const { user } = setup({ saving: true });

    await user.click(screen.getByRole("button", { name: "Pausar automação" }));

    expect(screen.getAllByRole("button", { name: "Pausar automação" }).at(-1)).toBeDisabled();
  });
});
