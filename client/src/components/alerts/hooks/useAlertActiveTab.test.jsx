import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useAlertActiveTab, { resolveAlertTab } from "./useAlertActiveTab.js";

const access = (overrides = {}) => ({
  canShowAutomationManagement: false,
  canUsePreventiveArea: false,
  canViewAlerts: false,
  ...overrides
});

describe("resolveAlertTab", () => {
  it("mantém a aba de automação enquanto ela está disponível", () => {
    expect(resolveAlertTab("automation", access({ canShowAutomationManagement: true }))).toBeNull();
  });

  it("sai da automação para preventivas ou sugestões, na ordem de preferência", () => {
    expect(resolveAlertTab("automation", access({ canUsePreventiveArea: true, canViewAlerts: true }))).toBe("preventives");
    expect(resolveAlertTab("automation", access({ canViewAlerts: true }))).toBe("suggestions");
    expect(resolveAlertTab("automation", access())).toBeNull();
  });

  it("sai de sugestões sem permissão de avisos quando há área preventiva", () => {
    expect(resolveAlertTab("suggestions", access({ canUsePreventiveArea: true }))).toBe("preventives");
    expect(resolveAlertTab("suggestions", access())).toBeNull();
    expect(resolveAlertTab("suggestions", access({ canViewAlerts: true }))).toBeNull();
  });

  it("sai de preventivas sem a área preventiva quando pode ver avisos", () => {
    expect(resolveAlertTab("preventives", access({ canViewAlerts: true }))).toBe("suggestions");
    expect(resolveAlertTab("preventives", access({ canUsePreventiveArea: true, canViewAlerts: true }))).toBeNull();
    expect(resolveAlertTab("preventives", access())).toBeNull();
  });

  it("não altera abas desconhecidas", () => {
    expect(resolveAlertTab("history", access())).toBeNull();
    expect(resolveAlertTab("active", access({ canViewAlerts: true }))).toBeNull();
  });
});

describe("useAlertActiveTab", () => {
  it("começa em sugestões e permite navegar", () => {
    const { result } = renderHook(() => useAlertActiveTab(access({ canViewAlerts: true, canUsePreventiveArea: true })));

    expect(result.current[0]).toBe("suggestions");
    act(() => result.current[1]("preventives"));
    expect(result.current[0]).toBe("preventives");
  });

  it("começa em preventivas quando o usuário não vê avisos", async () => {
    const { result } = renderHook(() => useAlertActiveTab(access({ canUsePreventiveArea: true })));

    await waitFor(() => expect(result.current[0]).toBe("preventives"));
  });

  it("volta para preventivas quando a automação deixa de estar disponível", async () => {
    const { result, rerender } = renderHook((props) => useAlertActiveTab(props), {
      initialProps: access({ canViewAlerts: true, canUsePreventiveArea: true, canShowAutomationManagement: true })
    });

    act(() => result.current[1]("automation"));
    expect(result.current[0]).toBe("automation");
    rerender(access({ canViewAlerts: true, canUsePreventiveArea: true, canShowAutomationManagement: false }));

    await waitFor(() => expect(result.current[0]).toBe("preventives"));
  });
});
