import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createStore } from "../../test/appHarness.jsx";
import { useInventoryMeta } from "./useInventoryMeta.js";

function setup(initialMeta = {}) {
  const store = createStore(initialMeta);
  const { result } = renderHook(() =>
    useInventoryMeta({
      model: { activeInventoryTab: { id: "tab-a" } },
      persistence: { saveInventoryTabMeta: store.set }
    })
  );
  return { result, store };
}

describe("useInventoryMeta", () => {
  it("grava metadado de aba/ordem e ignora ids vazios", () => {
    const { result, store } = setup();
    result.current.updateInventoryMeta("segments", "s1", { order: 2 });
    result.current.updateInventoryMeta("segments", "", { order: 9 });
    expect(store.get()).toEqual({ segments: { s1: { order: 2 } } });
    expect(store.set).toHaveBeenCalledTimes(1);
  });

  it("atribui ativos a aba ativa por padrao ou a uma aba informada", () => {
    const { result, store } = setup({ devices: {} });
    result.current.updateDeviceTabOwnership("d1", { isDefault: false });
    expect(store.get().devices.d1.tabId).toBe("tab-a");
    result.current.updateDeviceTabOwnership(["d2"], { isDefault: false }, "tab-z");
    expect(store.get().devices.d2.tabId).toBe("tab-z");
  });
});
