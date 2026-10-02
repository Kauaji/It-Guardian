import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AlertCenterProvider } from "../../../context/AlertCenterContext.jsx";
import { AlertCenterViewProvider } from "../AlertCenterViewContext.jsx";
import { createAlertLookups } from "../alertLookups.js";
import { buildAlertCenterPermissions } from "../alertPermissions.js";
import AlertDiagnosticsTab from "./AlertDiagnosticsTab.jsx";
import AlertHistoryTab from "./AlertHistoryTab.jsx";

const devices = [{ id: "d1", name: "PC-01", displayName: "Computador da Ana", segmentId: "s1" }];
const lookups = createAlertLookups({ devices, segments: [{ id: "s1", name: "Recepção", groupId: "g1" }], segmentGroups: [{ id: "g1", name: "Matriz" }] });

function renderWithView(ui, { granted = () => true, center = {} } = {}) {
  const viewValue = { perms: buildAlertCenterPermissions(granted, true), lookups };
  return render(
    <AlertCenterProvider value={{ onEvaluateAlerts: vi.fn(), ...center }}>
      <AlertCenterViewProvider value={viewValue}>{ui}</AlertCenterViewProvider>
    </AlertCenterProvider>
  );
}

const alert = {
  id: "a1",
  severity: "critical",
  status: "active",
  type: "cpu_high",
  metric: "cpu",
  value: 95,
  threshold: 90,
  assetId: "d1",
  hostName: "PC-01",
  title: "CPU alta em PC-01",
  occurrencesCount: 3,
  recurrenceScore: 41.6,
  recurrenceInsight: { summary: "Voltou 3 vezes" },
  falsePositiveInsight: "Improvável",
  capacityForecast: { summary: "Disco cheio em 10 dias" },
  checklist: ["Verificar processos", "Reiniciar", "C", "D", "E"],
  comments: [
    { id: "c1", message: "antigo", createdAt: "2026-05-01T10:00:00.000Z", userName: "Ana" },
    { id: "c2", message: "meio", createdAt: "2026-05-02T10:00:00.000Z" },
    { id: "c3", text: "recente", createdAt: "2026-05-03T10:00:00.000Z", userName: "Bia" }
  ]
};

function commentBox(overrides = {}) {
  return { canComment: true, drafts: {}, onChange: vi.fn(), onSubmit: vi.fn(), ...overrides };
}

