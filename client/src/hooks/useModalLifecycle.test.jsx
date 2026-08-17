import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useModalLifecycle } from "./useModalLifecycle.js";

function TestModal({ open, onClose }) {
  const dialogRef = useModalLifecycle(open, onClose);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Modal de teste">
        <button type="button">Primeiro</button>
        <button type="button">Meio</button>
        <button type="button">Ultimo</button>
      </section>
    </div>
  );
}

describe("useModalLifecycle", () => {
  it("foca o primeiro elemento focavel ao abrir", async () => {
    render(<TestModal open onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Primeiro")).toHaveFocus());
  });

  it("Tab no ultimo elemento volta o foco para o primeiro (focus trap)", async () => {
    render(<TestModal open onClose={() => {}} />);
    const first = screen.getByText("Primeiro");
    const last = screen.getByText("Ultimo");
    await waitFor(() => expect(first).toHaveFocus());

    last.focus();
    expect(last).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(first).toHaveFocus();
  });

  it("Shift+Tab no primeiro elemento vai para o ultimo (focus trap)", async () => {
    render(<TestModal open onClose={() => {}} />);
    const first = screen.getByText("Primeiro");
    const last = screen.getByText("Ultimo");
    await waitFor(() => expect(first).toHaveFocus());

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("Escape chama onClose", async () => {
    const onClose = vi.fn();
    render(<TestModal open onClose={onClose} />);
    await waitFor(() => expect(screen.getByText("Primeiro")).toHaveFocus());

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Tab num elemento do meio nao interfere no fluxo normal do navegador", async () => {
    render(<TestModal open onClose={() => {}} />);
    const middle = screen.getByText("Meio");
    await waitFor(() => expect(screen.getByText("Primeiro")).toHaveFocus());

    middle.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(middle).toHaveFocus();
  });

  describe("modais aninhados", () => {
    function NestedModals({ outerOpen, innerOpen, onCloseOuter, onCloseInner }) {
      const outerRef = useModalLifecycle(outerOpen, onCloseOuter);
      const innerRef = useModalLifecycle(innerOpen, onCloseInner);

      return (
        <div>
          {outerOpen && (
            <section ref={outerRef} role="dialog" aria-label="Modal externo">
              <button type="button">Botao externo</button>
              {innerOpen && (
                <section ref={innerRef} role="dialog" aria-label="Modal interno">
                  <button type="button">Botao interno</button>
                </section>
              )}
            </section>
          )}
        </div>
      );
    }

    // Modais reais aninhados sempre abrem em sequencia (o externo ja esta
    // aberto e com foco assentado quando o usuario aciona algo que abre o
    // interno) - nunca simultaneamente no mesmo render. Os testes abaixo
    // reproduzem essa sequencia real em vez de montar os dois de uma vez,
    // que produziria um "previouslyFocused" capturado antes de qualquer
    // timer de foco rodar e não corresponderia ao cenário real.
    async function openOuterThenInner(onCloseOuter, onCloseInner) {
      const utils = render(
        <NestedModals outerOpen innerOpen={false} onCloseOuter={onCloseOuter} onCloseInner={onCloseInner} />
      );
      await waitFor(() => expect(screen.getByText("Botao externo")).toHaveFocus());

      utils.rerender(
        <NestedModals outerOpen innerOpen onCloseOuter={onCloseOuter} onCloseInner={onCloseInner} />
      );
      await waitFor(() => expect(screen.getByText("Botao interno")).toHaveFocus());

      return utils;
    }

    it("Escape fecha so o modal mais interno, nao os dois de uma vez", async () => {
      const onCloseOuter = vi.fn();
      const onCloseInner = vi.fn();
      await openOuterThenInner(onCloseOuter, onCloseInner);

      fireEvent.keyDown(window, { key: "Escape" });

      expect(onCloseInner).toHaveBeenCalledTimes(1);
      expect(onCloseOuter).not.toHaveBeenCalled();
    });

    it("apos o modal interno fechar, Escape volta a fechar o externo", async () => {
      const onCloseOuter = vi.fn();
      const onCloseInner = vi.fn();
      const { rerender } = await openOuterThenInner(onCloseOuter, onCloseInner);

      rerender(
        <NestedModals outerOpen innerOpen={false} onCloseOuter={onCloseOuter} onCloseInner={onCloseInner} />
      );
      await waitFor(() => expect(screen.getByText("Botao externo")).toHaveFocus());

      fireEvent.keyDown(window, { key: "Escape" });

      expect(onCloseOuter).toHaveBeenCalledTimes(1);
      expect(onCloseInner).not.toHaveBeenCalled();
    });

    it("Tab enquanto o modal interno esta aberto so percorre os elementos focaveis dele, nao os do externo", async () => {
      await openOuterThenInner(vi.fn(), vi.fn());
      const inner = screen.getByText("Botao interno");

      fireEvent.keyDown(window, { key: "Tab" });

      expect(inner).toHaveFocus();
    });

    it("trocar a referencia de onClose do modal externo enquanto ele segue aberto nao reordena a pilha", async () => {
      const onCloseOuterFirst = vi.fn();
      const onCloseOuterSecond = vi.fn();
      const onCloseInner = vi.fn();
      const { rerender } = await openOuterThenInner(onCloseOuterFirst, onCloseInner);

      rerender(
        <NestedModals outerOpen innerOpen onCloseOuter={onCloseOuterSecond} onCloseInner={onCloseInner} />
      );

      fireEvent.keyDown(window, { key: "Escape" });

      expect(onCloseInner).toHaveBeenCalledTimes(1);
      expect(onCloseOuterFirst).not.toHaveBeenCalled();
      expect(onCloseOuterSecond).not.toHaveBeenCalled();
    });
  });
});
