import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AlertCenterV2 from "./AlertCenterV2.jsx";
import {
  baseDevices,
  baseInventoryTabs,
  baseSegmentGroups,
  baseSegments,
  renderWithAlertCenter,
  restrictedUser
} from "./__fixtures__/alertCenterFixtures.jsx";

const api = vi.hoisted(() => ({
  fetchMaintenanceScriptRecommendations: vi.fn(),
  fetchPreventiveAutomationAgenda: vi.fn(),
  fetchPreventiveAutomationPlanHistory: vi.fn(),
  fetchSuggestionRecommendedScripts: vi.fn()
}));
vi.mock("../../api.js", () => api);
vi.mock("../maintenance/MaintenanceScriptsPanel.jsx", () => ({ default: () => null }));

const DAY = 86400000;

function renderPreventives({ props = {}, ...options } = {}) {
  const onOpenServiceOrders = props.onOpenServiceOrders ?? vi.fn();
  const rendered = renderWithAlertCenter(
    <AlertCenterV2
      token="tok"
      devices={baseDevices}
      segments={baseSegments}
      segmentGroups={baseSegmentGroups}
      inventoryTabs={baseInventoryTabs}
      serviceOrders={[]}
      remoteScriptExecutionEnabled
      {...props}
      onOpenServiceOrders={onOpenServiceOrders}
    />,
    options
  );
  return { ...rendered, onOpenServiceOrders };
}

async function openPreventives(options) {
  const user = userEvent.setup();
  const rendered = renderPreventives(options);
  await user.click(screen.getByRole("button", { name: "Preventivas" }));
  return { user, ...rendered };
}

function deviceRow(name) {
  return screen.getByText(name, { selector: "strong" }).closest("button");
}

function summaryValue(label) {
  const summary = screen.getByRole("region", { name: "Resumo preventivo" });
  return within(summary).getByText(label).closest("article").querySelector(".sr-only").textContent;
}

