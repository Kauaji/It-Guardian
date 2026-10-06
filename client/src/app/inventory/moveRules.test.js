import { describe, expect, it } from "vitest";
import { isBackupMoveBlocked, moveRequestOptions, selectMachinesToMove, snapshotPreviousSegments } from "./moveRules.js";

describe("moveRules", () => {
  it("isBackupMoveBlocked bloqueia Backup disponivel salvo permissao ou uso em OS", () => {
    expect(isBackupMoveBlocked({ isBackup: true, backupStatus: "available" })).toBe(true);
    expect(isBackupMoveBlocked({ isBackup: true, backupStatus: "available" }, { allowBackupMove: true })).toBe(false);
    expect(isBackupMoveBlocked({ isBackup: true, backupStatus: "in_use" })).toBe(false);
    expect(isBackupMoveBlocked({ isBackup: false })).toBe(false);
  });

  it("selectMachinesToMove ignora ids ausentes e maquinas que ja estao no destino", () => {
    const devices = [
      { id: "a", segmentId: "s1" },
      { id: "b", segmentId: "s2" },
      { id: "c", segmentId: "s1" }
    ];
    expect(selectMachinesToMove(devices, ["a", "b", "z"], "s2").map((d) => d.id)).toEqual(["a"]);
  });

  it("snapshotPreviousSegments guarda id e nome de origem", () => {
    const map = snapshotPreviousSegments([{ id: "a", segmentId: "s1", segmentName: "Redes" }]);
    expect(map.get("a")).toEqual({ id: "s1", name: "Redes" });
  });

  it("moveRequestOptions so envia o motivo quando existe", () => {
    expect(moveRequestOptions({})).toEqual({});
    expect(moveRequestOptions({ reason: "maintenance" })).toEqual({ reason: "maintenance" });
  });
});
