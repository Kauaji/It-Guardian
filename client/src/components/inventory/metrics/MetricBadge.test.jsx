import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MetricBadge from "./MetricBadge.jsx";

describe("MetricBadge", () => {
  it("mostra o valor atual sem abrir nada enquanto nao ha clique", () => {
    const onOpenModal = vi.fn();
    render(
      <MetricBadge metric="cpu" onOpenModal={onOpenModal}>
        <strong className="ok">42%</strong>
      </MetricBadge>
    );

    expect(screen.getByText("42%")).toBeTruthy();
    expect(onOpenModal).not.toHaveBeenCalled();
  });

  it("clique chama onOpenModal com a metrica", () => {
    const onOpenModal = vi.fn();
    render(
      <MetricBadge metric="disk" onOpenModal={onOpenModal}>
        <strong>50%</strong>
      </MetricBadge>
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onOpenModal).toHaveBeenCalledWith("disk");
  });

  it("hover sozinho nao chama onOpenModal nem expande nada", () => {
    const onOpenModal = vi.fn();
    render(
      <MetricBadge metric="ram" onOpenModal={onOpenModal}>
        <strong>--</strong>
      </MetricBadge>
    );

    fireEvent.mouseEnter(screen.getByRole("button"));
    expect(onOpenModal).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
