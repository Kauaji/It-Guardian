import { describe, expect, it } from "vitest";
import {
  buildDoorTypePatch,
  buildGroupChangePatch,
  buildMetadataPatch,
  buildOpeningWallPatch,
  buildRackSwitchPatch,
  findSelectedEntity
} from "./inspectorPatches.js";

describe("buildMetadataPatch", () => {
  it("mescla valores sem perder metadados existentes", () => {
    expect(buildMetadataPatch({ metadata: { a: 1 } }, { b: 2 })).toEqual({ metadata: { a: 1, b: 2 } });
    expect(buildMetadataPatch({}, { b: 2 })).toEqual({ metadata: { b: 2 } });
  });
});

describe("buildGroupChangePatch", () => {
  const segments = [{ id: "s1", groupId: "g1" }, { id: "s2", groupId: "g2" }, { id: "s3", groupId: null }];

  it("mantem o segmento compativel com o novo grupo", () => {
    expect(buildGroupChangePatch({ segmentId: "s1" }, "g1", segments)).toEqual({ groupId: "g1", segmentId: "s1" });
    expect(buildGroupChangePatch({ segmentId: "s3" }, "g1", segments)).toEqual({ groupId: "g1", segmentId: "s3" });
    expect(buildGroupChangePatch({ segmentId: "s2" }, null, segments)).toEqual({ groupId: null, segmentId: "s2" });
  });

  it("descarta o segmento incompativel ou inexistente", () => {
    expect(buildGroupChangePatch({ segmentId: "s2" }, "g1", segments)).toEqual({ groupId: "g1", segmentId: null });
    expect(buildGroupChangePatch({ segmentId: "zzz" }, "g1", segments)).toEqual({ groupId: "g1", segmentId: null });
  });

  it("sem segmento atual, preserva o valor vazio", () => {
    expect(buildGroupChangePatch({ segmentId: null }, "g1", segments)).toEqual({ groupId: "g1", segmentId: null });
    expect(buildGroupChangePatch({}, "g1", segments)).toEqual({ groupId: "g1", segmentId: undefined });
  });
});

describe("buildDoorTypePatch", () => {
  it("portas de giro ganham o sentido de abertura", () => {
    expect(buildDoorTypePatch({ metadata: {} }, "single").metadata).toEqual({ doorType: "single", swing: "inward" });
    expect(buildDoorTypePatch({ metadata: { swing: "outward" } }, "double").metadata).toEqual({ doorType: "double", swing: "outward", });
  });

  it("portas de correr ganham a direcao", () => {
    expect(buildDoorTypePatch({ metadata: {} }, "sliding").metadata).toEqual({ doorType: "sliding", slideDirection: "right" });
    expect(buildDoorTypePatch({ metadata: { slideDirection: "left" } }, "pocket").metadata).toEqual({ doorType: "pocket", slideDirection: "left" });
  });
});

describe("buildOpeningWallPatch", () => {
  it("vincula a abertura a parede mantendo a posicao", () => {
    expect(buildOpeningWallPatch({ metadata: { anchorOffset: 0.2 } }, "wall-1").metadata)
      .toEqual({ anchorType: "wall", parentObjectId: "wall-1", anchorOffset: 0.2 });
    expect(buildOpeningWallPatch({}, "wall-1").metadata.anchorOffset).toBe(0.5);
  });

  it("desvincula quando nao ha parede", () => {
    expect(buildOpeningWallPatch({ metadata: { anchorOffset: 0 } }, "").metadata)
      .toEqual({ anchorType: null, parentObjectId: null, anchorOffset: 0 });
  });
});

describe("buildRackSwitchPatch", () => {
  it("instala e remove o switch do rack", () => {
    expect(buildRackSwitchPatch({ metadata: { x: 1 } }, true).metadata)
      .toEqual({ x: 1, switchInstalled: true, switchTotalPorts: 24, switchWorkingPorts: 24 });
    expect(buildRackSwitchPatch({ metadata: { x: 1 } }, false).metadata)
      .toEqual({ x: 1, switchInstalled: false, switchTotalPorts: null, switchWorkingPorts: null });
  });
});

describe("findSelectedEntity", () => {
  const editor = {
    objects: [{ id: "o1" }],
    zones: [{ id: "z1" }],
    connectionPoints: [{ id: "p1" }],
    cableRoutes: [{ id: "r1" }]
  };

  it("busca a entidade na colecao do tipo", () => {
    expect(findSelectedEntity(editor, { type: "object", id: "o1" })).toEqual({ id: "o1" });
    expect(findSelectedEntity(editor, { type: "zone", id: "z1" })).toEqual({ id: "z1" });
    expect(findSelectedEntity(editor, { type: "point", id: "p1" })).toEqual({ id: "p1" });
    expect(findSelectedEntity(editor, { type: "route", id: "r1" })).toEqual({ id: "r1" });
  });

  it("retorna null quando nao encontra ou falta contexto", () => {
    expect(findSelectedEntity(editor, { type: "object", id: "x" })).toBeNull();
    expect(findSelectedEntity(null, { type: "object", id: "o1" })).toBeNull();
    expect(findSelectedEntity(editor, null)).toBeNull();
    expect(findSelectedEntity({}, { type: "object", id: "o1" })).toBeNull();
  });
});
