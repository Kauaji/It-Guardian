import { describe, expect, it } from "vitest";
import {
  buildFilterPredicate,
  deriveLinkStatus,
  getStatusColorToken,
  isAssetMissing,
  isCentralAssetType,
  resolveAssetType
} from "./networkTopologyModel.js";

describe("resolveAssetType", () => {
  it("usa assetType quando presente", () => {
    expect(resolveAssetType({ assetType: "switch", type: "desktop" })).toBe("switch");
  });

  it("cai para type quando assetType nao existe", () => {
    expect(resolveAssetType({ type: "router" })).toBe("router");
  });

  it("cai para 'other' quando nao ha nenhum dos dois", () => {
    expect(resolveAssetType({})).toBe("other");
  });
});

describe("isCentralAssetType", () => {
  it("considera switch/router/server/nas como centrais", () => {
    expect(isCentralAssetType({ assetType: "switch" })).toBe(true);
    expect(isCentralAssetType({ assetType: "server" })).toBe(true);
  });

  it("nao considera desktop/notebook como centrais", () => {
    expect(isCentralAssetType({ assetType: "desktop" })).toBe(false);
  });
});

describe("isAssetMissing", () => {
  it("detecta um no cujo ativo nao esta mais na lista atual de devices", () => {
    const devicesById = new Map([["a1", { id: "a1" }]]);
    expect(isAssetMissing({ assetId: "a1" }, devicesById)).toBe(false);
    expect(isAssetMissing({ assetId: "a2" }, devicesById)).toBe(true);
  });
});

describe("deriveLinkStatus", () => {
  const devicesById = new Map([
    ["online-1", { id: "online-1", status: "online" }],
    ["online-2", { id: "online-2", status: "online" }],
    ["offline-1", { id: "offline-1", status: "offline" }],
    ["problem-1", { id: "problem-1", status: "problem" }]
  ]);

  it("statusOverride manual sempre tem prioridade", () => {
    const link = { sourceAssetId: "online-1", targetAssetId: "online-2", statusOverride: "manual" };
    expect(deriveLinkStatus(link, devicesById)).toBe("manual");
  });

  it("dois ativos online -> conexao online", () => {
    const link = { sourceAssetId: "online-1", targetAssetId: "online-2" };
    expect(deriveLinkStatus(link, devicesById)).toBe("online");
  });

  it("um ativo com problema -> conexao critica", () => {
    const link = { sourceAssetId: "online-1", targetAssetId: "problem-1" };
    expect(deriveLinkStatus(link, devicesById)).toBe("critical");
  });

  it("um ativo offline (sem problema) -> conexao offline", () => {
    const link = { sourceAssetId: "online-1", targetAssetId: "offline-1" };
    expect(deriveLinkStatus(link, devicesById)).toBe("offline");
  });

  it("ativo removido do inventario -> sem dados, nunca promete monitoramento real", () => {
    const link = { sourceAssetId: "online-1", targetAssetId: "removido" };
    expect(deriveLinkStatus(link, devicesById)).toBe("unknown");
  });
});

describe("getStatusColorToken", () => {
  it("critical e offline usam o mesmo token de cor (vermelho)", () => {
    expect(getStatusColorToken("critical")).toBe(getStatusColorToken("offline"));
  });

  it("status desconhecido cai no token 'unknown'", () => {
    expect(getStatusColorToken("qualquer-coisa")).toBe(getStatusColorToken("unknown"));
  });
});

describe("buildFilterPredicate", () => {
  const devices = [
    { id: "1", name: "Switch Lab", ip: "10.0.0.1", status: "online", assetType: "switch", segmentId: "seg-a" },
    { id: "2", name: "Desktop RH", ip: "10.0.0.2", status: "offline", assetType: "desktop", segmentId: "seg-b" }
  ];

  it("sem filtro nenhum, aceita todos", () => {
    const predicate = buildFilterPredicate({});
    expect(devices.filter(predicate)).toHaveLength(2);
  });

  it("filtra por status", () => {
    const predicate = buildFilterPredicate({ status: "offline" });
    expect(devices.filter(predicate)).toEqual([devices[1]]);
  });

  it("filtra por segmento", () => {
    const predicate = buildFilterPredicate({ segmentId: "seg-a" });
    expect(devices.filter(predicate)).toEqual([devices[0]]);
  });

  it("filtra por tipo de ativo", () => {
    const predicate = buildFilterPredicate({ assetType: "desktop" });
    expect(devices.filter(predicate)).toEqual([devices[1]]);
  });

  it("filtra por busca (nome ou IP), sem diferenciar maiusculas", () => {
    const predicate = buildFilterPredicate({ search: "SWITCH" });
    expect(devices.filter(predicate)).toEqual([devices[0]]);
  });
});
