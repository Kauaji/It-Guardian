import { describe, expect, it } from "vitest";
import {
  canShowRemoteAssistanceAction,
  formatBytesPerSecond,
  formatFrameSize,
  formatRemoteMonitor,
  getRemoteAssetDisplayName,
  getRemoteAssetLastSeenAt,
  hasRemoteAssistanceAgent,
  isRemoteAssistanceAssetFresh,
  isRemoteAssistanceFrameStale,
  isRemoteAssistanceFrontendEnabled,
  isRemoteAssistanceTerminal,
  remoteAssistanceStatusLabel,
  remoteAssistanceTransportLabel
} from "./remoteAssistanceModel.js";

describe("isRemoteAssistanceFrontendEnabled", () => {
  it("so habilita com a string exata 'true'", () => {
    expect(isRemoteAssistanceFrontendEnabled({ VITE_ENABLE_REMOTE_ASSISTANCE: "true" })).toBe(true);
    expect(isRemoteAssistanceFrontendEnabled({ VITE_ENABLE_REMOTE_ASSISTANCE: "1" })).toBe(false);
    expect(isRemoteAssistanceFrontendEnabled({})).toBe(false);
    expect(isRemoteAssistanceFrontendEnabled(undefined)).toBe(false);
  });
});

describe("canShowRemoteAssistanceAction", () => {
  it("exige todas as condicoes verdadeiras ao mesmo tempo", () => {
    const allTrue = {
      frontendEnabled: true,
      canView: true,
      canStart: true,
      eligible: true,
      backendEnabled: true
    };
    expect(canShowRemoteAssistanceAction(allTrue)).toBe(true);
    for (const key of Object.keys(allTrue)) {
      expect(canShowRemoteAssistanceAction({ ...allTrue, [key]: false })).toBe(false);
    }
  });
});

describe("hasRemoteAssistanceAgent / getRemoteAssetLastSeenAt", () => {
  it("reconhece um ativo do agente por qualquer um dos sinais", () => {
    expect(hasRemoteAssistanceAgent({ source: "agent" })).toBe(true);
    expect(hasRemoteAssistanceAgent({ agentVersion: "1.6.1" })).toBe(true);
    expect(hasRemoteAssistanceAgent({ dataSources: ["agent"] })).toBe(true);
    expect(hasRemoteAssistanceAgent({ dataSources: ["ocs"] })).toBe(false);
    expect(hasRemoteAssistanceAgent(null)).toBe(false);
  });

  it("prioriza lastSeenAt, depois agent.lastSeenAt, depois collectedAt", () => {
    expect(getRemoteAssetLastSeenAt({ lastSeenAt: "a", agent: { lastSeenAt: "b" }, collectedAt: "c" })).toBe("a");
    expect(getRemoteAssetLastSeenAt({ agent: { lastSeenAt: "b" }, collectedAt: "c" })).toBe("b");
    expect(getRemoteAssetLastSeenAt({ collectedAt: "c" })).toBe("c");
    expect(getRemoteAssetLastSeenAt({})).toBeNull();
  });
});

describe("isRemoteAssistanceAssetFresh", () => {
  const now = Date.parse("2026-08-15T12:00:00.000Z");

  it("e falso sem sinal de agente, mesmo com heartbeat recente", () => {
    expect(isRemoteAssistanceAssetFresh({ lastSeenAt: "2026-08-15T11:59:00.000Z" }, now)).toBe(false);
  });

  it("e falso quando lastSeenAt nao e uma data valida", () => {
    expect(
      isRemoteAssistanceAssetFresh({ source: "agent", lastSeenAt: "nao-e-data" }, now)
    ).toBe(false);
  });

  it("respeita a janela de 3x o intervalo do agente, com piso de 10 minutos", () => {
    const fresh = { source: "agent", lastSeenAt: "2026-08-15T11:58:00.000Z", agentIntervalSeconds: 60 };
    expect(isRemoteAssistanceAssetFresh(fresh, now)).toBe(true);

    const stale = { source: "agent", lastSeenAt: "2026-08-15T11:00:00.000Z", agentIntervalSeconds: 60 };
    expect(isRemoteAssistanceAssetFresh(stale, now)).toBe(false);
  });
});

