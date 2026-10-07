import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAssetSelection } from "./useAssetSelection.js";

const devices = [{ id: "a" }, { id: "b" }, { id: "c" }];

function setup(initial = { active: devices, visible: devices }) {
  return renderHook((props) => useAssetSelection({ activeAllDevices: props.active, visibleDevices: props.visible }), {
    initialProps: initial
  });
}

describe("useAssetSelection", () => {
  it("seleciona um ativo por vez e acumula com o modo aditivo", () => {
    const { result } = setup();
    act(() => result.current.handleSelectAsset({ id: "a" }));
    act(() => result.current.handleSelectAsset({ id: "b" }));
    expect([...result.current.selectedAssetIds]).toEqual(["b"]);

    act(() => result.current.handleSelectAsset({ id: "c" }, { additive: true }));
    expect([...result.current.selectedAssetIds]).toEqual(["b", "c"]);

    act(() => result.current.handleSelectAsset({ id: "b" }, { additive: true }));
    expect([...result.current.selectedAssetIds]).toEqual(["c"]);
  });

  it("alterna, seleciona so um e remove ativos", () => {
    const { result } = setup();
    act(() => result.current.toggleAssetSelection("a"));
    act(() => result.current.toggleAssetSelection("b"));
    expect(result.current.selectedAssets.map((device) => device.id)).toEqual(["a", "b"]);

    act(() => result.current.toggleAssetSelection("a"));
    expect([...result.current.selectedAssetIds]).toEqual(["b"]);

    act(() => result.current.selectOnly("c"));
    expect([...result.current.selectedAssetIds]).toEqual(["c"]);

    act(() => result.current.deselectAsset("c"));
    expect(result.current.selectedAssetIds.size).toBe(0);
  });

  it("limpa a selecao e o destino da movimentacao em lote", () => {
    const { result } = setup();
    act(() => result.current.toggleAssetSelection("a"));
    act(() => result.current.setBulkMoveTarget("seg-1"));
    act(() => result.current.clearAssetSelection());
    expect(result.current.selectedAssetIds.size).toBe(0);
    expect(result.current.bulkMoveTarget).toBe("");
  });

  it("descarta ids que deixam de estar visiveis e zera o destino com menos de 2", () => {
    const { result, rerender } = setup();
    act(() => result.current.toggleAssetSelection("a"));
    act(() => result.current.toggleAssetSelection("b"));
    act(() => result.current.setBulkMoveTarget("seg-1"));

    rerender({ active: devices, visible: [{ id: "a" }, { id: "c" }] });
    expect([...result.current.selectedAssetIds]).toEqual(["a"]);
    expect(result.current.bulkMoveTarget).toBe("");
  });

  it("mantem a mesma selecao quando todos os ids continuam visiveis", () => {
    const { result, rerender } = setup();
    act(() => result.current.toggleAssetSelection("a"));
    const before = result.current.selectedAssetIds;
    rerender({ active: devices, visible: [...devices] });
    expect(result.current.selectedAssetIds).toBe(before);
  });
});
