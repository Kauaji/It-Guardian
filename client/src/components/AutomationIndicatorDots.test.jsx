import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AutomationIndicatorDots, {
  formatAutomationIndicatorLabel,
  getVisibleAutomationIndicators,
  normalizeAutomationIndicators
} from "./AutomationIndicatorDots.jsx";

describe("normalizeAutomationIndicators", () => {
  it("remove entradas nulas/undefined e trata entrada nao-array como vazia", () => {
    expect(normalizeAutomationIndicators([{ id: "a" }, null, undefined, { id: "b" }])).toEqual([
      { id: "a" },
      { id: "b" }
    ]);
    expect(normalizeAutomationIndicators(null)).toEqual([]);
    expect(normalizeAutomationIndicators(undefined)).toEqual([]);
  });
});

describe("getVisibleAutomationIndicators", () => {
  const indicators = Array.from({ length: 6 }, (_, index) => ({ id: `plan-${index}` }));

  it("divide entre visiveis e ocultos respeitando maxVisible", () => {
    const result = getVisibleAutomationIndicators(indicators, 4);
    expect(result.visibleIndicators).toHaveLength(4);
    expect(result.hiddenIndicators).toHaveLength(2);
    expect(result.hiddenCount).toBe(2);
  });

  it("cai no padrao de 4 quando maxVisible e 0 (falsy), e usa 1 para valores negativos", () => {
    expect(getVisibleAutomationIndicators(indicators, 0).visibleIndicators).toHaveLength(4);
    expect(getVisibleAutomationIndicators(indicators, -3).visibleIndicators).toHaveLength(1);
  });
});

describe("formatAutomationIndicatorLabel", () => {
  it("monta um resumo legivel com nome, recorrencia, horario, proxima execucao e status", () => {
    const label = formatAutomationIndicatorLabel({
      planName: "Verificacao de disco",
      recurrenceType: "weekly",
      recurrenceIntervalDays: 7,
      preferredTime: "08:00",
      scriptCount: 2,
      active: true
    });
    expect(label).toContain("Verificacao de disco");
    expect(label).toContain("Semanal - 7 dia(s)");
    expect(label).toContain("08:00");
    expect(label).toContain("Scripts: 2");
    expect(label).toContain("Status: Ativo");
  });

  it("usa 'Inativo' quando active e false, e cai em textos padrao sem dados", () => {
    const label = formatAutomationIndicatorLabel({ active: false });
    expect(label).toContain("Plano preventivo");
    expect(label).toContain("Status: Inativo");
    expect(label).toContain("Não agendada");
  });
});

describe("AutomationIndicatorDots (componente)", () => {
  it("nao renderiza nada quando nao ha indicadores", () => {
    const { container } = render(<AutomationIndicatorDots indicators={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("clicar num ponto visivel chama onSelectPlan com o indicador certo", async () => {
    const user = userEvent.setup();
    const onSelectPlan = vi.fn();
    const indicator = { id: "plan-1", planName: "Backup diario", active: true };
    render(<AutomationIndicatorDots indicators={[indicator]} onSelectPlan={onSelectPlan} />);

    await user.click(screen.getByRole("button", { name: /Backup diario/ }));
    expect(onSelectPlan).toHaveBeenCalledWith(indicator);
  });

  it("mostra o botao '+N' quando ha mais indicadores que maxVisible, e abre o popover ao clicar", async () => {
    const user = userEvent.setup();
    const indicators = Array.from({ length: 5 }, (_, index) => ({ id: `plan-${index}`, planName: `Plano ${index}` }));
    render(<AutomationIndicatorDots indicators={indicators} maxVisible={2} />);

    const moreButton = screen.getByRole("button", { name: /Ver mais 3/ });
    expect(moreButton).toHaveTextContent("+3");
    expect(moreButton).toHaveAttribute("aria-expanded", "false");

    await user.click(moreButton);
    expect(moreButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Planos automatizados" })).toBeInTheDocument();
  });
});
