import { Boxes, Cpu } from "lucide-react";
import { describe, expect, it } from "vitest";
import { familyIcon } from "./partIcons.js";
import {
  assetDisplayName,
  buildPartsQuery,
  installedAssetId,
  isCreditMovement,
  isHardwareDiscrepancy,
  isOpenServiceOrder,
  numberOrText,
  readableSnapshot,
  stockCaption,
  summarizeParts
} from "./partsModel.js";

const memory = { discrepancyStatus: "missing", metadata: { hardwareType: "memory" } };

describe("partsModel", () => {
  it("considera incongruência só em hardware essencial e fora do estado ok", () => {
    expect(isHardwareDiscrepancy(memory)).toBe(true);
    expect(isHardwareDiscrepancy({ ...memory, discrepancyStatus: "ok" })).toBe(false);
    expect(isHardwareDiscrepancy({ discrepancyStatus: "missing", metadata: { hardwareType: "usb" } })).toBe(false);
    expect(isHardwareDiscrepancy({ discrepancyStatus: "missing" })).toBe(false);
  });

  it("transforma snapshots em texto legível", () => {
    expect(readableSnapshot(null)).toBe("Não informado");
    expect(readableSnapshot("")).toBe("Não informado");
    expect(readableSnapshot("texto {")).toBe("texto {");
    expect(readableSnapshot('{"name":"RAM","capacityGb":16}')).toBe("RAM · 16 GB");
    expect(readableSnapshot(["a", null, "b"])).toBe("a · b");
    expect(readableSnapshot([])).toBe("Não informado");
    expect(readableSnapshot({})).toBe("Não informado");
    expect(readableSnapshot({ brand: "B", model: "M", manufacturerPartNumber: "PN", serialNumber: "SN" })).toBe("B · M · PN · SN");
  });

  it("escolhe a legenda do saldo", () => {
    expect(stockCaption({ inventoryState: "in_use" }, true)).toBe("Revisar");
    expect(stockCaption({ inventoryState: "in_use" }, false)).toBe("Ver kit");
    expect(stockCaption({ inventoryState: "available", stockStatus: "out" }, false)).toBe("Sem estoque");
    expect(stockCaption({ inventoryState: "available", stockStatus: "low" }, false)).toBe("Reposição necessária");
    expect(stockCaption({ inventoryState: "available", stockStatus: "ok" }, false)).toBe("Disponível");
  });

  it("resume o catálogo", () => {
    expect(
      summarizeParts([
        { inventoryState: "available", quantity: 2 },
        { inventoryState: "available", quantity: 5 },
        { inventoryState: "in_use", quantity: 1, ...memory }
      ])
    ).toEqual({ catalog: 3, available: 7, inUse: 1, discrepancies: 1 });
    expect(summarizeParts([])).toEqual({ catalog: 0, available: 0, inUse: 0, discrepancies: 0 });
  });

  it("monta a consulta ao servidor", () => {
    expect(buildPartsQuery({ search: "a", inventoryState: "", discrepancyOnly: false })).toEqual({ search: "a", inventoryState: "" });
    expect(buildPartsQuery({ search: "", inventoryState: "in_use", discrepancyOnly: true })).toEqual({
      search: "",
      inventoryState: "in_use",
      discrepancyStatus: "open"
    });
  });

  it("resolve nome de ativo, OS abertas e tipos de crédito", () => {
    const devices = [{ id: "1", alias: "PC" }, { id: "2", hostname: "h" }, { id: "3" }];
    expect(assetDisplayName(devices, "1")).toBe("PC");
    expect(assetDisplayName(devices, "2")).toBe("h");
    expect(assetDisplayName(devices, "3")).toBe("3");
    expect(assetDisplayName(devices, "x")).toBe("x");
    expect(isOpenServiceOrder({})).toBe(true);
    expect(isOpenServiceOrder({ status: "closed" })).toBe(false);
    expect(isOpenServiceOrder({ closedAt: "2026-01-01" })).toBe(false);
    expect(isCreditMovement("receipt")).toBe(true);
    expect(isCreditMovement("return")).toBe(true);
    expect(isCreditMovement("consumption")).toBe(false);
  });

  it("identifica peça instalada que leva direto ao kit", () => {
    expect(installedAssetId({ inventoryState: "in_use", assignedAssetId: "a" })).toBe("a");
    expect(installedAssetId({ inventoryState: "in_use", sourceAssetId: "s" })).toBe("s");
    expect(installedAssetId({ inventoryState: "in_use" })).toBe("");
    expect(installedAssetId({ inventoryState: "available", assignedAssetId: "a" })).toBe("");
    expect(installedAssetId({ inventoryState: "in_use", sourceAssetId: "s", ...memory })).toBe("");
  });

  it("converte campos numéricos e mantém texto", () => {
    expect(numberOrText({ type: "number", value: "3.5" })).toBe(3.5);
    expect(numberOrText({ type: "text", value: "3.5" })).toBe("3.5");
  });

  it("escolhe o ícone da família com fallback", () => {
    expect(familyIcon("processor")).toBe(Cpu);
    expect(familyIcon("desconhecida")).toBe(Boxes);
  });
});
