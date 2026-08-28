import { describe, expect, it } from "vitest";
import {
  buildHierarchyTree,
  compareStatusSeverity,
  computeGroupStatus,
  computeSegmentStatus,
  computeTabStatus,
  groupDevicesBySegment,
  summarizeGroup,
  summarizeSegment
} from "./networkTopologyHierarchy.js";

describe("computeSegmentStatus", () => {
  it("sem ativos, cai em sem_dados", () => {
    expect(computeSegmentStatus([])).toBe("sem_dados");
  });

  it("algum ativo com problema, o segmento fica critico", () => {
    expect(computeSegmentStatus([{ status: "online" }, { status: "problem" }])).toBe("critico");
  });

  it("algum ativo offline (sem problema), o segmento fica em atencao", () => {
    expect(computeSegmentStatus([{ status: "online" }, { status: "offline" }])).toBe("atencao");
  });

  it("todos online, o segmento fica online", () => {
    expect(computeSegmentStatus([{ status: "online" }, { status: "online" }])).toBe("online");
  });

  it("status desconhecido/misturado sem offline nem problema, cai em sem_dados - nunca inventa", () => {
    expect(computeSegmentStatus([{ status: "online" }, { status: "unknown" }])).toBe("sem_dados");
  });
});

describe("computeGroupStatus / computeTabStatus", () => {
  it("sem filhos, cai em sem_dados", () => {
    expect(computeGroupStatus([])).toBe("sem_dados");
    expect(computeTabStatus([])).toBe("sem_dados");
  });

  it("todos os filhos com o mesmo status, herda esse status", () => {
    expect(computeGroupStatus(["online", "online"])).toBe("online");
  });

  it("algum filho critico, o container fica critico independente dos outros", () => {
    expect(computeGroupStatus(["online", "critico", "atencao"])).toBe("critico");
  });

  it("filhos discordando sem nenhum critico, o container fica misto", () => {
    expect(computeGroupStatus(["online", "atencao"])).toBe("misto");
    expect(computeTabStatus(["sem_dados", "online"])).toBe("misto");
  });
});

describe("compareStatusSeverity", () => {
  it("critico e mais severo que online", () => {
    expect(compareStatusSeverity("critico", "online")).toBeLessThan(0);
  });
});

describe("groupDevicesBySegment", () => {
  it("agrupa ativos pelo segmentId, ignorando ativos sem segmento", () => {
    const devices = [
      { id: "d1", segmentId: "s1", status: "online" },
      { id: "d2", segmentId: "s1", status: "offline" },
      { id: "d3", segmentId: "s2", status: "online" },
      { id: "d4", segmentId: null, status: "online" }
    ];
    const bySegment = groupDevicesBySegment(devices);
    expect(bySegment.get("s1")).toHaveLength(2);
    expect(bySegment.get("s2")).toHaveLength(1);
    expect(bySegment.has(null)).toBe(false);
  });
});

describe("summarizeSegment", () => {
  it("conta ativos online/offline/criticos e deriva o status agregado", () => {
    const devicesBySegment = groupDevicesBySegment([
      { id: "d1", segmentId: "s1", status: "online" },
      { id: "d2", segmentId: "s1", status: "problem" }
    ]);
    const summary = summarizeSegment({ id: "s1", name: "Financeiro", groupId: "g1" }, devicesBySegment);
    expect(summary.deviceCount).toBe(2);
    expect(summary.onlineCount).toBe(1);
    expect(summary.criticalCount).toBe(1);
    expect(summary.status).toBe("critico");
  });
});

