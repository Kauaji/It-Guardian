import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getInfrastructurePeriodRange, InfrastructureModeBar } from "./FloorPlansModule.jsx";

const baseProps = {
  mode: "normal",
  onModeChange: vi.fn(),
  metric: "availability",
  onMetricChange: vi.fn(),
  period: "30",
  onPeriodChange: vi.fn(),
  groupId: "",
  onGroupChange: vi.fn(),
  segmentId: "",
  onSegmentChange: vi.fn(),
  groups: [{ id: "g1", name: "Matriz" }],
  segments: [{ id: "s1", name: "Servidores", groupId: "g1" }],
  floor: { width: 1280, height: 820 },
  hasBackground: false,
  backgroundBusy: false,
  canUpload: true,
  canViewHeatmaps: true,
  onUpload: vi.fn(),
  onRemoveBackground: vi.fn(),
  backgroundSettings: {},
  onBackgroundSettings: vi.fn()
};

describe("Mapa de Infraestrutura", () => {
  it("expõe modos operacionais e upload sem substituir o editor atual", () => {
    render(<InfrastructureModeBar {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Calor de OS/ }));
    expect(baseProps.onModeChange).toHaveBeenCalledWith("heatmap-os");
    fireEvent.click(screen.getByRole("button", { name: /Enviar planta/ }));
    expect(baseProps.onUpload).toHaveBeenCalled();
  });

  it("oferece período, grupo, segmento e ajustes precisos do fundo", () => {
    const onBackgroundSettings = vi.fn();
    render(<InfrastructureModeBar {...baseProps} mode="heatmap-os" hasBackground backgroundSettings={{ opacity: 0.7 }} onBackgroundSettings={onBackgroundSettings} />);
    expect(screen.getByLabelText("Período do mapa de OS")).toBeInTheDocument();
    expect(screen.getByLabelText("Filtrar por grupo")).toBeInTheDocument();
    expect(screen.getByLabelText("Filtrar por segmento")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Ajustar fundo"));
    expect(screen.getByText("Opacidade")).toBeInTheDocument();
    expect(screen.getByText("Escala")).toBeInTheDocument();
  });

  it("calcula períodos mensais sem ultrapassar o mês escolhido", () => {
    const current = getInfrastructurePeriodRange("current_month");
    const previous = getInfrastructurePeriodRange("previous_month");
    expect(new Date(current.startDate).getDate()).toBe(1);
    expect(new Date(previous.startDate).getDate()).toBe(1);
    expect(new Date(previous.endDate).getDate()).toBe(1);
    expect(new Date(previous.startDate).getTime()).toBeLessThan(new Date(previous.endDate).getTime());
  });
});
