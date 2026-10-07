import { describe, expect, it } from "vitest";
import {
  buildBackupSegment,
  buildSearchSegments,
  decorateDevices,
  decorateSegmentGroups,
  decorateSegments,
  filterInventoryDevices,
  findSegmentById,
  readItemOrder,
  readItemTabId,
  selectActiveSegments
} from "./inventoryModel.js";

const meta = {
  groups: { g1: { tabId: "tab-b", order: 5 } },
  segments: { s1: { tabId: "tab-b", order: 2 }, s2: { order: 0 } },
  devices: { d1: { tabId: "tab-b", order: 7 } }
};

describe("leitura de metadado local", () => {
  it("usa a aba de fallback e a ordem informada quando nao ha metadado", () => {
    expect(readItemTabId({}, "groups", "x", "tab-a")).toBe("tab-a");
    expect(readItemTabId(meta, "groups", "g1", "tab-a")).toBe("tab-b");
    expect(readItemOrder({}, "groups", "x", 3)).toBe(3);
    expect(readItemOrder(meta, "groups", "g1", 3)).toBe(5);
  });
});

describe("decorateSegmentGroups / decorateSegments", () => {
  it("anexa aba e ordem e ordena pela ordem local", () => {
    const groups = decorateSegmentGroups([{ id: "g1" }, { id: "g2" }], meta, "tab-a");
    expect(groups.map((group) => [group.id, group.tabId, group.order])).toEqual([
      ["g2", "tab-a", 1],
      ["g1", "tab-b", 5]
    ]);
  });

  it("compartilha entre abas os segmentos padrao e o de manutencao", () => {
    const segments = decorateSegments(
      [
        { id: "s1", name: "Redes" },
        { id: "s2", name: "Não organizadas", isDefault: true },
        { id: "s3", name: "Manutenção" }
      ],
      meta,
      "tab-a"
    );
    const byId = Object.fromEntries(segments.map((segment) => [segment.id, segment]));
    expect(byId.s1.tabId).toBe("tab-b");
    expect(byId.s2.tabId).toBe("shared");
    expect(byId.s3.tabId).toBe("shared");
    expect(segments[0].id).toBe("s2");
  });
});

describe("decorateDevices", () => {
  const base = {
    defaultSegmentIds: new Set(["seg-default"]),
    fallbackTabId: "tab-a",
    machineAliases: { d2: "  Caixa 1  " },
    meta
  };

  it("resolve nome de exibicao pelo apelido local antes dos nomes do agente", () => {
    const [d1, d2] = decorateDevices(
      [
        { id: "d1", name: "PC-01", segmentId: "s1", segmentName: "Redes" },
        { id: "d2", hostname: "HOST-2", segmentId: "s1", segmentName: "Redes" }
      ],
      base
    );
    expect(d1).toMatchObject({ displayName: "PC-01", technicalName: "PC-01", tabId: "tab-b", order: 7 });
    expect(d2).toMatchObject({ displayName: "Caixa 1", technicalName: "HOST-2", tabId: "tab-a", order: 1 });
  });

  it("move reservas disponiveis para o segmento virtual Backup", () => {
    const [device] = decorateDevices(
      [{ id: "b1", isBackup: true, backupStatus: "available", segmentId: "s1", segmentName: "Redes" }],
      base
    );
    expect(device).toMatchObject({
      segmentId: "system-backup",
      segmentName: "Backup",
      tabId: "global-backup",
      isGlobalBackup: true,
      backupRealSegmentId: "s1"
    });
  });

  it("mantem reserva em uso no segmento real e marca nao organizados como globais", () => {
    const [inUse, unorganized] = decorateDevices(
      [
        { id: "b2", isBackup: true, backupStatus: "in_use", segmentId: "s1", segmentName: "Redes" },
        { id: "u1", segmentId: "seg-default", segmentName: "Não organizadas" }
      ],
      base
    );
    expect(inUse).toMatchObject({ segmentId: "s1", isGlobalBackup: false });
    expect(unorganized).toMatchObject({ tabId: "global-unorganized", isGlobalUnorganized: true });
  });
});