describe("AlertDiagnosticsTab", () => {
  it("mostra o diagnóstico completo de um aviso ativo", () => {
    renderWithView(<AlertDiagnosticsTab visibleAlerts={[alert, { ...alert, id: "a2", status: "resolved" }]} alertCorrelations={[]} commentBox={commentBox()} />);

    const card = document.querySelector(".alert-diagnostic-card");
    expect(document.querySelectorAll(".alert-diagnostic-card")).toHaveLength(1);
    expect(card).toHaveClass("critical");
    expect(within(card).getByText("CPU alta em Computador da Ana")).toBeInTheDocument();
    expect(within(card).getByText(/Computador da Ana · Matriz · Recepção/)).toBeInTheDocument();
    expect(within(card).getByText("Crítico")).toBeInTheDocument();
    expect(within(card).getByText("95%")).toBeInTheDocument();
    expect(within(card).getByText("90%")).toBeInTheDocument();
    expect(within(card).getByText("42")).toBeInTheDocument();
    expect(within(card).getByText("Voltou 3 vezes")).toBeInTheDocument();
    expect(within(card).getByText("Improvável")).toBeInTheDocument();
    expect(within(card).getByText("Disco cheio em 10 dias")).toBeInTheDocument();
    expect(within(card).getAllByRole("listitem")).toHaveLength(4);
  });

  it("limita os comentários exibidos aos dois mais recentes", () => {
    renderWithView(<AlertDiagnosticsTab visibleAlerts={[alert]} alertCorrelations={[]} commentBox={commentBox()} />);

    const comments = document.querySelector(".alert-comments");
    expect(within(comments).queryByText("antigo")).toBeNull();
    expect(within(comments).getByText(/meio/)).toBeInTheDocument();
    expect(within(comments).getByText(/recente/)).toBeInTheDocument();
  });

  it("envia comentários pelo campo do cartão", async () => {
    const user = userEvent.setup();
    const box = commentBox({ drafts: { a1: "rascunho" } });
    renderWithView(<AlertDiagnosticsTab visibleAlerts={[alert]} alertCorrelations={[]} commentBox={box} />);

    const input = screen.getByPlaceholderText("Adicionar comentário interno");
    expect(input).toHaveValue("rascunho");
    await user.type(input, "!");
    await user.click(screen.getByRole("button", { name: "Comentar" }));

    expect(box.onChange).toHaveBeenCalledWith("a1", "rascunho!");
    expect(box.onSubmit).toHaveBeenCalledWith("a1");
  });

  it("esconde o campo de comentário sem permissão e mostra mensagem sem comentários", () => {
    renderWithView(
      <AlertDiagnosticsTab visibleAlerts={[{ ...alert, comments: undefined }]} alertCorrelations={[]} commentBox={commentBox({ canComment: false })} />
    );

    expect(screen.queryByPlaceholderText("Adicionar comentário interno")).toBeNull();
    expect(screen.getByText("Nenhum comentário registrado.")).toBeInTheDocument();
  });

  it("lista até quatro correlações e o botão de avaliar para quem gerencia sugestões", async () => {
    const user = userEvent.setup();
    const onEvaluateAlerts = vi.fn();
    const correlations = Array.from({ length: 5 }, (_, index) => ({ id: `c${index}`, correlationSummary: `Padrão ${index}`, impactLevel: index === 0 ? "critical" : "warning", relatedHosts: ["PC-01"] }));
    renderWithView(<AlertDiagnosticsTab visibleAlerts={[]} alertCorrelations={correlations} commentBox={commentBox()} />, { center: { onEvaluateAlerts } });

    expect(screen.getByLabelText("Avisos correlacionados")).toBeInTheDocument();
    expect(document.querySelectorAll(".alert-correlation-card")).toHaveLength(4);
    expect(document.querySelector(".alert-correlation-card")).toHaveClass("critical");
    expect(screen.getByText("Nenhum aviso ativo encontrado para os filtros atuais.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Avaliar recorrência" }));
    expect(onEvaluateAlerts).toHaveBeenCalledTimes(1);
  });

  it("não oferece avaliar recorrência sem permissão", () => {
    renderWithView(<AlertDiagnosticsTab visibleAlerts={[]} alertCorrelations={[]} commentBox={commentBox()} />, { granted: () => false });

    expect(screen.queryByRole("button", { name: "Avaliar recorrência" })).toBeNull();
    expect(screen.queryByLabelText("Avisos correlacionados")).toBeNull();
  });
});

describe("AlertHistoryTab", () => {
  it("lista avisos resolvidos e sugestões tratadas", () => {
    renderWithView(
      <AlertHistoryTab
        resolvedAlerts={[{ id: "a1", assetId: "d1", hostName: "PC-01", title: "CPU alta em PC-01", metric: "cpu", value: 80, updatedAt: "2026-05-03T10:00:00.000Z" }]}
        handledSuggestions={[
          { id: "s1", status: "accepted", assetId: "d1", alertType: "cpu_high", createdAt: "2026-05-01T00:00:00.000Z", createdServiceOrderId: "OS-5" },
          { id: "s2", status: "rejected", assetId: "d1", alertType: "ram_high", createdAt: "2026-05-02T00:00:00.000Z", rejectionReason: "Falso positivo" },
          { id: "s3", status: "rejected", assetId: "d1", alertType: "ram_high", createdAt: "2026-05-02T00:00:00.000Z" }
        ]}
      />
    );

    const cards = document.querySelectorAll(".alert-history-card");
    expect(cards).toHaveLength(4);
    expect(within(cards[0]).getByText("Resolvido")).toBeInTheDocument();
    expect(within(cards[0]).getByText("CPU alta em Computador da Ana")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Computador da Ana · 80%")).toBeInTheDocument();
    expect(within(cards[1]).getByText("OS criada")).toHaveClass("ok");
    expect(within(cards[1]).getByText("OS criada: OS-5")).toBeInTheDocument();
    expect(within(cards[1]).getByText(/AVISO-2026-0001 · /)).toBeInTheDocument();
    expect(within(cards[2]).getByText("Recusada")).toHaveClass("danger");
    expect(within(cards[2]).getByText("Falso positivo")).toBeInTheDocument();
    expect(within(cards[3]).getByText("Sem observacao")).toBeInTheDocument();
  });

  it("mostra a mensagem de histórico vazio", () => {
    renderWithView(<AlertHistoryTab resolvedAlerts={[]} handledSuggestions={[]} />);

    expect(screen.getByText("Nenhum histórico encontrado ainda.")).toBeInTheDocument();
  });
});
