import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateDeviceBackup } from "../../api.js";
import { createSession, sessionWrapper } from "../../test/appHarness.jsx";
import { useBackupActions } from "./useBackupActions.js";

vi.mock("../../api.js", () => ({ updateDeviceBackup: vi.fn() }));

const machine = { id: "d1", name: "PC-01", segmentId: "s1", segmentName: "Redes" };

function setup(selectedAssets = []) {
  const session = createSession();
  const deps = {
    data: { loadData: vi.fn().mockResolvedValue() },
    deviceState: { upsertDeviceInState: vi.fn() },
    inventory: { selection: { clearAssetSelection: vi.fn(), selectedAssets } }
  };
  const { result } = renderHook(() => useBackupActions(deps), { wrapper: sessionWrapper(session) });
  return { ...deps, result, session };
}

describe("useBackupActions.handleToggleBackup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("nao faz nada sem maquina", async () => {
    const { result } = setup();
    expect(await result.current.handleToggleBackup(null)).toBe(false);
  });

  it("nao deixa remover o Backup enquanto ele esta em uso por uma OS", async () => {
    const { result, session } = setup();
    const inUse = { ...machine, isBackup: true, backupStatus: "in_use" };
    expect(await result.current.handleToggleBackup(inUse, false)).toBe(false);
    expect(session.notify).toHaveBeenCalledWith(expect.stringContaining("em uso por uma OS"), "danger");
    expect(updateDeviceBackup).not.toHaveBeenCalled();
  });

  it("marca como Backup guardando o segmento de origem", async () => {
    updateDeviceBackup.mockResolvedValue({ device: { ...machine, isBackup: true } });
    const { result, deviceState, data, session } = setup();

    let ok;
    await act(async () => {
      ok = await result.current.handleToggleBackup(machine);
    });

    expect(ok).toBe(true);
    expect(updateDeviceBackup).toHaveBeenCalledWith("token-1", "d1", {
      isBackup: true,
      status: "available",
      originalSegmentId: "s1",
      originalSegmentName: "Redes"
    });
    expect(deviceState.upsertDeviceInState).toHaveBeenCalled();
    expect(session.notify).toHaveBeenCalledWith("PC-01 marcada como Backup.", "ok");
    expect(data.loadData).toHaveBeenCalledWith(true);
  });

  it("remove da area de Backup quando o estado desejado e falso", async () => {
    updateDeviceBackup.mockResolvedValue({ device: machine });
    const { result, session } = setup();
    await act(async () => {
      await result.current.handleToggleBackup({ ...machine, isBackup: true }, false);
    });
    expect(session.notify).toHaveBeenCalledWith("PC-01 removida da área de Backup.", "ok");
  });

  it("avisa quando a API falha", async () => {
    updateDeviceBackup.mockRejectedValue(new Error("erro"));
    const { result, session } = setup();
    expect(await result.current.handleToggleBackup(machine)).toBe(false);
    expect(session.notify).toHaveBeenCalledWith("erro", "danger");
  });
});

describe("useBackupActions.handleBulkMarkBackup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("avisa e limpa a selecao quando todos ja sao Backup", async () => {
    const { result, inventory, session } = setup([{ ...machine, isBackup: true }]);
    expect(await result.current.handleBulkMarkBackup()).toBe(false);
    expect(session.notify).toHaveBeenCalledWith(expect.stringContaining("já estão marcadas"), "ok");
    expect(inventory.selection.clearAssetSelection).toHaveBeenCalled();
  });

  it("marca so os que ainda nao sao Backup", async () => {
    updateDeviceBackup.mockResolvedValue({});
    const { result, data, session } = setup([machine, { ...machine, id: "d2" }, { ...machine, id: "d3", isBackup: true }]);
    let ok;
    await act(async () => {
      ok = await result.current.handleBulkMarkBackup();
    });
    expect(ok).toBe(true);
    expect(updateDeviceBackup).toHaveBeenCalledTimes(2);
    expect(session.notify).toHaveBeenCalledWith("2 máquinas marcadas como Backup.", "ok");
    expect(data.loadData).toHaveBeenCalledWith(true);
  });

  it("avisa quando alguma gravacao falha", async () => {
    updateDeviceBackup.mockRejectedValue(new Error("falhou"));
    const { result, session } = setup([machine]);
    expect(await result.current.handleBulkMarkBackup()).toBe(false);
    expect(session.notify).toHaveBeenCalledWith("falhou", "danger");
  });
});
