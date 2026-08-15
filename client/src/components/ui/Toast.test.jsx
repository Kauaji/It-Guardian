import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Toast from "./Toast.jsx";

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("nao renderiza nada quando nao ha mensagem", () => {
    const { container } = render(<Toast message="" tone="ok" onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza a mensagem com a classe do tone recebido", () => {
    render(<Toast message="Script enfileirado." tone="ok" onClose={() => {}} />);
    const toast = screen.getByText("Script enfileirado.");
    expect(toast).toHaveClass("toast", "ok");
  });

  it("chama onClose automaticamente apos o tempo padrao", () => {
    const onClose = vi.fn();
    render(<Toast message="Falha ao salvar." tone="danger" onClose={onClose} />);

    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4200);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("nao dispara o onClose antigo apos a mensagem mudar", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Toast message="Primeira mensagem" tone="ok" onClose={onClose} />);

    vi.advanceTimersByTime(2000);
    rerender(<Toast message="Segunda mensagem" tone="ok" onClose={onClose} />);
    vi.advanceTimersByTime(2200);
    expect(onClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
