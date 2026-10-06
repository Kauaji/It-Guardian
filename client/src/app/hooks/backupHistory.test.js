import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBackupHistoryEvent } from "./backupHistory.js";

describe("buildBackupHistoryEvent", () => {
  afterEach(() => vi.useRealTimers());

  it("monta o evento de backup com id e data do momento", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
    expect(
      buildBackupHistoryEvent({
        machineId: "d1",
        key: "backup-return",
        userName: "Ana",
        message: "m",
        oldValue: "a",
        newValue: "b"
      })
    ).toEqual({
      id: `d1-backup-return-${new Date("2026-10-01T12:00:00Z").getTime()}`,
      createdAt: "2026-10-01T12:00:00.000Z",
      userName: "Ana",
      eventType: "backup",
      message: "m",
      oldValue: "a",
      newValue: "b"
    });
  });
});
