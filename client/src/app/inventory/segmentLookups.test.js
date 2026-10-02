import { describe, expect, it } from "vitest";
import {
  getBackupOrigin,
  getDefaultInventorySegment,
  getRealBackupLocation,
  getServiceOrderAssetOrigin
} from "./segmentLookups.js";

const defaultSegment = { id: "seg-default", name: "Não organizadas", isDefault: true };
const redes = { id: "s1", name: "Redes", groupId: "g1" };
const lists = {
  activeSegments: [{ id: "system-backup", name: "Backup", isDefault: true, isBackupSegment: true }, redes],
  decoratedSegments: [defaultSegment, redes],
  segments: [defaultSegment, redes]
};

describe("getDefaultInventorySegment", () => {
  it("prefere o padrao da aba ativa, ignorando o segmento virtual de Backup", () => {
    expect(getDefaultInventorySegment(lists)).toBe(defaultSegment);
  });

  it("recorre as demais listas quando a aba ativa nao tem padrao", () => {
    const only = { activeSegments: [], decoratedSegments: [], segments: [defaultSegment] };
    expect(getDefaultInventorySegment(only)).toBe(defaultSegment);
    expect(getDefaultInventorySegment({ activeSegments: [], decoratedSegments: [], segments: [] })).toBeUndefined();
  });
});

describe("getBackupOrigin", () => {
  it("usa o segmento real guardado, o original do servidor ou o atual", () => {
    expect(getBackupOrigin({ backupRealSegmentId: "r", backupRealSegmentName: "Real" })).toEqual({
      originalSegmentId: "r",
      originalSegmentName: "Real"
    });
    expect(getBackupOrigin({ backupOriginalSegmentId: "o", backupOriginalSegmentName: "Orig" })).toEqual({
      originalSegmentId: "o",
      originalSegmentName: "Orig"
    });
    expect(getBackupOrigin({ segmentId: "s1", segmentName: "Redes" })).toEqual({
      originalSegmentId: "s1",
      originalSegmentName: "Redes"
    });
  });

  it("nao usa a area Backup como origem", () => {
    expect(getBackupOrigin({ segmentId: "system-backup", segmentName: "Backup" })).toEqual({
      originalSegmentId: "",
      originalSegmentName: ""
    });
  });
});

describe("getRealBackupLocation", () => {
  it("localiza o segmento original da maquina Backup", () => {
    const location = getRealBackupLocation({ backupRealSegmentId: "s1" }, lists);
    expect(location).toMatchObject({ segmentId: "s1", segmentName: "Redes", segment: redes });
  });

  it("cai no padrao quando o segmento original nao existe mais", () => {
    const location = getRealBackupLocation({ backupRealSegmentId: "sumiu", backupRealSegmentName: "Antigo" }, lists);
    expect(location).toMatchObject({ segmentId: "seg-default", segmentName: "Não organizadas", segment: defaultSegment });
  });

  it("usa o segmento atual da maquina quando nao esta na area Backup", () => {
    expect(getRealBackupLocation({ segmentId: "s1", segmentName: "Redes" }, lists).segmentId).toBe("s1");
    expect(getRealBackupLocation(undefined, { activeSegments: [], decoratedSegments: [], segments: [] })).toEqual({
      segmentId: undefined,
      segmentName: "Não organizadas",
      segment: undefined
    });
  });
});

describe("getServiceOrderAssetOrigin", () => {
  const base = {
    activeTabId: "tab-a",
    decoratedSegmentGroups: [{ id: "g1", segmentIds: ["s1"] }],
    lists,
    maintenanceRecords: {},
    order: { environmentId: "env-1" }
  };

  it("prefere a origem registrada na manutencao", () => {
    const origin = { tabId: "t", segmentId: "s1", segmentName: "Redes" };
    const result = getServiceOrderAssetOrigin({
      ...base,
      machine: { id: "m1" },
      maintenanceRecords: { m1: { origin } }
    });
    expect(result).toBe(origin);
  });

  it("ignora origem na area de Backup ou em manutencao e usa o segmento atual", () => {
    const result = getServiceOrderAssetOrigin({
      ...base,
      machine: {
        id: "m1",
        segmentId: "s1",
        segmentName: "Redes",
        tabId: "tab-b",
        maintenanceOrigin: { segmentId: "system-backup", segmentName: "Backup" }
      }
    });
    expect(result).toEqual({ tabId: "tab-b", groupId: "g1", segmentId: "s1", segmentName: "Redes" });
  });

  it("usa a aba da OS ou a ativa quando a maquina e global", () => {
    const machine = { id: "m1", segmentId: "s1", segmentName: "Redes", tabId: "global-unorganized" };
    expect(getServiceOrderAssetOrigin({ ...base, machine }).tabId).toBe("env-1");
    expect(getServiceOrderAssetOrigin({ ...base, machine, order: null }).tabId).toBe("tab-a");
  });

  it("cai no segmento padrao quando a maquina esta em manutencao", () => {
    const result = getServiceOrderAssetOrigin({
      ...base,
      machine: { id: "m1", segmentId: "m", segmentName: "Manutenção" }
    });
    expect(result).toEqual({ tabId: "env-1", groupId: "", segmentId: "seg-default", segmentName: "Não organizadas" });
  });

  it("devolve null quando nao ha nenhum segmento padrao", () => {
    const empty = { activeSegments: [], decoratedSegments: [], segments: [] };
    expect(
      getServiceOrderAssetOrigin({ ...base, lists: empty, machine: { id: "m1", segmentName: "Manutenção" } })
    ).toBeNull();
  });
});
