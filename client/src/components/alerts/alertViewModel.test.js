import { describe, expect, it } from "vitest";
import { createAlertLookups } from "./alertLookups.js";
import {
  buildAlertMachineGroups,
  buildAlertSummary,
  buildSuggestionAlertShape,
  buildSuggestionInfoModel,
  buildVisibleSuggestions,
  filterVisibleAlerts,
  findSuggestionCodeIndex,
  getSuggestionCorrelations
} from "./alertViewModel.js";

const devices = [
  { id: "d1", name: "PC-01" },
  { id: "d2", name: "PC-02" },
  { id: "d3", name: "Servidor" }
];
const lookups = createAlertLookups({ devices });

const pending = (id, assetId, overrides = {}) => ({
  id,
  status: "pending",
  suggestedPriority: "medium",
  assetId,
  alertType: "cpu_high",
  createdAt: "2026-05-10T10:00:00.000Z",
  ...overrides
});

describe("filterVisibleAlerts", () => {
  const history = [
    { id: "1", severity: "critical", status: "active" },
    { id: "2", severity: "warning", status: "resolved" },
    { id: "3", severity: "warning", status: "active" }
  ];

  it("filtra por severidade e status", () => {
    expect(filterVisibleAlerts(history, "all", "all")).toHaveLength(3);
    expect(filterVisibleAlerts(history, "critical", "all").map((alert) => alert.id)).toEqual(["1"]);
    expect(filterVisibleAlerts(history, "warning", "active").map((alert) => alert.id)).toEqual(["3"]);
    expect(filterVisibleAlerts(history, "all", "resolved").map((alert) => alert.id)).toEqual(["2"]);
    expect(filterVisibleAlerts(history, "all", "outro")).toEqual([]);
  });
});

describe("buildVisibleSuggestions", () => {
  it("consolida por máquina e ordena por prioridade e recorrência", () => {
    const suggestions = [
      pending("a", "d1", { suggestedPriority: "low" }),
      pending("b", "d2", { suggestedPriority: "high", occurrencesCount: 1 }),
      pending("c", "d3", { suggestedPriority: "medium", occurrencesCount: 9 })
    ];

    const result = buildVisibleSuggestions(suggestions, devices, "all");

    // medium com 9 ocorrencias sobe para high (+recorrencia) e pesa 45 + 24 = 69; high sem recorrencia pesa 45.
    expect(result.map((item) => item.assetId)).toEqual(["d3", "d2", "d1"]);
  });

  it("desempata pela data de atualização mais recente", () => {
    const suggestions = [
      pending("a", "d1", { updatedAt: "2026-05-01T00:00:00.000Z" }),
      pending("b", "d2", { updatedAt: "2026-06-01T00:00:00.000Z" })
    ];

    expect(buildVisibleSuggestions(suggestions, devices, "all").map((item) => item.assetId)).toEqual(["d2", "d1"]);
  });

  it("ignora sugestões que não são acionáveis e aplica o filtro de status", () => {
    const suggestions = [
      pending("a", "d1"),
      pending("b", "d2", { status: "accepted" }),
      pending("c", "d3", { status: "observed_persistent" }),
      pending("d", "d1", { createdServiceOrderId: "OS-1" })
    ];

    expect(buildVisibleSuggestions(suggestions, devices, "all")).toHaveLength(2);
    expect(buildVisibleSuggestions(suggestions, devices, "observed_persistent").map((item) => item.assetId)).toEqual(["d3"]);
    expect(buildVisibleSuggestions([], devices, "all")).toEqual([]);
  });
});

