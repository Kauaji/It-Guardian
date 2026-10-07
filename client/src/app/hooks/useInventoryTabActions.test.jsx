import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, createStore, sessionWrapper } from "../../test/appHarness.jsx";
import { useInventoryTabActions } from "./useInventoryTabActions.js";

const tabs = [
  { id: "tab-a", name: "Matriz", color: "#111", order: 0 },
  { id: "tab-b", name: "Filial", color: "#222", order: 1 }
];

function setup(initialTabs = tabs) {
  const session = createSession();
  const tabStore = createStore(initialTabs);
  const metaStore = createStore({ groups: { g1: { tabId: "tab-b" } }, segments: {}, devices: { d1: { tabId: "tab-b" } } });
  const setActiveInventoryTabId = vi.fn();
  const deps = {
    inventory: {
      model: { inventoryTabs: initialTabs },
      persistence: {
        saveInventoryTabMeta: metaStore.set,
        saveInventoryTabs: tabStore.set,
        setActiveInventoryTabId
      }
    }
  };
  const { result } = renderHook(() => useInventoryTabActions(deps), { wrapper: sessionWrapper(session) });
  return { metaStore, result, session, setActiveInventoryTabId, tabStore };
}

describe("useInventoryTabActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("so seleciona abas existentes", () => {
    const { result, setActiveInventoryTabId } = setup();
    act(() => result.current.selectInventoryTab("tab-b"));
    expect(setActiveInventoryTabId).toHaveBeenCalledWith("tab-b");
    act(() => result.current.selectInventoryTab("nao-existe"));
    expect(setActiveInventoryTabId).toHaveBeenCalledTimes(1);
  });

  it("cria um novo ambiente com cor livre e o ativa", () => {
    const { result, tabStore, setActiveInventoryTabId, session } = setup();
    act(() => result.current.createInventoryTab());
    const created = tabStore.get().at(-1);
    expect(created).toMatchObject({ order: 2 });
    expect(created.id).toMatch(/^tab-\d+$/);
    expect(setActiveInventoryTabId).toHaveBeenCalledWith(created.id);
    expect(session.notify).toHaveBeenCalledWith(`Ambiente ${created.name} criado.`, "ok");
  });

  it("renomeia pelo formulario e impede nomes duplicados", () => {
    const { result, tabStore, session } = setup();
    act(() => result.current.renameInventoryTab("tab-a"));
    expect(result.current.inventoryTabForm).toEqual(tabs[0]);

    act(() => result.current.submitInventoryTabForm("filial"));
    expect(session.notify).toHaveBeenLastCalledWith("Já existe uma aba com esse nome.", "danger");
    expect(tabStore.set).not.toHaveBeenCalled();

    act(() => result.current.submitInventoryTabForm("  Sede  "));
    expect(tabStore.get()[0].name).toBe("Sede");
    expect(result.current.inventoryTabForm).toBeNull();
    expect(session.notify).toHaveBeenLastCalledWith("Ambiente renomeado.", "ok");
  });

  it("ignora envio vazio, sem formulario ou de aba inexistente", () => {
    const { result, tabStore } = setup();
    act(() => result.current.submitInventoryTabForm("Nome"));
    act(() => result.current.renameInventoryTab("x"));
    act(() => result.current.renameInventoryTab("tab-a"));
    act(() => result.current.submitInventoryTabForm("   "));
    expect(tabStore.set).not.toHaveBeenCalled();
    act(() => result.current.closeInventoryTabForm());
    expect(result.current.inventoryTabForm).toBeNull();
  });

  it("nao deixa excluir a ultima aba", () => {
    const { result, session } = setup([tabs[0]]);
    act(() => result.current.deleteInventoryTab("tab-a"));
    expect(session.notify).toHaveBeenCalledWith("Mantenha pelo menos uma aba no inventário.", "danger");
  });

  it("exclui apos confirmar, reatribuindo os dados locais a aba restante", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result, tabStore, metaStore, setActiveInventoryTabId, session } = setup();
    act(() => result.current.deleteInventoryTab("tab-b"));
    expect(tabStore.get()).toEqual([{ ...tabs[0], order: 0 }]);
    expect(metaStore.get().groups.g1.tabId).toBe("tab-a");
    expect(metaStore.get().devices.d1.tabId).toBe("tab-a");
    expect(setActiveInventoryTabId).toHaveBeenCalledWith("tab-a");
    expect(session.notify).toHaveBeenCalledWith("Aba excluída. Dados movidos para outro ambiente.", "ok");
  });

  it("nao exclui sem confirmar nem aba inexistente e troca a cor", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result, tabStore } = setup();
    act(() => result.current.deleteInventoryTab("tab-b"));
    expect(tabStore.set).not.toHaveBeenCalled();
    act(() => result.current.deleteInventoryTab("x"));
    expect(confirm).toHaveBeenCalledTimes(1);

    act(() => result.current.changeInventoryTabColor("tab-a", "#fff"));
    expect(tabStore.get()[0].color).toBe("#fff");
  });
});
