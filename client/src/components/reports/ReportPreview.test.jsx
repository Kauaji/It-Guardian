import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ReportPreview from "./ReportPreview.jsx";
import { getReportType } from "./reportUtils.js";

const remoteAssistanceType = getReportType("remote_assistance");

describe("ReportPreview", () => {
  it("renderiza cards de resumo e linhas da tabela com dado real", () => {
    const data = {
      summary: { totalCount: 2, averageDurationMinutes: 12 },
      rows: [
        {
          id: "s1",
          assetName: "PC-01",
          technicianName: "Joao",
          statusLabel: "Encerrada",
          connectionModeLabel: "WebRTC",
          requestedAt: "2026-08-01T00:00:00Z",
          durationMinutes: 9,
          endReason: "technician_ended"
        }
      ],
      warnings: []
    };

    render(<ReportPreview type={remoteAssistanceType} data={data} loading={false} error="" />);

    expect(screen.getByText("PC-01")).toBeTruthy();
    expect(screen.getByText("Joao")).toBeTruthy();
    expect(screen.getByText("Encerrada")).toBeTruthy();
  });

  it("nunca mostra uma chave sensivel da linha mesmo se ela vier no payload (allowlist de colunas)", () => {
    const data = {
      summary: {},
      rows: [
        {
          id: "s1",
          assetName: "PC-01",
          technicianName: "Joao",
          statusLabel: "Encerrada",
          connectionModeLabel: "WebRTC",
          requestedAt: "2026-08-01T00:00:00Z",
          durationMinutes: 9,
          endReason: "technician_ended",
          sessionToken: "SUPER-SECRETO-NAO-MOSTRAR",
          agentToken: "OUTRO-SEGREDO"
        }
      ],
      warnings: []
    };

    const { container } = render(<ReportPreview type={remoteAssistanceType} data={data} loading={false} error="" />);
    expect(container.textContent).not.toContain("SUPER-SECRETO-NAO-MOSTRAR");
    expect(container.textContent).not.toContain("OUTRO-SEGREDO");
  });

  it("mostra mensagem de vazio quando nao ha linhas", () => {
    render(<ReportPreview type={remoteAssistanceType} data={{ summary: {}, rows: [], warnings: [] }} loading={false} error="" />);
    expect(screen.getByText(/Nenhum registro encontrado/)).toBeTruthy();
  });

  it("mostra os avisos do relatorio", () => {
    const data = { summary: {}, rows: [], warnings: ["Reconexoes nao ficam disponiveis."] };
    render(<ReportPreview type={remoteAssistanceType} data={data} loading={false} error="" />);
    expect(screen.getByText("Reconexoes nao ficam disponiveis.")).toBeTruthy();
  });

  it("mostra estado de carregamento e de erro", () => {
    const { rerender, container } = render(
      <ReportPreview type={remoteAssistanceType} data={null} loading={true} error="" />
    );
    expect(container.textContent).toContain("Carregando relatorio");

    rerender(<ReportPreview type={remoteAssistanceType} data={null} loading={false} error="Falha ao carregar" />);
    expect(container.textContent).toContain("Falha ao carregar");
  });
});
