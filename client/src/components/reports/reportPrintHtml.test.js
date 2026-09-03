import { describe, expect, it } from "vitest";

import { buildReportPrintHtml } from "./reportPrintHtml.js";

describe("buildReportPrintHtml", () => {
  it("escapa HTML em texto livre (titulo/comentario) antes de interpolar - guarda contra XSS no popup", () => {
    const html = buildReportPrintHtml({
      typeId: "service_orders",
      typeLabel: "Ordens de Servico",
      generatedAt: "23/08/2026 10:00",
      data: {
        summary: {},
        rows: [
          {
            number: "OS-1",
            title: "<script>alert(1)</script>",
            statusLabel: "Aberta",
            priorityLabel: "Alta",
            originLabel: "Manual",
            environmentName: "\"; DROP TABLE --",
            sectorName: "Geral",
            assetName: "PC-01",
            assignedTechnicianName: "Joao",
            createdAt: "2026-08-01",
            firstResponseAt: null,
            slaDueAt: null,
            closedAt: null,
            reopenCount: 0,
            feedbackRating: null
          }
        ],
        warnings: []
      }
    });

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;");
  });

  it("mostra uma linha de aviso quando nao ha registros, sem quebrar a tabela", () => {
    const html = buildReportPrintHtml({
      typeId: "assets",
      typeLabel: "Ativos",
      generatedAt: "23/08/2026 10:00",
      data: { summary: {}, rows: [], warnings: [] }
    });

    expect(html).toContain("Nenhum registro encontrado");
  });

  it("lista os avisos do relatorio na secao de observacoes", () => {
    const html = buildReportPrintHtml({
      typeId: "sla",
      typeLabel: "SLA",
      generatedAt: "23/08/2026 10:00",
      data: { summary: {}, rows: [], warnings: ["OS nao se aplica ficam fora do percentual."] }
    });

    expect(html).toContain("OS nao se aplica ficam fora do percentual.");
  });
});