describe("isRemoteAssistanceTerminal", () => {
  it("reconhece exatamente os quatro status terminais", () => {
    for (const status of ["consent_denied", "ended", "failed", "expired"]) {
      expect(isRemoteAssistanceTerminal(status)).toBe(true);
    }
    for (const status of ["requested", "active", "connecting", undefined, null]) {
      expect(isRemoteAssistanceTerminal(status)).toBe(false);
    }
  });
});

describe("remoteAssistanceStatusLabel", () => {
  it("traduz status conhecidos e cai em um texto padrao para os demais", () => {
    expect(remoteAssistanceStatusLabel("active")).toBe("Atendimento em andamento");
    expect(remoteAssistanceStatusLabel("unknown-status")).toBe("Preparando atendimento");
  });
});

describe("formatRemoteMonitor", () => {
  it("monta nome, resolucao e sufixo de monitor principal", () => {
    expect(formatRemoteMonitor({ name: "Dell", width: 1920, height: 1080, primary: true }, 0)).toBe(
      "Dell - 1920x1080 - Principal"
    );
    expect(formatRemoteMonitor({ width: 800, height: 600 }, 1)).toBe("Monitor 2 - 800x600");
  });
});

describe("getRemoteAssetDisplayName", () => {
  it("segue a prioridade alias > asset.alias > displayName > name > hostname > fallback", () => {
    expect(getRemoteAssetDisplayName({ hostname: "PC-01" }, "Meu Alias")).toBe("Meu Alias");
    expect(getRemoteAssetDisplayName({ alias: "Alias do ativo", hostname: "PC-01" })).toBe("Alias do ativo");
    expect(getRemoteAssetDisplayName({})).toBe("Maquina");
  });
});

describe("remoteAssistanceTransportLabel", () => {
  it("distingue webrtc do transporte padrao", () => {
    expect(remoteAssistanceTransportLabel("webrtc")).toBe("WebRTC");
    expect(remoteAssistanceTransportLabel("http")).toBe("Snapshot seguro (HTTP)");
    expect(remoteAssistanceTransportLabel(undefined)).toBe("Snapshot seguro (HTTP)");
  });
});

describe("formatBytesPerSecond / formatFrameSize", () => {
  it("escolhe a unidade certa (B, KB, MB) para taxa de transferencia", () => {
    expect(formatBytesPerSecond(512)).toBe("512 B/s");
    expect(formatBytesPerSecond(2048)).toBe("2.0 KB/s");
    expect(formatBytesPerSecond(5 * 1024 * 1024)).toBe("5.0 MB/s");
  });

  it("escolhe a unidade certa (B, KB, MB) para tamanho de quadro", () => {
    expect(formatFrameSize(500)).toBe("500 B");
    expect(formatFrameSize(1536)).toBe("1.5 KB");
    expect(formatFrameSize(3 * 1024 * 1024)).toBe("3.00 MB");
  });
});

describe("isRemoteAssistanceFrameStale", () => {
  it("considera obsoleto quando a idade do quadro passa de 4x o poll do viewer", () => {
    expect(isRemoteAssistanceFrameStale({ frameAgeMs: 2000 }, 1000)).toBe(false);
    expect(isRemoteAssistanceFrameStale({ frameAgeMs: 5000 }, 1000)).toBe(true);
  });

  it("nunca marca como obsoleto quando a metrica nao e um numero finito", () => {
    expect(isRemoteAssistanceFrameStale({}, 1000)).toBe(false);
    expect(isRemoteAssistanceFrameStale({ frameAgeMs: "n/a" }, 1000)).toBe(false);
  });
});
