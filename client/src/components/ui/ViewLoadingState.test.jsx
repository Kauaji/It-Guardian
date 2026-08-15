import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ViewLoadingState from "./ViewLoadingState.jsx";

describe("ViewLoadingState", () => {
  it("expõe o estado de carregamento para leitores de tela", () => {
    render(<ViewLoadingState />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Carregando...");
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
