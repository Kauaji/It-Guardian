import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api.js", () => ({
  fetchDeviceMetricHistory: vi.fn()
}));

import { fetchDeviceMetricHistory } from "../../../api.js";
import { clearMetricHistoryCache } from "./metricHistoryCache.js";
import MetricBadge from "./MetricBadge.jsx";

afterEach(() => {
  vi.clearAllMocks();
  clearMetricHistoryCache();
});

describe("MetricBadge", () => {
  it("mostra o valor atual sem nenhuma chamada a API enquanto nao ha hover/clique", () => {
    render(
      <MetricBadge metric="cpu" deviceId="device-1" token="tok" onOpenModal={vi.fn()}>
        <strong className="ok">42%</strong>
      </MetricBadge>
    );

    expect(screen.getByText("42%")).toBeTruthy();
    expect(fetchDeviceMetricHistory).not.toHaveBeenCalled();
  });

  it("hover busca o historico de 24h e mostra o resumo no popover", async () => {
    fetchDeviceMetricHistory.mockResolvedValue({
      summary: { current: 42, average: 30, min: 10, max: 60, samples: 12, lastCollectedAt: "2026-08-23T10:00:00.000Z" },
      points: [],
      warnings: []
    });

    render(
      <MetricBadge metric="cpu" deviceId="device-1" token="tok" onOpenModal={vi.fn()}>
        <strong className="ok">42%</strong>
      </MetricBadge>
    );

    fireEvent.mouseEnter(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByText(/Media 24h/)).toBeTruthy());
    expect(screen.getByText("30%")).toBeTruthy();
    expect(fetchDeviceMetricHistory).toHaveBeenCalledWith("tok", "device-1", { metric: "cpu", period: "24h" }, expect.any(Object));
  });

  it("mostra mensagem de sem historico quando a API devolve summary nulo", async () => {
    fetchDeviceMetricHistory.mockResolvedValue({ summary: null, points: [], warnings: ["no_data"] });

    render(
      <MetricBadge metric="ram" deviceId="device-2" token="tok" onOpenModal={vi.fn()}>
        <strong>--</strong>
      </MetricBadge>
    );

    fireEvent.mouseEnter(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText(/Sem historico suficiente/)).toBeTruthy());
  });

  it("clique chama onOpenModal com a metrica, sem esperar o hover", () => {
    const onOpenModal = vi.fn();
    render(
      <MetricBadge metric="disk" deviceId="device-1" token="tok" onOpenModal={onOpenModal}>
        <strong>50%</strong>
      </MetricBadge>
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onOpenModal).toHaveBeenCalledWith("disk");
  });
});
