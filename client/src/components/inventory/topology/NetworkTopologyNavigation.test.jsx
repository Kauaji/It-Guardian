import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useModalLifecycle } from "../../../hooks/useModalLifecycle.js";
import NetworkTopologyNavigation from "./NetworkTopologyNavigation.jsx";

function TestModal({ onClose }) {
  const dialogRef = useModalLifecycle(true, onClose);
  return (
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Detalhes do ativo">
      <button type="button">Ação do modal</button>
    </section>
  );
}

function renderNavigation() {
  return render(
    <>
      <NetworkTopologyNavigation>
        <input aria-label="Buscar grupo" />
        <button type="button">Abrir grupo</button>
      </NetworkTopologyNavigation>
      <button type="button">Mapa</button>
    </>
  );
}

function pointerOver(target, pointerType) {
  const event = new Event("pointerover", { bubbles: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  fireEvent(target, event);
}

describe("NetworkTopologyNavigation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("começa recolhida, sem controles ocultos na ordem de foco", () => {
    renderNavigation();
    expect(screen.getByRole("button", { name: "Abrir navegação do mapa" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox", { name: "Buscar grupo" })).not.toBeInTheDocument();
  });

  it("abre por proximidade na lateral e recolhe quando o ponteiro sai", () => {
    renderNavigation();
    const rail = screen.getByRole("complementary", { name: "Navegação do mapa de rede" });
    pointerOver(rail, "mouse");
    expect(screen.getByRole("textbox", { name: "Buscar grupo" })).toBeVisible();
    fireEvent.pointerLeave(rail);
    expect(screen.queryByRole("textbox", { name: "Buscar grupo" })).not.toBeInTheDocument();
  });

  it("não depende de hover em telas de toque e possui botão para fechar", async () => {
    const user = userEvent.setup();
    renderNavigation();
    const rail = screen.getByRole("complementary", { name: "Navegação do mapa de rede" });
    pointerOver(rail, "touch");
    expect(screen.queryByRole("textbox", { name: "Buscar grupo" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abrir navegação do mapa" }));
    expect(screen.getByRole("textbox", { name: "Buscar grupo" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Recolher navegação do mapa" }));
    expect(screen.queryByRole("textbox", { name: "Buscar grupo" })).not.toBeInTheDocument();
  });

  it("abre pelo foco, aceita Escape e devolve o foco ao botão sem reabrir", async () => {
    const user = userEvent.setup();
    renderNavigation();
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Buscar grupo" })).toBeVisible();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Buscar grupo" })).toHaveFocus();
    await user.keyboard("{Escape}");
    const trigger = screen.getByRole("button", { name: "Abrir navegação do mapa" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.tab();
    expect(screen.getByRole("button", { name: "Mapa" })).toHaveFocus();
  });

  it("Escape recolhe a lateral aberta por hover sem tirar o foco do mapa", async () => {
    const user = userEvent.setup();
    renderNavigation();
    const mapButton = screen.getByRole("button", { name: "Mapa" });
    await user.click(mapButton);
    pointerOver(screen.getByRole("complementary", { name: "Navegação do mapa de rede" }), "mouse");
    expect(screen.getByRole("textbox", { name: "Buscar grupo" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Buscar grupo" })).not.toBeInTheDocument();
    expect(mapButton).toHaveFocus();
  });

  it("remove o listener global de Escape ao recolher e ao desmontar", () => {
    const addListener = vi.spyOn(document, "addEventListener");
    const removeListener = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderNavigation();
    const rail = screen.getByRole("complementary", { name: "Navegação do mapa de rede" });
    pointerOver(rail, "mouse");
    const escapeListener = addListener.mock.calls.filter(([type]) => type === "keydown").at(-1)[1];
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(removeListener).toHaveBeenCalledWith("keydown", escapeListener);
    fireEvent.pointerLeave(rail);
    pointerOver(rail, "mouse");
    const reopenedListener = addListener.mock.calls.filter(([type]) => type === "keydown").at(-1)[1];
    unmount();
    expect(removeListener).toHaveBeenCalledWith("keydown", reopenedListener);
  });

  it("não consome Escape já tratado por outro controle", () => {
    renderNavigation();
    pointerOver(screen.getByRole("complementary", { name: "Navegação do mapa de rede" }), "mouse");
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    event.preventDefault();
    fireEvent(document.body, event);
    expect(screen.getByRole("textbox", { name: "Buscar grupo" })).toBeVisible();
  });

  it("deixa o modal ativo tratar Escape sem recolher a lateral ou roubar foco", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderNavigation();
    await user.click(screen.getByRole("button", { name: "Mapa" }));
    pointerOver(screen.getByRole("complementary", { name: "Navegação do mapa de rede" }), "mouse");
    render(<TestModal onClose={onClose} />);
    const modalButton = screen.getByRole("button", { name: "Ação do modal" });
    await waitFor(() => expect(modalButton).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: "Buscar grupo" })).toBeVisible();
    expect(modalButton).toHaveFocus();
  });

  it("fecha ao tocar fora, sem prender o usuário na navegação", async () => {
    const user = userEvent.setup();
    renderNavigation();
    await user.click(screen.getByRole("button", { name: "Abrir navegação do mapa" }));
    await user.click(screen.getByRole("button", { name: "Mapa" }));
    expect(screen.queryByRole("textbox", { name: "Buscar grupo" })).not.toBeInTheDocument();
  });
});
