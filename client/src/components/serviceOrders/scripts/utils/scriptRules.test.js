import { describe, expect, it } from "vitest";
import {
  buildRecommendationContext,
  buildSimulationNotes,
  formatScriptDate,
  getEntryStatus,
  getScriptBlockReason,
  hasActiveJob,
  requiresRiskAcknowledgement
} from "./scriptRules.js";

describe("scriptRules", () => {
  it("lê o estado do job com prioridade sobre o da entrada", () => {
    expect(getEntryStatus({ status: "failed", job: { status: "queued" } })).toBe("queued");
    expect(getEntryStatus({ status: "failed" })).toBe("failed");
    expect(hasActiveJob([{ status: "succeeded" }, { job: { status: "claimed" } }])).toBe(true);
    expect(hasActiveJob([{ status: "succeeded" }])).toBe(false);
    expect(hasActiveJob([])).toBe(false);
  });

  it("exige reconhecimento apenas em risco alto ou crítico", () => {
    expect(requiresRiskAcknowledgement({ riskLevel: "high" })).toBe(true);
    expect(requiresRiskAcknowledgement({ riskLevel: "critical" })).toBe(true);
    expect(requiresRiskAcknowledgement({ riskLevel: "medium" })).toBe(false);
  });

  it("monta contexto e notas com padrões", () => {
    expect(buildRecommendationContext(undefined)).toEqual({ category: "", problemType: "", title: "", description: "" });
    expect(buildRecommendationContext({ category: "c", problemType: "p", title: "t", description: "d" })).toEqual({
      category: "c",
      problemType: "p",
      title: "t",
      description: "d"
    });
    expect(buildSimulationNotes({ number: "OS-1" }, "id")).toContain("OS OS-1.");
    expect(buildSimulationNotes(undefined, "id")).toContain("OS id.");
  });

  it("formata data ou vazio", () => {
    expect(formatScriptDate("")).toBe("");
    expect(formatScriptDate("2026-08-10T12:00:00.000Z")).toMatch(/10\/08\/2026/);
  });

  it("devolve o primeiro bloqueio aplicável, na ordem de prioridade", () => {
    const ok = {
      hasAsset: true,
      isFinalOrder: false,
      remoteScriptExecutionEnabled: true,
      agentPresent: true,
      agentFresh: true,
      canManage: true
    };
    expect(getScriptBlockReason(ok)).toBe("");
    expect(getScriptBlockReason({ ...ok, hasAsset: false, isFinalOrder: true })).toContain("máquina/ativo");
    expect(getScriptBlockReason({ ...ok, isFinalOrder: true })).toContain("finalizada");
    expect(getScriptBlockReason({ ...ok, remoteScriptExecutionEnabled: false })).toContain("desabilitada");
    expect(getScriptBlockReason({ ...ok, agentPresent: false, agentFresh: false })).toContain("não possui agente");
    expect(getScriptBlockReason({ ...ok, agentFresh: false })).toContain("offline");
    expect(getScriptBlockReason({ ...ok, canManage: false })).toContain("permissão");
  });
});
