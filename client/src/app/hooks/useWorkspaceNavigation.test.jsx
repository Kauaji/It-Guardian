import { act, renderHook } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, routerWrapper } from "../../test/appHarness.jsx";
import { getViewAccess } from "../viewAccess.js";
import { useWorkspaceNavigation } from "./useWorkspaceNavigation.js";

const admin = { role: "admin" };
const limited = (...permissions) => ({ role: "viewer", effectivePermissions: permissions });

function setup({ path = "/", user = admin, session = createSession() } = {}) {
  const access = getViewAccess(user);
  return {
    session,
    ...renderHook(
      () => ({ nav: useWorkspaceNavigation(access), location: useLocation() }),
      { wrapper: routerWrapper([path], session) }
    )
  };
}

describe("useWorkspaceNavigation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("deriva a visao ativa da URL", () => {
    expect(setup({ path: "/agenda" }).result.current.nav.activeView).toBe("calendar");
    expect(setup({ path: "/plantas/p1/editor" }).result.current.nav.activeView).toBe("inventory");
    expect(setup({ path: "/" }).result.current.nav.activeView).toBe("dashboard");
  });

  it("trata URL desconhecida como dashboard sem redirecionar por conta propria", () => {
    const { result } = setup({ path: "/qualquer" });
    expect(result.current.nav.activeView).toBe("dashboard");
    expect(result.current.location.pathname).toBe("/qualquer");
  });

  it("redireciona visao sem permissao para a primeira permitida", () => {
    const { result } = setup({ path: "/agenda", user: limited("inventory.view", "alerts.view") });
    expect(result.current.nav.activeView).toBe("alerts");
    expect(result.current.location.pathname).toBe("/avisos");
  });

  it("marca como bloqueado quando o usuario nao tem nenhuma visao", () => {
    const { result } = setup({ path: "/avisos", user: limited() });
    expect(result.current.nav.activeView).toBe("blocked");
    expect(result.current.location.pathname).toBe("/avisos");
  });

  it("navega para a URL canonica da visao", () => {
    const { result } = setup();
    act(() => result.current.nav.goToView("service-orders"));
    expect(result.current.location.pathname).toBe("/ordens-de-servico");
    expect(result.current.nav.activeView).toBe("service-orders");
  });

  it("nao empilha entradas ao navegar para a visao em que ja esta", () => {
    const { result } = setup({ path: "/avisos" });
    act(() => result.current.nav.goToView("alerts"));
    expect(result.current.location.pathname).toBe("/avisos");
    expect(window.history.length).toBeLessThan(50);
  });

  it("abre o inventario e dispara o evento de quadro duas vezes", () => {
    const listener = vi.fn();
    window.addEventListener("it-guardian:open-inventory-board", listener);
    const { result } = setup({ path: "/pecas" });
    act(() => result.current.nav.openInventory());
    expect(result.current.location.pathname).toBe("/inventario");
    expect(listener).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1));
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener("it-guardian:open-inventory-board", listener);
  });

  it("abre um ativo no inventario enviando o id no evento", () => {
    const listener = vi.fn();
    window.addEventListener("it-guardian:open-inventory-board", listener);
    const { result } = setup({ path: "/pecas" });
    act(() => result.current.nav.openInventoryAsset("asset-9"));
    act(() => vi.advanceTimersByTime(1));
    expect(listener.mock.calls[0][0].detail).toEqual({ assetId: "asset-9" });
    expect(result.current.location.pathname).toBe("/inventario");
    window.removeEventListener("it-guardian:open-inventory-board", listener);
  });

  it("abre a agenda com foco na OS apenas quando pedido para criar evento", () => {
    const { result } = setup({ path: "/ordens-de-servico" });
    const order = { id: "os-1" };
    act(() => result.current.nav.openCalendar(order, true));
    expect(result.current.location.pathname).toBe("/agenda");
    expect(result.current.nav.calendarFocusOrder).toBe(order);

    act(() => result.current.nav.clearCalendarFocus());
    expect(result.current.nav.calendarFocusOrder).toBeNull();

    act(() => result.current.nav.openCalendar(order, false));
    expect(result.current.nav.calendarFocusOrder).toBeNull();
  });

  it("sair delega o encerramento da sessao ao roteamento (signOut)", () => {
    const { result, session } = setup({ path: "/avisos" });
    act(() => result.current.nav.logout());
    expect(session.signOut).toHaveBeenCalledTimes(1);
  });
});
