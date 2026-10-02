import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PreventiveAutomationPanel from "./PreventiveAutomationPanel.jsx";

const scripts = [
  { id: "sc1", name: "Limpar temporários", category: "Limpeza", active: true },
  { id: "sc2", name: "Verificar disco", riskLevel: "low", active: true },
  { id: "sc3", name: "Script desativado", active: false }
];
const devices = [
  { id: "d1", name: "PC-01", ip: "10.0.0.1" },
  { id: "d2", name: "PC-02", segmentName: "Recepção" }
];
const segments = [{ id: "s1", name: "Recepção" }];
const segmentGroups = [{ id: "g1", name: "Matriz" }];
const inventoryTabs = [{ id: "t1", name: "Ambiente 1" }];

const plans = [
  {
    id: "p1",
    name: "Limpeza mensal",
    description: "Rotina de limpeza",
    active: true,
    recurrenceType: "monthly",
    preferredTime: "09:30",
    timezone: "America/Sao_Paulo",
    scopeType: "segment",
    scopeId: "s1",
    defaultScriptIds: ["sc1"],
    indicatorColor: "#2563eb",
    overrides: [{ id: "o1", segmentId: "s1", recurrenceType: "weekly" }],
    nextRunAt: "2026-07-01T12:00:00.000Z"
  },
  {
    id: "p2",
    name: "Auditoria",
    active: false,
    recurrenceType: "custom_days",
    recurrenceIntervalDays: 10,
    scopeType: "asset_list",
    assetIds: ["d1", "d2"],
    defaultScriptIds: ["sc2"],
    indicatorColor: "#dc2626"
  },
  { id: "p3", name: "Geral", active: true, scopeType: "all", indicatorColor: "#7c3aed", defaultScriptIds: [] }
];

function setup(props = {}) {
  const handlers = {
    onSave: vi.fn().mockResolvedValue(undefined),
    onDisable: vi.fn().mockResolvedValue(undefined),
    onCreateAutomatedPreventivePlan: vi.fn().mockResolvedValue(undefined),
    onCreateRequestHandled: vi.fn()
  };
  const view = render(
    <PreventiveAutomationPanel
      plans={plans}
      scripts={scripts}
      devices={devices}
      segments={segments}
      segmentGroups={segmentGroups}
      inventoryTabs={inventoryTabs}
      canCreate
      canUpdate
      canDisable
      {...handlers}
      {...props}
    />
  );
  return { ...handlers, ...view, user: userEvent.setup() };
}

function planCard(name) {
  return screen.getByText(name, { selector: "strong" }).closest("article");
}

