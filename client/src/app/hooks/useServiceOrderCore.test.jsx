import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addServiceOrderHistory, createServiceOrder, reopenServiceOrder, updateServiceOrder } from "../../api.js";
import { createData, createSession, sessionWrapper } from "../../test/appHarness.jsx";
import { useServiceOrderCore } from "./useServiceOrderCore.js";

vi.mock("../../api.js", () => ({
  addServiceOrderHistory: vi.fn(),
  createServiceOrder: vi.fn(),
  reopenServiceOrder: vi.fn(),
  updateServiceOrder: vi.fn()
}));

const validPayload = { title: "Trocar fonte", description: "Nao liga", category: "Hardware", requesterName: "Ana" };

function setup(serviceOrders = [{ id: "os-1", number: 1, history: [{ id: "h0" }] }], systemMode = "local") {
  const session = createSession();
  const { data, stores } = createData({ serviceOrders, overrides: { systemMode } });
  const { result } = renderHook(() => useServiceOrderCore({ data }), { wrapper: sessionWrapper(session) });
  return { data, result, session, stores };
}

describe("useServiceOrderCore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("nao cria a OS quando a validacao do modo falha", async () => {
    const { result, session } = setup();
    expect(await result.current.handleCreateServiceOrder({ ...validPayload, title: "ab" })).toBeNull();
    expect(session.notify).toHaveBeenCalledWith(expect.stringContaining("titulo"), "danger");
    expect(createServiceOrder).not.toHaveBeenCalled();
  });

  it("cria a OS, a coloca no topo da lista e recarrega", async () => {
    createServiceOrder.mockResolvedValue({ serviceOrder: { id: "os-2", number: 2 } });
    const { data, result, session, stores } = setup();
    let created;
    await act(async () => {
      created = await result.current.handleCreateServiceOrder(validPayload);
    });
    expect(created).toEqual({ id: "os-2", number: 2 });
    expect(stores.serviceOrders.get().map((order) => order.id)).toEqual(["os-2", "os-1"]);
    expect(session.notify).toHaveBeenCalledWith("Ordem 2 criada.", "ok");
    expect(data.loadData).toHaveBeenCalledWith(true);
    expect(result.current.serviceOrderSaving).toBe(false);
  });

  it("exige cliente no modo Business", async () => {
    const { result, session } = setup([], "business");
    await act(async () => {
      await result.current.handleCreateServiceOrder(validPayload);
    });
    expect(session.notify).toHaveBeenCalledWith(expect.stringContaining("cliente"), "danger");
  });

  it("avisa quando a criacao falha e libera o estado de salvando", async () => {
    createServiceOrder.mockRejectedValue(new Error("erro 500"));
    const { result, session } = setup();
    let created;
    await act(async () => {
      created = await result.current.handleCreateServiceOrder(validPayload);
    });
    expect(created).toBeNull();
    expect(session.notify).toHaveBeenCalledWith("erro 500", "danger");
    expect(result.current.serviceOrderSaving).toBe(false);
  });

  it("atualiza e reabre substituindo a OS na lista", async () => {
    updateServiceOrder.mockResolvedValue({ serviceOrder: { id: "os-1", number: 1, status: "in_progress" } });
    reopenServiceOrder.mockResolvedValue({ serviceOrder: { id: "os-1", number: 1, status: "open" } });
    const { result, session, stores } = setup();

    await act(async () => {
      await result.current.handleUpdateServiceOrder("os-1", { status: "x" });
    });
    expect(stores.serviceOrders.get()[0].status).toBe("in_progress");
    expect(session.notify).toHaveBeenCalledWith("Ordem de Serviço atualizada.", "ok");

    await act(async () => {
      await result.current.handleReopenServiceOrder("os-1", "motivo");
    });
    expect(reopenServiceOrder).toHaveBeenCalledWith("token-1", "os-1", "motivo");
    expect(stores.serviceOrders.get()[0].status).toBe("open");
    expect(session.notify).toHaveBeenCalledWith("Ordem de Serviço reaberta.", "ok");
  });

  it("retorna null quando atualizar ou reabrir falha", async () => {
    updateServiceOrder.mockRejectedValue(new Error("x"));
    reopenServiceOrder.mockRejectedValue(new Error("y"));
    const { result } = setup();
    await act(async () => {
      expect(await result.current.handleUpdateServiceOrder("os-1", {})).toBeNull();
      expect(await result.current.handleReopenServiceOrder("os-1", "m")).toBeNull();
    });
  });

  it("registra historico manual na OS e avisa", async () => {
    addServiceOrderHistory.mockResolvedValue({ event: { id: "h1" } });
    const { result, session, stores } = setup();
    let event;
    await act(async () => {
      event = await result.current.handleAddServiceOrderHistory("os-1", { message: "m" });
    });
    expect(event).toEqual({ id: "h1" });
    expect(stores.serviceOrders.get()[0].history.map((item) => item.id)).toEqual(["h1", "h0"]);
    expect(session.notify).toHaveBeenCalledWith("Registro adicionado ao historico.", "ok");
  });

  it("historico de sistema nao notifica sucesso e devolve null em caso de erro", async () => {
    addServiceOrderHistory.mockResolvedValueOnce({ event: { id: "h2" } });
    const { result, session, stores } = setup();
    await act(async () => {
      await result.current.addServiceOrderSystemHistory("os-1", { message: "sys" });
    });
    expect(stores.serviceOrders.get()[0].history[0].id).toBe("h2");
    expect(session.notify).not.toHaveBeenCalled();

    addServiceOrderHistory.mockRejectedValueOnce(new Error("sem rede"));
    let event = "x";
    await act(async () => {
      event = await result.current.addServiceOrderSystemHistory("os-1", {});
    });
    expect(event).toBeNull();
    expect(session.notify).toHaveBeenCalledWith("sem rede", "danger");

    addServiceOrderHistory.mockResolvedValueOnce({});
    await act(async () => {
      await result.current.addServiceOrderSystemHistory("os-1", {});
    });
  });
});