describe("summarizeGroup", () => {
  const segments = [
    { id: "s1", name: "Atendimento", groupId: "g1" },
    { id: "s2", name: "Caixa", groupId: "g1" },
    { id: "s3", name: "RH", groupId: "g2" }
  ];
  const devicesBySegment = groupDevicesBySegment([
    { id: "d1", segmentId: "s1", status: "online" },
    { id: "d2", segmentId: "s2", status: "offline" }
  ]);

  it("so inclui segmentos cujo groupId bate com o grupo (relacao real do banco)", () => {
    const summary = summarizeGroup({ id: "g1", name: "Recepcao" }, segments, devicesBySegment);
    expect(summary.segments.map((segment) => segment.id)).toEqual(["s1", "s2"]);
    expect(summary.segmentCount).toBe(2);
  });

  it("soma os ativos de todos os segmentos do grupo", () => {
    const summary = summarizeGroup({ id: "g1", name: "Recepcao" }, segments, devicesBySegment);
    expect(summary.deviceCount).toBe(2);
  });

  it("status do grupo agrega o status dos segmentos (misto quando discordam)", () => {
    const summary = summarizeGroup({ id: "g1", name: "Recepcao" }, segments, devicesBySegment);
    // s1 = online (1 ativo online), s2 = atencao (1 ativo offline) -> misto
    expect(summary.status).toBe("misto");
  });

  it("grupo sem nenhum segmento seu, fica com 0 e sem_dados", () => {
    const summary = summarizeGroup({ id: "g-vazio", name: "Vazio" }, segments, devicesBySegment);
    expect(summary.segmentCount).toBe(0);
    expect(summary.status).toBe("sem_dados");
  });
});

describe("buildHierarchyTree", () => {
  it("mantém manutenção independente sem alterar a associação armazenada", () => {
    const groups = [{ id: "g1", name: "Recepção" }];
    const segments = [
      { id: "s1", name: "Atendimento", groupId: "g1" },
      { id: "m1", name: "Manutenção", groupId: "g1" },
      { id: "m2", name: "Manutencao", groupId: "" }
    ];
    const devices = [
      { id: "d1", segmentId: "s1", status: "online" },
      { id: "d2", segmentId: "m1", status: "problem" },
      { id: "d3", segmentId: "m2", status: "offline" }
    ];
    const tree = buildHierarchyTree({ groups, segments, devices });
    expect(tree.groups[0].segments.map((segment) => segment.id)).toEqual(["s1"]);
    expect(tree.groups[0].deviceCount).toBe(1);
    expect(tree.groups[0].status).toBe("online");
    expect(tree.ungroupedSegments).toEqual([]);
    expect(tree.maintenanceSegments.map((segment) => segment.id)).toEqual(["m1", "m2"]);
    expect(tree.maintenanceSegments.every((segment) => segment.groupId === null)).toBe(true);
    expect(tree.deviceCount).toBe(3);
    expect(tree.segmentCount).toBe(3);
    expect(tree.tabStatus).toBe("critico");
    expect(segments[1].groupId).toBe("g1");
  });

  it("não perde ativos se o grupo do segmento já não está disponível", () => {
    const tree = buildHierarchyTree({
      segments: [{ id: "s1", name: "Laboratório", groupId: "grupo-antigo" }],
      devices: [{ id: "d1", segmentId: "s1", status: "online" }]
    });
    expect(tree.ungroupedSegments[0].id).toBe("s1");
    expect(tree.deviceCount).toBe(1);
  });

  it("monta grupos com seus segmentos e separa segmentos sem grupo", () => {
    const groups = [{ id: "g1", name: "Recepcao" }];
    const segments = [
      { id: "s1", name: "Atendimento", groupId: "g1" },
      { id: "s2", name: "Solta", groupId: "" }
    ];
    const devices = [
      { id: "d1", segmentId: "s1", status: "online" },
      { id: "d2", segmentId: "s2", status: "online" }
    ];

    const tree = buildHierarchyTree({ groups, segments, devices });

    expect(tree.groups).toHaveLength(1);
    expect(tree.groups[0].segments.map((segment) => segment.id)).toEqual(["s1"]);
    expect(tree.ungroupedSegments.map((segment) => segment.id)).toEqual(["s2"]);
    expect(tree.groupCount).toBe(1);
    expect(tree.segmentCount).toBe(2);
    expect(tree.deviceCount).toBe(2);
  });

  it("arvore vazia devolve contagens zeradas e status sem_dados, sem inventar nada", () => {
    const tree = buildHierarchyTree({ groups: [], segments: [], devices: [] });
    expect(tree.groupCount).toBe(0);
    expect(tree.segmentCount).toBe(0);
    expect(tree.deviceCount).toBe(0);
    expect(tree.tabStatus).toBe("sem_dados");
  });
});
