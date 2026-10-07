import { describe, expect, it } from "vitest";
import { normalizeAlertLocation, normalizeAlertRecord, normalizeAlertSeverity, normalizeSuggestionRecord } from "./alertNormalizers.js";

describe("normalizeAlertSeverity", () => {
  it("reconhece variacoes com acento, caixa e idioma", () => {
    expect(normalizeAlertSeverity("Crítico")).toBe("critical");
    expect(normalizeAlertSeverity("INFO")).toBe("info");
    expect(normalizeAlertSeverity("Resolvido")).toBe("ok");
    expect(normalizeAlertSeverity("ok")).toBe("ok");
    expect(normalizeAlertSeverity("Alta")).toBe("high");
    expect(normalizeAlertSeverity("high")).toBe("high");
    expect(normalizeAlertSeverity("media")).toBe("media");
    expect(normalizeAlertSeverity(undefined)).toBe("warning");
  });
});

describe("normalizeAlertLocation", () => {
  it("preserva valores nao-objeto e preenche rotulos padrao", () => {
    expect(normalizeAlertLocation(null)).toBeNull();
    expect(normalizeAlertLocation("texto")).toBe("texto");
    expect(normalizeAlertLocation({})).toEqual({ group: "", groupName: "Sem grupo", segment: "", segmentName: "Não organizadas" });
    expect(normalizeAlertLocation({ group: "G", segment: "S" })).toMatchObject({ groupName: "G", segmentName: "S" });
  });
});

describe("normalizeAlertRecord", () => {
  it("sem dados cria um aviso padrao", () => {
    const record = normalizeAlertRecord();
    expect(record).toMatchObject({
      title: "Aviso ativo",
      description: "Aviso ativo",
      hostName: "Máquina não vinculada",
      status: "active",
      severity: "warning",
      checklist: [],
      comments: []
    });
    expect(record.id).toBe("Máquina não vinculada-Aviso ativo");
  });

  it("normaliza checklist e comentarios", () => {
    const record = normalizeAlertRecord({
      id: 7,
      title: "T",
      message: "Mensagem",
      machineAlias: "PC-1",
      checklist: ["a", null],
      comments: [
        { author: "Ana", body: "ok" },
        { id: "c2", userName: "Bia", text: "x" }
      ]
    });
    expect(record.description).toBe("Mensagem");
    expect(record.hostName).toBe("PC-1");
    expect(record.checklist).toEqual(["a", "Item"]);
    expect(record.comments).toEqual([
      { author: "Ana", body: "ok", id: "PC-1-comment", userName: "Ana", message: "ok" },
      { id: "c2", userName: "Bia", text: "x", message: "x" }
    ]);
  });
});

describe("normalizeSuggestionRecord", () => {
  it("usa padroes, normaliza listas de problemas e preserva outros formatos", () => {
    expect(normalizeSuggestionRecord()).toMatchObject({ title: "Aviso preventivo", hostName: "Máquina não vinculada" });
    expect(normalizeSuggestionRecord({ problemLabels: ["x", ""] }).problemLabels).toEqual(["x", "Aviso"]);
    expect(normalizeSuggestionRecord({ problemLabels: "texto" }).problemLabels).toBe("texto");
    expect(normalizeSuggestionRecord({ assetName: "Srv", summary: "Resumo", title: "T" })).toMatchObject({
      hostName: "Srv",
      description: "Resumo"
    });
  });
});
