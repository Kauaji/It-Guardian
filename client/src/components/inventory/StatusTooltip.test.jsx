import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StatusTooltip from "./StatusTooltip.jsx";

describe("StatusTooltip", () => {
  it("hover numa maquina offline mostra o ultimo contato", () => {
    render(
      <StatusTooltip status="offline" lastSeenAt="2026-08-20T10:00:00.000Z">
        <span className="status-dot offline">Offline</span>
      </StatusTooltip>
    );

    fireEvent.mouseEnter(screen.getByText("Offline").closest(".status-tooltip-trigger"));

    expect(screen.getByText("Maquina offline")).toBeTruthy();
    expect(screen.getByText(/Ultimo contato:/)).toBeTruthy();
  });

  it("nunca inventa um timestamp quando lastSeenAt e null", () => {
    render(
      <StatusTooltip status="unknown" lastSeenAt={null}>
        <span className="status-dot unknown">Sem dados</span>
      </StatusTooltip>
    );

    fireEvent.mouseEnter(screen.getByText("Sem dados").closest(".status-tooltip-trigger"));

    expect(screen.getByText("Sem historico de contato disponivel.")).toBeTruthy();
    expect(screen.queryByText(/Ultimo contato:/)).toBeNull();
  });

  it("maquina online mostra a mensagem de status online", () => {
    render(
      <StatusTooltip status="online" lastSeenAt="2026-08-23T10:00:00.000Z">
        <span className="status-dot online">Online</span>
      </StatusTooltip>
    );

    fireEvent.mouseEnter(screen.getByText("Online").closest(".status-tooltip-trigger"));
    expect(screen.getByText("Maquina online")).toBeTruthy();
  });
});
