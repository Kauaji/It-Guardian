import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AlertTriangle } from "lucide-react";
import SummaryCard from "./SummaryCard.jsx";

describe("SummaryCard", () => {
  it("renderiza icone, label e valor recebidos por props", () => {
    const { container } = render(<SummaryCard icon={AlertTriangle} label="Alertas criticos" value={7} tone="danger" />);

    expect(screen.getByText("Alertas criticos")).toBeInTheDocument();
    expect(container.querySelector("strong")).toHaveTextContent("7");
  });

  it("aplica a classe de tone recebida ao container", () => {
    const { container } = render(<SummaryCard icon={AlertTriangle} label="X" value={1} tone="danger" />);
    expect(container.querySelector("article")).toHaveClass("summary-card", "danger");
  });

  it("nao quebra quando tone esta ausente", () => {
    const { container } = render(<SummaryCard icon={AlertTriangle} label="X" value={1} />);
    expect(container.querySelector("article")).toHaveClass("summary-card");
  });
});
