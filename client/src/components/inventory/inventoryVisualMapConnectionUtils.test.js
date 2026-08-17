import { describe, expect, it } from "vitest";
import {
  CONNECTION_TYPE_OPTIONS,
  QUICK_LAYER_VIEWS,
  buildDefaultConnectionDraft,
  getConnectionLayer,
  getConnectionTypeLabel,
  getQuickLayerState,
  isLayerVisible
} from "./inventoryVisualMapConnectionUtils.js";

describe("getQuickLayerState", () => {
  it("view 'structure' habilita somente a camada de estrutura", () => {
    const state = getQuickLayerState("structure");
    expect(state).toEqual({
      structure: true,
      assets: false,
      infrastructure: false,
      electrical: false
    });
  });

  it("view 'infra-assets' habilita infraestrutura e ativos, mas nao estrutura/eletrica", () => {
    const state = getQuickLayerState("infra-assets");
    expect(state).toEqual({
      structure: false,
      assets: true,
      infrastructure: true,
      electrical: false
    });
  });

  it("view 'all' habilita todas as camadas", () => {
    const state = getQuickLayerState("all");
    expect(state).toEqual({
      structure: true,
      assets: true,
      infrastructure: true,
      electrical: true
    });
  });

  it("cai para a primeira view (QUICK_LAYER_VIEWS[0]) quando a chave e desconhecida", () => {
    const fallbackState = getQuickLayerState("chave-inexistente");
    const defaultState = getQuickLayerState(QUICK_LAYER_VIEWS[0].key);
    expect(fallbackState).toEqual(defaultState);
  });
});

describe("getConnectionTypeLabel", () => {
  it("retorna o label cadastrado para tipos conhecidos de infraestrutura e eletrica", () => {
    expect(getConnectionTypeLabel("network_cable")).toBe("Cabo de rede");
    expect(getConnectionTypeLabel("power_line")).toBe("Linha eletrica");
    expect(getConnectionTypeLabel("ups_line")).toBe("Linha nobreak");
  });

  it("usa o proprio tipo como fallback quando o tipo e desconhecido mas truthy", () => {
    expect(getConnectionTypeLabel("tipo_inexistente")).toBe("tipo_inexistente");
  });

  it("retorna 'Conexao' quando o tipo e ausente", () => {
    expect(getConnectionTypeLabel(undefined)).toBe("Conexao");
    expect(getConnectionTypeLabel(null)).toBe("Conexao");
    expect(getConnectionTypeLabel("")).toBe("Conexao");
  });
});

describe("getConnectionLayer", () => {
  it("retorna 'infrastructure' para tipos de conexao de infraestrutura", () => {
    expect(getConnectionLayer("backbone")).toBe("infrastructure");
    expect(getConnectionLayer("rack_link")).toBe("infrastructure");
  });

  it("retorna 'electrical' para tipos de conexao eletrica", () => {
    expect(getConnectionLayer("circuit_line")).toBe("electrical");
    expect(getConnectionLayer("ups_line")).toBe("electrical");
  });

  it("cai para 'infrastructure' quando o tipo e desconhecido", () => {
    expect(getConnectionLayer("tipo_inexistente")).toBe("infrastructure");
    expect(getConnectionLayer(undefined)).toBe("infrastructure");
  });

  it("cada tipo de CONNECTION_TYPE_OPTIONS retorna a camada declarada na propria opcao", () => {
    CONNECTION_TYPE_OPTIONS.forEach((option) => {
      expect(getConnectionLayer(option.type)).toBe(option.layer);
    });
  });
});

describe("buildDefaultConnectionDraft", () => {
  it("usa camada 'infrastructure' e cabo de rede azul por padrao (sem argumento)", () => {
    const draft = buildDefaultConnectionDraft();
    expect(draft).toEqual({
      layer: "infrastructure",
      connectionType: "network_cable",
      label: "",
      points: [
        { x: -2, y: 0.08, z: -2 },
        { x: 2, y: 0.08, z: 2 }
      ],
      color: "#0ea5e9",
      thickness: 2,
      dashed: false,
      notes: "",
      metadata: {}
    });
  });

  it("para a camada 'electrical' usa linha eletrica laranja", () => {
    const draft = buildDefaultConnectionDraft("electrical");
    expect(draft.layer).toBe("electrical");
    expect(draft.connectionType).toBe("power_line");
    expect(draft.color).toBe("#f97316");
  });

  it("mantem os mesmos campos estruturais (pontos, espessura, tracejado) independente da camada", () => {
    const infraDraft = buildDefaultConnectionDraft("infrastructure");
    const electricalDraft = buildDefaultConnectionDraft("electrical");
    expect(electricalDraft.points).toEqual(infraDraft.points);
    expect(electricalDraft.thickness).toBe(infraDraft.thickness);
    expect(electricalDraft.dashed).toBe(infraDraft.dashed);
  });
});

describe("isLayerVisible", () => {
  it("retorna true quando a camada esta explicitamente marcada como visivel", () => {
    const layers = { structure: true, assets: false };
    expect(isLayerVisible(layers, "structure")).toBe(true);
  });

  it("retorna false quando a camada esta explicitamente marcada como oculta", () => {
    const layers = { structure: true, assets: false };
    expect(isLayerVisible(layers, "assets")).toBe(false);
  });

  it("trata camada ausente no objeto como visivel por padrao", () => {
    const layers = { structure: true };
    expect(isLayerVisible(layers, "electrical")).toBe(true);
  });

  it("trata layers nulo/indefinido como tudo visivel", () => {
    expect(isLayerVisible(null, "structure")).toBe(true);
    expect(isLayerVisible(undefined, "electrical")).toBe(true);
  });

  it("integra com getQuickLayerState: view 'electrical' so deixa a camada eletrica visivel", () => {
    const layers = getQuickLayerState("electrical");
    expect(isLayerVisible(layers, "electrical")).toBe(true);
    expect(isLayerVisible(layers, "structure")).toBe(false);
    expect(isLayerVisible(layers, "assets")).toBe(false);
    expect(isLayerVisible(layers, "infrastructure")).toBe(false);
  });
});
