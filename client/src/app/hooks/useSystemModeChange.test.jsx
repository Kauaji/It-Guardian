import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateSystemSettings } from "../../api.js";
import { createSession, dataSliceWrapper } from "../../test/appHarness.jsx";
import { useSystemModeChange } from "./useSystemModeChange.js";

vi.mock("../../api.js", () => ({ updateSystemSettings: vi.fn() }));

function setup(systemMode = "local") {
  const session = createSession();
  const data = { setSystemMode: vi.fn(), systemMode };
  const { result } = renderHook(() => useSystemModeChange(), { wrapper: dataSliceWrapper(session, data) });
  return { data, result, session };
}

describe("useSystemModeChange", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aplica o modo Business na hora e confirma com o valor salvo no servidor", async () => {
    updateSystemSettings.mockResolvedValue({ settings: { systemMode: "business" } });
    const { data, result, session } = setup();
    await act(async () => {
      await result.current("business");
    });
    expect(data.setSystemMode.mock.calls.map((call) => call[0])).toEqual(["business", "business"]);
    expect(updateSystemSettings).toHaveBeenCalledWith("token-1", { systemMode: "business" });
    expect(session.notify).toHaveBeenCalledWith("Modo Business ativado.", "ok");
  });

  it("qualquer valor diferente de business vira Local e usa o modo devolvido pelo servidor", async () => {
    updateSystemSettings.mockResolvedValue({ settings: { systemMode: "local" } });
    const { data, result, session } = setup("business");
    await act(async () => {
      await result.current("qualquer");
    });
    expect(data.setSystemMode.mock.calls[0][0]).toBe("local");
    expect(session.notify).toHaveBeenCalledWith("Modo Local ativado.", "ok");
  });

  it("volta ao modo anterior e avisa quando o servidor recusa", async () => {
    updateSystemSettings.mockRejectedValue(new Error("sem permissao"));
    const { data, result, session } = setup("local");
    await act(async () => {
      await result.current("business");
    });
    expect(data.setSystemMode.mock.calls.map((call) => call[0])).toEqual(["business", "local"]);
    expect(session.notify).toHaveBeenCalledWith("sem permissao", "danger");
  });
});