beforeEach(() => {
  api.fetchMaintenanceScriptRecommendations.mockResolvedValue({ recommended: [], others: [] });
  api.fetchPreventiveAutomationAgenda.mockResolvedValue({ items: [], summary: {} });
  api.fetchPreventiveAutomationPlanHistory.mockResolvedValue({ items: [] });
  api.fetchSuggestionRecommendedScripts.mockResolvedValue({ recommended: [], others: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.values(api).forEach((mock) => mock.mockReset());
});

describe("Preventivas - etapa 1 (seleção de máquinas)", () => {
  it("agrupa máquinas por grupo e segmento e resume o status preventivo", async () => {
    await openPreventives();

    expect(screen.getByText("Matriz • Recepção")).toBeInTheDocument();
    expect(screen.getByText("Matriz • Servidores")).toBeInTheDocument();
    expect(screen.getByText("2 máquinas neste segmento")).toBeInTheDocument();
    expect(screen.getByText("1 máquina neste segmento")).toBeInTheDocument();
    // PC-01 tem aviso critico e por isso aparece como "Crítica", nao como "sem preventiva".
    expect(summaryValue("Sem preventiva")).toBe("2");
    expect(summaryValue("Preventivas vencidas")).toBe("0");
    expect(summaryValue("Preventivas em dia")).toBe("0");
    expect(summaryValue("Com avisos ativos")).toBe("2");
    expect(summaryValue("Planos registrados")).toBe("0");
    expect(summaryValue("Planos automatizados")).toBe("0");
    expect(within(deviceRow("PC-01")).getByText("Sem preventiva registrada")).toBeInTheDocument();
    expect(within(deviceRow("PC-01")).getByText("1 aviso")).toBeInTheDocument();
    expect(within(deviceRow("PC-01")).getByText("Crítica")).toBeInTheDocument();
    expect(within(deviceRow("Servidor-01")).getByText("Backup")).toBeInTheDocument();
  });

  it("usa o histórico de planos para calcular preventivas em dia e vencidas", async () => {
    const preventivePlans = [
      { id: "p-new", name: "Plano recente", createdAt: new Date(Date.now() - 10 * DAY).toISOString(), assets: [{ assetId: "d2" }] },
      { id: "p-old", name: "Plano antigo", createdAt: new Date(Date.now() - 400 * DAY).toISOString(), assets: [{ assetId: "d3" }] }
    ];
    await openPreventives({ center: { preventivePlans } });

    expect(within(deviceRow("PC-02")).getByText("Preventiva em dia")).toBeInTheDocument();
    expect(within(deviceRow("PC-02")).getByText("Plano: Plano recente")).toBeInTheDocument();
    expect(within(deviceRow("PC-02")).getByText(/10 dia\(s\) desde a última/)).toBeInTheDocument();
    expect(within(deviceRow("Servidor-01")).getByText("Preventiva vencida")).toBeInTheDocument();
    expect(summaryValue("Preventivas em dia")).toBe("1");
    expect(summaryValue("Preventivas vencidas")).toBe("1");
    expect(summaryValue("Planos registrados")).toBe("2");
  });

  it("filtra por busca textual e por status", async () => {
    const { user } = await openPreventives();

    await user.type(screen.getByPlaceholderText("Buscar máquina, grupo, segmento ou ambiente"), "servidores");
    expect(screen.queryByText("PC-01", { selector: "strong" })).toBeNull();
    expect(screen.getByText("Servidor-01", { selector: "strong" })).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText("Buscar máquina, grupo, segmento ou ambiente"));
    fireEvent.change(screen.getByLabelText("Filtrar status preventivo"), { target: { value: "backup" } });
    expect(screen.queryByText("PC-02", { selector: "strong" })).toBeNull();
    expect(screen.getByText("Servidor-01", { selector: "strong" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filtrar status preventivo"), { target: { value: "up_to_date" } });
    expect(screen.getByText("Nenhuma máquina encontrada para os filtros atuais.")).toBeInTheDocument();
  });

  it("seleciona máquinas individualmente e por segmento", async () => {
    const { user } = await openPreventives();

    expect(screen.queryByLabelText("Criar plano preventivo")).toBeNull();
    await user.click(deviceRow("PC-01"));
    expect(screen.getByText("máquina selecionada")).toBeInTheDocument();
    expect(screen.getByLabelText("Criar plano preventivo")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Selecionar segmento" })[0]);
    expect(screen.getByText("máquinas selecionadas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover segmento" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remover segmento" }));
    expect(screen.queryByLabelText("Criar plano preventivo")).toBeNull();
  });

  it("mantém a seleção ao alternar de aba", async () => {
    const { user } = await openPreventives();

    await user.click(deviceRow("PC-02"));
    await user.click(screen.getByRole("button", { name: "Sugestões de OS" }));
    await user.click(screen.getByRole("button", { name: "Preventivas" }));

    expect(deviceRow("PC-02")).toHaveClass("selected");
    expect(screen.getByLabelText("Criar plano preventivo")).toBeInTheDocument();
  });

  it("desabilita a seleção sem permissão de criar planos", async () => {
    await openPreventives({ user: restrictedUser(["preventive_plans.view"]) });

    expect(deviceRow("PC-01")).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Selecionar segmento" })[0]).toBeDisabled();
  });
});

describe("Preventivas - etapa 2 (scripts) e registro", () => {
  async function selectMachineAndScript(options) {
    const rendered = await openPreventives(options);
    await rendered.user.click(deviceRow("PC-01"));
    return rendered;
  }

  it("lista scripts ativos, permite expandir a descrição e selecionar", async () => {
    const { user } = await selectMachineAndScript();
    const builder = screen.getByLabelText("Criar plano preventivo");

    expect(within(builder).getByText("Limpar temporários")).toBeInTheDocument();
    expect(within(builder).queryByText("Script antigo")).toBeNull();
    expect(within(builder).getByRole("button", { name: "Revisar preventiva" })).toBeDisabled();

    await user.click(within(builder).getAllByRole("button", { name: "Expandir descrição do script" })[0]);
    expect(within(builder).getByText("Remove arquivos temporários.")).toBeInTheDocument();
    expect(within(builder).getByRole("button", { name: "Recolher descrição do script" })).toHaveAttribute("aria-expanded", "true");

    await user.click(within(builder).getByText("Limpar temporários"));
    expect(within(builder).getByText("1 máquina(s)")).toBeInTheDocument();
    expect(within(builder).getByText("1 verificação(ões)")).toBeInTheDocument();
    expect(within(builder).getByRole("button", { name: "Revisar preventiva" })).toBeEnabled();
  });

  it("busca recomendações para as máquinas selecionadas e mostra as recomendadas primeiro", async () => {
    api.fetchMaintenanceScriptRecommendations.mockResolvedValue({
      recommended: [{ id: "sc2", name: "Reiniciar spooler", recommendationReason: "Fila travada", riskLevel: "high" }],
      others: [{ id: "sc1", name: "Limpar temporários", riskLevel: "low" }]
    });
    await selectMachineAndScript();
    const builder = screen.getByLabelText("Criar plano preventivo");

    await waitFor(() => expect(within(builder).getByText("Recomendações aparecem primeiro.")).toBeInTheDocument());
    expect(api.fetchMaintenanceScriptRecommendations).toHaveBeenCalledWith("tok", {
      assetIds: ["d1"],
      context: { source: "preventive_plan" }
    });
    const names = Array.from(builder.querySelectorAll(".preventive-script-option strong")).map((node) => node.textContent);
    expect(names).toEqual(["Reiniciar spooler", "Limpar temporários"]);
  });

  it("mostra o erro e usa os scripts ativos quando as recomendações falham", async () => {
    api.fetchMaintenanceScriptRecommendations.mockRejectedValue(new Error("Sem conexão"));
    await selectMachineAndScript();
    const builder = screen.getByLabelText("Criar plano preventivo");

    expect(await within(builder).findByText("Sem conexão")).toBeInTheDocument();
    expect(within(builder).getByText("Limpar temporários")).toBeInTheDocument();
    expect(within(builder).getByText("Reiniciar spooler")).toBeInTheDocument();
  });

  it("revisa e registra o plano manual, depois permite criar a OS preventiva", async () => {
    const { user, center, onOpenServiceOrders } = await selectMachineAndScript();
    const builder = screen.getByLabelText("Criar plano preventivo");

    fireEvent.change(within(builder).getByLabelText("Nome do plano"), { target: { value: "Plano de maio" } });
    await user.click(within(builder).getByText("Limpar temporários"));
    await user.click(within(builder).getByRole("button", { name: "Revisar preventiva" }));

    const review = screen.getByRole("dialog", { name: "Registrar plano preventivo" });
    expect(within(review).getByText("Plano de maio")).toBeInTheDocument();
    expect(within(review).getByText("Manual, pelo módulo de Avisos")).toBeInTheDocument();
    expect(within(review).getByText("1 máquina(s)")).toBeInTheDocument();
    expect(within(review).getByText("Nenhuma verificação de alto risco selecionada.")).toBeInTheDocument();

    await user.click(within(review).getByRole("button", { name: "Registrar preventiva" }));

    await waitFor(() =>
      expect(center.onCreatePreventivePlan).toHaveBeenCalledWith({
        name: "Plano de maio",
        description: "Plano preventivo registrado pela tela de Avisos.",
        source: "manual",
        notes: "",
        riskAcknowledged: false,
        assetIds: ["d1"],
        scriptIds: ["sc1"]
      })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByLabelText("Criar plano preventivo")).toBeNull();
    expect(screen.getByText("Plano registrado")).toBeInTheDocument();
    expect(screen.getByText(/1 máquina\(s\) •/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Criar OS preventiva" }));
    expect(center.onCreatePreventivePlanServiceOrder).toHaveBeenCalledWith("pp1");

    const openOrder = await screen.findByRole("button", { name: "Abrir OS preventiva" });
    await user.click(openOrder);
    expect(onOpenServiceOrders).toHaveBeenCalledTimes(1);
  });

  it("marca o risco quando a verificação selecionada é de risco alto", async () => {
    const { user, center } = await selectMachineAndScript();
    const builder = screen.getByLabelText("Criar plano preventivo");

    await user.click(within(builder).getByText("Reiniciar spooler"));
    await user.click(within(builder).getByRole("button", { name: "Revisar preventiva" }));
    const review = screen.getByRole("dialog");
    expect(within(review).getByText("Reiniciar spooler — high")).toBeInTheDocument();
    await user.click(within(review).getByRole("button", { name: "Registrar preventiva" }));

    await waitFor(() =>
      expect(center.onCreatePreventivePlan).toHaveBeenCalledWith(expect.objectContaining({ riskAcknowledged: true, scriptIds: ["sc2"] }))
    );
  });

  it("fecha a revisão com Escape", async () => {
    const { user } = await selectMachineAndScript();

    await user.click(within(screen.getByLabelText("Criar plano preventivo")).getByText("Limpar temporários"));
    await user.click(screen.getByRole("button", { name: "Revisar preventiva" }));
    expect(screen.getByRole("dialog", { name: "Registrar plano preventivo" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cancela a revisão sem registrar", async () => {
    const { user, center } = await selectMachineAndScript();
    const builder = screen.getByLabelText("Criar plano preventivo");

    await user.click(within(builder).getByText("Limpar temporários"));
    await user.click(within(builder).getByRole("button", { name: "Revisar preventiva" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(center.onCreatePreventivePlan).not.toHaveBeenCalled();
    expect(within(builder).getByText("1 verificação(ões)")).toBeInTheDocument();
  });

  it("bloqueia o botão Automatizar sem permissão de criar automações", async () => {
    const { user } = await selectMachineAndScript({
      user: restrictedUser(["preventive_plans.view", "preventive_plans.create", "preventive_plans.prepare", "preventive_automation.view"])
    });
    const builder = screen.getByLabelText("Criar plano preventivo");

    await user.click(within(builder).getByText("Limpar temporários"));

    expect(within(builder).getByRole("button", { name: "Automatizar" })).toBeDisabled();
  });
});

describe("Preventivas - automatização a partir da seleção", () => {
  it("abre o assistente, revisa e cria um plano automatizado", async () => {
    const { user, center } = await openPreventives();

    await user.click(deviceRow("PC-01"));
    await user.click(deviceRow("PC-02"));
    const builder = screen.getByLabelText("Criar plano preventivo");
    fireEvent.change(within(builder).getByLabelText("Nome do plano"), { target: { value: "Rotina semanal" } });
    await user.click(within(builder).getByText("Limpar temporários"));
    await user.click(within(builder).getByRole("button", { name: "Automatizar" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Etapa 3")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Configurar automatização" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Nome", { exact: false })).toHaveValue("Rotina semanal");
    expect(within(dialog).getByText("PC-01, PC-02")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Revisar plano automatizado" }));
    expect(within(dialog).getByRole("heading", { name: "Revisar plano automatizado" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Salvar plano automatizado" }));

    await waitFor(() => expect(center.onCreatePreventivePlan).toHaveBeenCalledTimes(1));
    const payload = center.onCreatePreventivePlan.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: "Rotina semanal",
      source: "automated",
      status: "prepared",
      riskAcknowledged: true,
      assetIds: ["d1", "d2"],
      scriptIds: ["sc1"]
    });
    expect(payload.automation).toMatchObject({
      enabled: true,
      name: "Rotina semanal",
      scopeType: "asset_list",
      scopeId: null,
      assetIds: ["d1", "d2"],
      defaultScriptIds: ["sc1"],
      recurrenceType: "monthly"
    });
    await waitFor(() => expect(screen.queryByLabelText("Criar plano preventivo")).toBeNull());
  });

  it("volta às verificações ao fechar o assistente sem salvar", async () => {
    const { user, center } = await openPreventives();

    await user.click(deviceRow("PC-01"));
    await user.click(within(screen.getByLabelText("Criar plano preventivo")).getByText("Limpar temporários"));
    await user.click(screen.getByRole("button", { name: "Automatizar" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Voltar às verificações" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(center.onCreatePreventivePlan).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Criar plano preventivo")).toBeInTheDocument();
  });
});