describe("buildAlertMachineGroups e buildAlertSummary", () => {
  const alerts = [
    { id: "a1", status: "active", severity: "critical", assetId: "d1", occurrencesCount: 4 },
    { id: "a2", status: "active", severity: "warning", assetId: "d1" },
    { id: "a3", status: "resolved", severity: "critical", assetId: "d2" },
    { id: "a4", status: "active", severity: "warning", hostName: "sem-vinculo" },
    { id: "a5", status: "active", severity: "warning" }
  ];

  it("agrupa avisos ativos por máquina, usando identificadores de contingência", () => {
    const groups = buildAlertMachineGroups(alerts, lookups);

    expect(groups.map((group) => group.map((alert) => alert.id))).toEqual([["a1", "a2"], ["a4"], ["a5"]]);
  });

  it("calcula os indicadores do topo", () => {
    const suggestions = [
      pending("s1", "d1"),
      pending("s2", "d1", { alertType: "ram_high" }),
      pending("s3", "d2", { status: "accepted" }),
      pending("s4", "d3", { status: "rejected" })
    ];
    const history = [...alerts, { id: "a6", status: "resolved" }];

    const summary = buildAlertSummary({ alerts, history, suggestions, devices, lookups });

    expect(summary).toMatchObject({
      activeMachines: 3,
      criticalAlerts: 1,
      pendingSuggestions: 1,
      acceptedSuggestions: 1,
      recurringAlerts: 1,
      machinesAtRisk: 3
    });
    expect(summary.resolvedAlerts.map((alert) => alert.id)).toEqual(["a3", "a6"]);
    expect(summary.handledSuggestions.map((suggestion) => suggestion.id)).toEqual(["s3", "s4"]);
  });
});

describe("modal de detalhes", () => {
  it("encontra o índice do código preferindo a lista visível", () => {
    const visible = [{ id: "b" }, { id: "a" }];
    const all = [{ id: "a" }, { id: "b" }, { id: "c" }];

    expect(findSuggestionCodeIndex(visible, all, "a")).toBe(1);
    expect(findSuggestionCodeIndex(visible, all, "c")).toBe(2);
    expect(findSuggestionCodeIndex(visible, all, "zzz")).toBe(0);
    expect(findSuggestionCodeIndex([], [], null)).toBe(0);
  });

  it("filtra correlações pelo nome da máquina ou pelo aviso relacionado", () => {
    const suggestion = { alertId: "al1", hostName: "PC-01" };
    const correlations = [
      { id: "c1", relatedHosts: ["PC-01"] },
      { id: "c2", relatedAlerts: [{ id: "al1" }] },
      { id: "c3", relatedAlerts: [{ hostName: "PC-01" }] },
      { id: "c4", relatedHosts: ["Outro"], relatedAlerts: [{ id: "x" }] },
      { id: "c5", relatedHosts: "nao-lista", relatedAlerts: null }
    ];

    expect(getSuggestionCorrelations(suggestion, correlations).map((item) => item.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("representa a sugestão como aviso com valores de contingência", () => {
    const shape = buildSuggestionAlertShape(
      pending("s1", "d1", { alertId: "al1", suggestedPriority: "critical", description: { summary: "Resumo" }, createdAt: "2026-05-10T00:00:00.000Z" }),
      lookups
    );

    expect(shape).toMatchObject({
      id: "al1",
      type: "cpu_high",
      severity: "critical",
      status: "pending",
      description: "Resumo",
      hostName: "PC-01",
      occurrencesCount: 1,
      firstSeenAt: "2026-05-10T00:00:00.000Z",
      lastSeenAt: "2026-05-10T00:00:00.000Z"
    });
    expect(buildSuggestionAlertShape(pending("s2", "d1"), lookups).severity).toBe("warning");
  });

  it("monta o modelo completo e retorna nulo sem sugestão", () => {
    expect(buildSuggestionInfoModel(null, lookups)).toBeNull();

    const model = buildSuggestionInfoModel(
      pending("s1", "d1", { comments: [{ id: "c" }], checklist: ["a"], suggestedPriority: undefined, hostName: "PC-01" }),
      lookups,
      [{ id: "cor", relatedHosts: ["PC-01"] }]
    );

    expect(model).toMatchObject({
      priority: "medium",
      priorityLabel: "Média",
      machineLabel: "PC-01",
      comments: [{ id: "c" }],
      checklist: ["a"],
      location: { segmentName: "Não organizadas", groupName: "Sem grupo" }
    });
    expect(model.device).toBe(devices[0]);
    expect(model.correlations).toHaveLength(1);
    expect(buildSuggestionInfoModel(pending("s2", "d1", { comments: "x", checklist: null }), lookups)).toMatchObject({ comments: [], checklist: [] });
  });
});
