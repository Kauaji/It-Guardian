import { describe, expect, it } from "vitest";
import {
  buildScriptLogFromValidation,
  getSafeCommentMessage,
  getSafeListItem,
  getSafeScriptLabel,
  getSafeStatusLabel,
  getSafeSummary,
  isHighRiskScript,
  normalizeAlertLocation
} from "./alertDisplayUtils.js";

describe("formatadores seguros", () => {
  it("extrai a mensagem do comentário de várias formas", () => {
    expect(getSafeCommentMessage({ message: "A" })).toBe("A");
    expect(getSafeCommentMessage({ text: "B" })).toBe("B");
    expect(getSafeCommentMessage("C")).toBe("C");
    expect(getSafeCommentMessage({})).toBe("Comentário sem mensagem.");
    expect(getSafeCommentMessage(null)).toBe("Comentário sem mensagem.");
  });

  it("resume insights usando summary, o valor ou o fallback", () => {
    expect(getSafeSummary({ summary: "Resumo" })).toBe("Resumo");
    expect(getSafeSummary("texto")).toBe("texto");
    expect(getSafeSummary(undefined)).toBe("Não informado");
    expect(getSafeSummary(null, "Nada")).toBe("Nada");
  });

  it("formata itens de lista com fallback", () => {
    expect(getSafeListItem("Item")).toBe("Item");
    expect(getSafeListItem({ label: "Rótulo" })).toBe("Rótulo");
    expect(getSafeListItem("")).toBe("Item sem descrição");
  });

  it("traduz o status da sugestão e cai no texto original ou no fallback", () => {
    expect(getSafeStatusLabel("accepted")).toBe("OS criada");
    expect(getSafeStatusLabel("pending")).toBe("Pendente");
    expect(getSafeStatusLabel("desconhecido")).toBe("desconhecido");
    expect(getSafeStatusLabel(undefined)).toBe("Pendente");
    expect(getSafeStatusLabel({ label: "Objeto" })).toBe("Objeto");
  });

  it("escolhe o nome do script entre name, label e title", () => {
    expect(getSafeScriptLabel({ name: "N", label: "L" })).toBe("N");
    expect(getSafeScriptLabel({ label: "L" })).toBe("L");
    expect(getSafeScriptLabel({ title: "T" })).toBe("T");
    expect(getSafeScriptLabel({})).toBe("Script cadastrado");
    expect(getSafeScriptLabel(null, "Outro")).toBe("Outro");
  });

  it("normaliza a localização com os fallbacks sem acento esperados pela interface", () => {
    expect(normalizeAlertLocation({ segmentName: "Recepção", groupName: "Matriz" })).toEqual({ segmentName: "Recepção", groupName: "Matriz" });
    expect(normalizeAlertLocation({ segment: "S", group: "G" })).toEqual({ segmentName: "S", groupName: "G" });
    expect(normalizeAlertLocation()).toEqual({ segmentName: "Não organizadas", groupName: "Sem grupo" });
  });
});

describe("scripts e logs", () => {
  it("identifica scripts de risco alto ou crítico", () => {
    expect(isHighRiskScript({ riskLevel: "high" })).toBe(true);
    expect(isHighRiskScript({ riskLevel: "critical" })).toBe(true);
    expect(isHighRiskScript({ riskLevel: "low" })).toBe(false);
    expect(isHighRiskScript(null)).toBe(false);
  });

  it("monta o log exibido combinando o log e os dados da validação", () => {
    expect(
      buildScriptLogFromValidation({ id: "v1", status: "observed_persistent", scriptName: "Limpar", log: { id: "l1", rawLog: "x" } })
    ).toEqual({ id: "l1", rawLog: "x", scriptName: "Limpar", validationStatus: "observed_persistent", validationId: "v1" });
  });
});
