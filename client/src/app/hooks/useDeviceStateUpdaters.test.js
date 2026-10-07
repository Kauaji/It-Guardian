import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createStore } from "../../test/appHarness.jsx";
import { useDeviceStateUpdaters } from "./useDeviceStateUpdaters.js";

function setup(devices) {
  const all = createStore(devices);
  const visible = createStore(devices.slice(0, 1));
  const selected = createStore({ id: "d1", name: "PC" });
  const data = {
    setAllDevices: all.set,
    setDevices: visible.set,
    setSelectedDevice: selected.set
  };
  const { result } = renderHook(() => useDeviceStateUpdaters({ data }));
  return { all, result, selected, visible };
}

const devices = [
  { id: "d1", name: "PC", segmentId: "s1", segmentName: "Redes" },
  { id: "d2", name: "Outro", segmentId: "s1", segmentName: "Redes" }
];

describe("useDeviceStateUpdaters", () => {
  it("atualiza o segmento so do ativo informado, nas tres listas", () => {
    const { all, result, selected, visible } = setup(devices);
    result.current.updateDeviceSegmentInState("d1", "s2", "Caixas", { maintenance: true });
    expect(all.get()[0]).toMatchObject({ segmentId: "s2", segmentName: "Caixas", maintenance: true });
    expect(all.get()[1].segmentId).toBe("s1");
    expect(visible.get()[0].segmentId).toBe("s2");
    expect(selected.get()).toMatchObject({ id: "d1", segmentId: "s2" });
  });

  it("nao mexe no dispositivo selecionado quando e outro ativo", () => {
    const { result, selected } = setup(devices);
    result.current.patchDeviceInState("d2", (device) => ({ ...device, name: "Novo" }));
    expect(selected.get()).toEqual({ id: "d1", name: "PC" });
  });

  it("acrescenta eventos ao inicio do historico do ativo", () => {
    const { all, result } = setup([{ id: "d1", assetHistory: [{ id: "old" }] }]);
    result.current.appendDeviceHistoryEvent("d1", { id: "new" });
    expect(all.get()[0].assetHistory.map((event) => event.id)).toEqual(["new", "old"]);
  });

  it("insere ou substitui o ativo (upsert) sem incluir novos na lista filtrada", () => {
    const { all, result, selected, visible } = setup(devices);
    result.current.upsertDeviceInState({ id: "d1", name: "PC atualizado" });
    expect(all.get()[0].name).toBe("PC atualizado");
    expect(visible.get()[0].name).toBe("PC atualizado");
    expect(selected.get().name).toBe("PC atualizado");

    result.current.upsertDeviceInState({ id: "d3", name: "Novo" });
    expect(all.get().map((device) => device.id)).toEqual(["d1", "d2", "d3"]);
    expect(visible.get().map((device) => device.id)).toEqual(["d1"]);
  });

  it("remove o ativo das listas e limpa a selecao", () => {
    const { all, result, selected, visible } = setup(devices);
    result.current.removeDeviceFromState("d1");
    expect(all.get().map((device) => device.id)).toEqual(["d2"]);
    expect(visible.get()).toEqual([]);
    expect(selected.get()).toBeNull();
  });
});