describe("PreventiveAutomationPanel - lista de planos (variante isolada)", () => {
  it("lista os planos com horário, escopo, próxima preparação e exceções", () => {
    setup();

    expect(screen.getByRole("heading", { name: "Automação Preventiva" })).toBeInTheDocument();
    const monthly = planCard("Limpeza mensal");
    expect(within(monthly).getByText("Ativo")).toBeInTheDocument();
    expect(within(monthly).getByText("Rotina de limpeza")).toBeInTheDocument();
    expect(within(monthly).getByText("09:30 - America/Sao_Paulo")).toBeInTheDocument();
    expect(within(monthly).getByText("Segmento: Recepção")).toBeInTheDocument();
    expect(within(monthly).getByText("1 personalizada(s)")).toBeInTheDocument();
    expect(within(monthly).getByText(/01\/07/)).toBeInTheDocument();

    const audit = planCard("Auditoria");
    expect(audit).toHaveClass("inactive");
    expect(within(audit).getByText("Inativo")).toBeInTheDocument();
    expect(within(audit).getByText("Sem descrição informada")).toBeInTheDocument();
    expect(within(audit).getByText("Maquinas selecionadas: 2 maquina(s)")).toBeInTheDocument();
    expect(within(audit).getByText("Sem exceções")).toBeInTheDocument();
    expect(within(audit).getByText("Não informado")).toBeInTheDocument();

    expect(within(planCard("Geral")).getByText("Todas as máquinas")).toBeInTheDocument();
  });

  it("mostra a mensagem vazia quando não há planos", () => {
    setup({ plans: [] });

    expect(screen.getByText("Nenhum plano de automação preventiva cadastrado ainda.")).toBeInTheDocument();
  });

  it("esconde ações sem permissão", () => {
    setup({ canCreate: false, canUpdate: false, canDisable: false });

    expect(screen.queryByRole("button", { name: "Novo plano" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("limita o interruptor conforme as permissões de desativar e atualizar", () => {
    setup({ canDisable: false, canUpdate: true });

    expect(within(planCard("Limpeza mensal")).getByRole("checkbox")).toBeDisabled();
    expect(within(planCard("Auditoria")).getByRole("checkbox")).toBeEnabled();
  });

  it("desativa um plano ativo pelo interruptor", async () => {
    const { user, onDisable } = setup();

    await user.click(within(planCard("Limpeza mensal")).getByRole("checkbox"));

    expect(onDisable).toHaveBeenCalledWith("p1");
  });

  it("reativa um plano inativo salvando o payload completo", async () => {
    const { user, onSave } = setup();

    await user.click(within(planCard("Auditoria")).getByRole("checkbox"));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith("p2", {
      name: "Auditoria",
      description: "",
      active: true,
      recurrenceType: "custom_days",
      recurrenceInterval: 10,
      recurrenceIntervalDays: 10,
      preferredTime: "08:00",
      timezone: "America/Sao_Paulo",
      scopeType: "asset_list",
      scopeId: undefined,
      defaultScriptIds: ["sc2"],
      notes: "",
      overrides: []
    });
  });
});

describe("PreventiveAutomationPanel - formulário", () => {
  it("cria um plano novo com recorrência personalizada e scripts", async () => {
    const { user, onSave } = setup();

    await user.click(screen.getByRole("button", { name: "Novo plano" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Novo plano" })).toBeInTheDocument();
    expect(within(dialog).queryByText("Script desativado")).toBeNull();

    await user.type(within(dialog).getByLabelText("Nome", { exact: false }), "Plano trimestral");
    fireEvent.change(within(dialog).getByLabelText("Recorrência"), { target: { value: "custom_days" } });
    fireEvent.change(within(dialog).getByLabelText("Repetir a cada (dias)"), { target: { value: "90" } });
    fireEvent.change(within(dialog).getByLabelText("Horário preferencial"), { target: { value: "21:15" } });
    fireEvent.change(within(dialog).getByLabelText("Fuso horário"), { target: { value: "UTC" } });
    await user.click(within(dialog).getByText("Limpar temporários"));
    await user.click(within(dialog).getByRole("button", { name: "Usar cor #0f766e" }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar plano" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(null, {
      name: "Plano trimestral",
      description: "",
      active: true,
      recurrenceType: "custom_days",
      recurrenceInterval: 90,
      recurrenceIntervalDays: 90,
      preferredTime: "21:15",
      timezone: "UTC",
      scopeType: "all",
      scopeId: null,
      assetIds: [],
      defaultScriptIds: ["sc1"],
      notes: "",
      indicatorColor: "#0f766e",
      overrides: []
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("não envia recorrência personalizada fora de 1 a 365 dias", async () => {
    const { user, onSave } = setup();

    await user.click(screen.getByRole("button", { name: "Novo plano" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nome", { exact: false }), "Plano inválido");
    fireEvent.change(within(dialog).getByLabelText("Recorrência"), { target: { value: "custom_days" } });
    fireEvent.change(within(dialog).getByLabelText("Repetir a cada (dias)"), { target: { value: "400" } });
    fireEvent.submit(dialog);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("avisa sobre nome e cor duplicados e bloqueia o envio", async () => {
    const { user, onSave } = setup();

    await user.click(screen.getByRole("button", { name: "Novo plano" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nome", { exact: false }), "  limpeza MENSAL ");

    expect(within(dialog).getByText("Já existe uma automatização com esse nome.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Salvar plano" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Usar cor #2563eb" })).toBeDisabled();

    await user.clear(within(dialog).getByLabelText("Nome", { exact: false }));
    await user.type(within(dialog).getByLabelText("Nome", { exact: false }), "Outro plano");
    fireEvent.change(within(dialog).getByLabelText("Valor hexadecimal da cor"), { target: { value: "#2563eb" } });

    expect(within(dialog).getByText(/Essa cor já identifica a automatização "Limpeza mensal"/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Salvar plano" })).toBeDisabled();
    fireEvent.submit(dialog);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("normaliza a cor digitada ao sair do campo", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Novo plano" }));
    const dialog = screen.getByRole("dialog");
    const hex = within(dialog).getByLabelText("Valor hexadecimal da cor");
    fireEvent.change(hex, { target: { value: "#ABCDEF" } });
    fireEvent.blur(hex);

    expect(hex).toHaveValue("#abcdef");
    fireEvent.change(hex, { target: { value: "nada" } });
    fireEvent.blur(hex);
    expect(hex).toHaveValue("#1f7a61");
  });

  it("carrega um plano existente para edição e salva com o id", async () => {
    const { user, onSave } = setup();

    await user.click(within(planCard("Limpeza mensal")).getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Editar plano" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Nome", { exact: false })).toHaveValue("Limpeza mensal");
    expect(within(dialog).getByLabelText("Alvo")).toHaveValue("s1");
    expect(within(dialog).getByText("Limpar temporários").closest("button")).toHaveClass("selected");

    await user.click(within(dialog).getByRole("button", { name: "Salvar plano" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toBe("p1");
    expect(onSave.mock.calls[0][1]).toMatchObject({
      name: "Limpeza mensal",
      scopeType: "segment",
      scopeId: "s1",
      assetIds: [],
      recurrenceType: "monthly",
      recurrenceInterval: 30,
      preferredTime: "09:30",
      indicatorColor: "#2563eb",
      defaultScriptIds: ["sc1"]
    });
    expect(onSave.mock.calls[0][1].overrides).toEqual([
      {
        assetId: null,
        segmentId: "s1",
        recurrenceType: "weekly",
        recurrenceInterval: 30,
        recurrenceIntervalDays: 7,
        preferredTime: null,
        active: true
      }
    ]);
  });

  it("troca o escopo e oferece os alvos correspondentes", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Novo plano" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText("Alvo")).toBeNull();

    fireEvent.change(within(dialog).getByLabelText("Escopo"), { target: { value: "asset" } });
    const target = within(dialog).getByLabelText("Alvo");
    expect(within(target).getByRole("option", { name: "PC-01 - 10.0.0.1" })).toBeInTheDocument();
    expect(within(target).getByRole("option", { name: "PC-02 - Recepção" })).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Escopo"), { target: { value: "group" } });
    expect(within(within(dialog).getByLabelText("Alvo")).getByRole("option", { name: "Matriz" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Alvo")).toHaveValue("");
    expect(within(dialog).queryByRole("option", { name: "Maquinas selecionadas" })).toBeNull();
  });

  it("adiciona e remove recorrências personalizadas", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Novo plano" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Adicionar" })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: /Recorrência personalizada/ }));

    const row = dialog.querySelector(".preventive-automation-override-row");
    const [targetType, targetId, recurrence] = within(row).getAllByRole("combobox");
    await user.click(within(row).getByRole("button", { name: "Adicionar" }));
    expect(dialog.querySelectorAll(".preventive-automation-override-list .pill")).toHaveLength(0);

    fireEvent.change(targetId, { target: { value: "s1" } });
    fireEvent.change(recurrence, { target: { value: "custom_days" } });
    fireEvent.change(within(row).getByLabelText("Dias da recorrência personalizada"), { target: { value: "15" } });
    await user.click(within(row).getByRole("button", { name: "Adicionar" }));

    const chips = dialog.querySelectorAll(".preventive-automation-override-list .pill");
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent("Segmento: Recepção • A cada 15 dia(s)");

    fireEvent.change(targetType, { target: { value: "segment" } });
    fireEvent.change(targetId, { target: { value: "s1" } });
    await user.click(within(row).getByRole("button", { name: "Adicionar" }));
    expect(dialog.querySelectorAll(".preventive-automation-override-list .pill")).toHaveLength(1);

    await user.click(within(chips[0]).getByRole("button", { name: "Remover recorrência personalizada" }));
    expect(dialog.querySelectorAll(".preventive-automation-override-list .pill")).toHaveLength(0);
  });

  it("fecha o diálogo pelo botão Cancelar e pelo X", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Novo plano" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Novo plano" }));
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("PreventiveAutomationPanel - variante embutida e assistente", () => {
  const request = {
    id: 101,
    defaults: {
      name: "Rotina semanal",
      description: "Automação criada a partir da seleção preventiva: PC-01, PC-02.",
      defaultScriptIds: ["sc1"],
      context: { selectionKey: "k", assetCount: 2, assetNames: ["PC-01", "PC-02"], assetIds: ["d1", "d2"], scriptNames: ["Limpar temporários"], riskCount: 0 },
      scopeType: "asset_list",
      scopeId: "",
      assetIds: ["d1", "d2"]
    }
  };

  it("não mostra a lista de planos na variante embutida", () => {
    setup({ variant: "embedded" });

    expect(screen.queryByRole("heading", { name: "Automação Preventiva" })).toBeNull();
    expect(screen.queryByText("Limpeza mensal")).toBeNull();
    expect(screen.getByText("", { selector: "section.preventive-automation-panel.embedded" })).toBeInTheDocument();
  });

  it("abre o assistente ao receber uma solicitação e avisa que foi tratada", () => {
    const { onCreateRequestHandled } = setup({ variant: "embedded", createRequest: request });

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Etapa 3")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Configurar automatização" })).toBeInTheDocument();
    expect(within(dialog).getByText("Plano atual").nextElementSibling).toHaveTextContent("Rotina semanal");
    expect(within(dialog).getByText("Máquinas herdadas").nextElementSibling).toHaveTextContent("2");
    expect(within(dialog).getByText("Verificações herdadas").nextElementSibling).toHaveTextContent("1");
    expect(within(dialog).getByText("Maquinas selecionadas", { selector: "strong" })).toBeInTheDocument();
    expect(within(dialog).getByText("2 maquina(s) herdada(s) da preventiva.")).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "Maquinas selecionadas" })).toBeInTheDocument();
    expect(onCreateRequestHandled).toHaveBeenCalledWith(101);
  });

  it("processa a mesma solicitação uma única vez", () => {
    const { onCreateRequestHandled, rerender } = setup({ variant: "embedded", createRequest: request });
    const handled = onCreateRequestHandled.mock.calls.length;

    rerender(
      <PreventiveAutomationPanel
        variant="embedded"
        plans={plans}
        scripts={scripts}
        devices={devices}
        createRequest={{ ...request }}
        onCreateRequestHandled={onCreateRequestHandled}
      />
    );

    expect(onCreateRequestHandled).toHaveBeenCalledTimes(handled);
  });

  it("avança para a revisão, permite voltar e salva pelo fluxo automatizado", async () => {
    const { user, onCreateAutomatedPreventivePlan, onSave } = setup({ variant: "embedded", createRequest: request });
    const dialog = screen.getByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Revisar plano automatizado" }));
    expect(within(dialog).getByRole("heading", { name: "Revisar plano automatizado" })).toBeInTheDocument();
    expect(within(dialog).getByText("Revisão final")).toBeInTheDocument();
    expect(within(dialog).getByText("PC-01, PC-02", { selector: "dd" })).toBeInTheDocument();
    expect(within(dialog).getByText("Limpar temporários", { selector: "dd" })).toBeInTheDocument();
    expect(within(dialog).getByText("Mensal - a cada 30 dia(s)")).toBeInTheDocument();
    expect(within(dialog).getByText("08:00 - America/Sao_Paulo")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Voltar à automatização" }));
    expect(within(dialog).getByLabelText("Nome", { exact: false })).toHaveValue("Rotina semanal");

    await user.click(within(dialog).getByRole("button", { name: "Revisar plano automatizado" }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar plano automatizado" }));

    await waitFor(() => expect(onCreateAutomatedPreventivePlan).toHaveBeenCalledTimes(1));
    expect(onSave).not.toHaveBeenCalled();
    const [payload, context] = onCreateAutomatedPreventivePlan.mock.calls[0];
    expect(payload).toMatchObject({
      name: "Rotina semanal",
      scopeType: "asset_list",
      scopeId: null,
      assetIds: ["d1", "d2"],
      defaultScriptIds: ["sc1"],
      recurrenceType: "monthly",
      indicatorColor: "#1f7a61"
    });
    expect(context).toEqual(request.defaults.context);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