describe("segmentos ativos", () => {
  const decoratedSegments = [
    { id: "default", isDefault: true, name: "Não organizadas", tabId: "shared" },
    { id: "s1", name: "Redes", tabId: "tab-a" },
    { id: "s2", name: "Outra aba", tabId: "tab-b" },
    { id: "m1", name: "Manutenção", tabId: "shared" }
  ];

  it("so cria o segmento Backup quando ha ativo reserva", () => {
    expect(buildBackupSegment([{ id: "x" }])).toEqual([]);
    expect(buildBackupSegment([{ id: "x", isBackup: true }])[0]).toMatchObject({
      id: "system-backup",
      isBackupSegment: true
    });
  });

  it("filtra por aba, oculta manutencao vazia e padrao sem maquinas", () => {
    const empty = selectActiveSegments({
      activeTabId: "tab-a",
      decoratedAllDevices: [],
      decoratedSegments,
      occupiedSegmentIds: new Set()
    });
    expect(empty.map((segment) => segment.id)).toEqual(["s1"]);

    const populated = selectActiveSegments({
      activeTabId: "tab-a",
      decoratedAllDevices: [
        { id: "d", segmentId: "default" },
        { id: "k", segmentId: "x", isBackup: true }
      ],
      decoratedSegments,
      occupiedSegmentIds: new Set(["m1"])
    });
    expect(populated.map((segment) => segment.id)).toEqual(["system-backup", "default", "s1", "m1"]);
  });

  it("na busca mostra todos os segmentos de todas as abas", () => {
    expect(buildSearchSegments([], decoratedSegments)).toHaveLength(4);
    expect(buildSearchSegments([{ isBackup: true }], decoratedSegments)[0].id).toBe("system-backup");
  });
});

describe("filterInventoryDevices", () => {
  const devices = [
    { id: "d1", name: "Servidor", ip: "10.0.0.1", segmentId: "s1", tabId: "tab-a", hardware: { os: "Windows 11" } },
    { id: "d2", name: "Notebook", segmentId: "s2", tabId: "tab-z", isGlobalBackup: true },
    { id: "d3", name: "Impressora", segmentId: "s1", tabId: "tab-a", manualAsset: { brand: "HP" } }
  ];
  const lookups = {
    devices,
    groupById: new Map([["g1", { id: "g1", name: "Matriz" }]]),
    groups: [{ id: "g1", segmentIds: ["s2"] }],
    machineAliases: { d2: "Caixa" },
    segmentById: new Map([
      ["s1", { id: "s1", name: "Redes", groupId: "g1" }],
      ["s2", { id: "s2", name: "Caixas" }]
    ]),
    tabById: new Map([["tab-a", { id: "tab-a", name: "Escritorio" }]])
  };

  it("sem termo devolve uma copia da lista", () => {
    const result = filterInventoryDevices({ ...lookups, searchTerm: "  " });
    expect(result).toEqual(devices);
    expect(result).not.toBe(devices);
  });

  it("encontra por nome, IP, hardware, marca e apelido ignorando maiusculas", () => {
    const ids = (term) => filterInventoryDevices({ ...lookups, searchTerm: term }).map((item) => item.id);
    expect(ids("SERVIDOR")).toEqual(["d1"]);
    expect(ids("10.0.0")).toEqual(["d1"]);
    expect(ids("windows")).toEqual(["d1"]);
    expect(ids("hp")).toEqual(["d3"]);
    expect(ids("caixa")).toEqual(["d2"]);
  });

  it("encontra pelo nome do grupo, do segmento e da aba, e informa a aba do achado", () => {
    const byGroup = filterInventoryDevices({ ...lookups, searchTerm: "matriz" });
    // d1/d3 pelo groupId do segmento; d2 pela lista segmentIds do grupo.
    expect(byGroup.map((item) => item.id)).toEqual(["d1", "d2", "d3"]);
    expect(byGroup[0].inventorySearchTabName).toBe("Escritorio");

    const backup = filterInventoryDevices({ ...lookups, searchTerm: "notebook" });
    expect(backup[0].inventorySearchTabName).toBe("Backup");
  });

  it("devolve vazio quando nada corresponde", () => {
    expect(filterInventoryDevices({ ...lookups, searchTerm: "zzz" })).toEqual([]);
  });
});

describe("findSegmentById", () => {
  it("procura nas listas na ordem informada", () => {
    const first = [{ id: "a", from: "first" }];
    const second = [
      { id: "a", from: "second" },
      { id: "b", from: "second" }
    ];
    expect(findSegmentById("a", first, second).from).toBe("first");
    expect(findSegmentById("b", first, second).from).toBe("second");
    expect(findSegmentById("c", first, second)).toBeUndefined();
  });
});
