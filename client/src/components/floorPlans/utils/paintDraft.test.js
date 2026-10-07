import { describe, expect, it } from "vitest";
import { buildEditor, createIdSequence } from "../test/fixtures.js";
import { cloneEditor } from "./editorGeometry.js";
import {
  addPaintAreaToDraft,
  applyPaintAtPoint,
  createGroupPaintDraft,
  createSegmentPaintDraft,
  reducePaintDraftPatch,
  resolvePaintConfirmation
} from "./paintDraft.js";
import { createPaintAreaZone, getPaintCells } from "./paintAreaGeometry.js";

const groups = [
  { id: "g1", name: "Matriz", color: "#ef4444" },
  { id: "g2", name: "Filial", color: "#0ea5e9" }
];
const segments = [
  { id: "s1", name: "Servidores", groupId: "g1", color: "#10b981" },
  { id: "s2", name: "Caixa", groupId: "g2", color: "#f59e0b" },
  { id: "s3", name: "Livre", groupId: null, color: "#8b5cf6" }
];
const groupArea = createPaintAreaZone({
  id: "area-1",
  planId: "plan-1",
  floorId: "floor-1",
  areaType: "group",
  name: "Matriz",
  color: "#ef4444",
  cells: ["5:5", "6:5", "7:5"],
  cellSize: 20,
  groupId: "g1"
});

describe("rascunhos iniciais", () => {
  it("usa o primeiro grupo no pincel de grupo", () => {
    expect(createGroupPaintDraft(groups)).toMatchObject({
      areaType: "group",
      mode: "brush",
      brushSize: 1,
      cellSize: 20,
      groupId: "g1",
      color: "#ef4444",
      cells: []
    });
  });

  it("cai para cor e grupo vazios sem grupos cadastrados", () => {
    expect(createGroupPaintDraft([])).toMatchObject({ groupId: "", color: "#8b5cf6" });
  });

  it("escolhe o primeiro segmento compativel com a area de grupo", () => {
    const draft = createSegmentPaintDraft(groupArea, segments);
    expect(draft).toMatchObject({
      areaType: "segment",
      parentAreaId: "area-1",
      groupId: "g1",
      segmentId: "s1",
      color: "#10b981"
    });
    expect(createSegmentPaintDraft(groupArea, []).color).toBe("#22c55e");
  });
});

describe("reducePaintDraftPatch", () => {
  const context = { groups, segments, savedGroupAreas: [groupArea] };

  it("troca a cor ao escolher outro grupo", () => {
    const current = createGroupPaintDraft(groups);
    const next = reducePaintDraftPatch(current, { groupId: "g2" }, context);
    expect(next).toMatchObject({ groupId: "g2", color: "#0ea5e9" });
  });

  it("recalcula grupo, segmento, cor e celula ao trocar a area pai", () => {
    const current = { ...createSegmentPaintDraft(groupArea, segments), parentAreaId: null, cellSize: 99 };
    const next = reducePaintDraftPatch(current, { parentAreaId: "area-1" }, context);
    expect(next).toMatchObject({ parentAreaId: "area-1", groupId: "g1", segmentId: "s1", color: "#10b981", cellSize: 20 });
    const orphan = reducePaintDraftPatch(current, { parentAreaId: "inexistente" }, context);
    expect(orphan).toMatchObject({ groupId: "", segmentId: "s1", cellSize: 99 });
  });

  it("troca a cor ao escolher outro segmento e preserva campos nao relacionados", () => {
    const current = createSegmentPaintDraft(groupArea, segments);
    expect(reducePaintDraftPatch(current, { segmentId: "s3" }, context).color).toBe("#8b5cf6");
    expect(reducePaintDraftPatch(current, { brushSize: 4 }, context)).toMatchObject({ brushSize: 4, color: "#10b981" });
  });
});

describe("applyPaintAtPoint", () => {
  const editor = buildEditor();
  const base = { savedGroupAreas: [groupArea], zones: editor.zones, activeFloorId: "floor-1" };

  it("pinta as celulas sob o pincel", () => {
    const { draft, warning } = applyPaintAtPoint(createGroupPaintDraft(groups), { x: 110, y: 110 }, base);
    expect(warning).toBeNull();
    expect(draft.cells).toEqual(["5:5"]);
  });

  it("apaga com a borracha", () => {
    const painted = { ...createGroupPaintDraft(groups), cells: ["5:5", "6:5"], mode: "eraser" };
    expect(applyPaintAtPoint(painted, { x: 110, y: 110 }, base).draft.cells).toEqual(["6:5"]);
  });

  it("restringe segmentos as celulas da area de grupo", () => {
    const segmentDraft = createSegmentPaintDraft(groupArea, segments);
    const outside = applyPaintAtPoint(segmentDraft, { x: 10, y: 10 }, base).draft;
    expect(outside.cells).toEqual([]);
    const inside = applyPaintAtPoint(segmentDraft, { x: 110, y: 110 }, base).draft;
    expect(inside.cells).toEqual(["5:5"]);
  });

  it("balde preenche o comodo sob o cursor e avisa quando nao ha comodo", () => {
    const bucket = { ...createGroupPaintDraft(groups), mode: "bucket" };
    const filled = applyPaintAtPoint(bucket, { x: 300, y: 300 }, base);
    expect(filled.draft.cells.length).toBeGreaterThan(100);
    const missing = applyPaintAtPoint(bucket, { x: 1000, y: 700 }, base);
    expect(missing.draft).toBe(bucket);
    expect(missing.warning).toMatch(/Não foi possível completar a área/);
  });
});

describe("resolvePaintConfirmation", () => {
  const context = { groups, segments, savedGroupAreas: [groupArea] };

  it("exige celulas demarcadas", () => {
    expect(resolvePaintConfirmation(createGroupPaintDraft(groups), context)).toEqual({ error: "Nenhuma área foi demarcada." });
    expect(resolvePaintConfirmation(null, context).error).toBe("Nenhuma área foi demarcada.");
  });

  it("exige grupo no pincel de grupo", () => {
    const draft = { ...createGroupPaintDraft(groups), groupId: "", cells: ["1:1"] };
    expect(resolvePaintConfirmation(draft, context).error).toBe("Selecione o grupo da área demarcada.");
  });

  it("exige area de grupo e segmento no pincel de segmento", () => {
    const draft = { ...createSegmentPaintDraft(groupArea, segments), cells: ["5:5"], segmentId: "" };
    expect(resolvePaintConfirmation(draft, context).error).toBe("Selecione a área de grupo e o segmento antes de confirmar.");
  });

  it("rejeita segmento de outro grupo", () => {
    const draft = { ...createSegmentPaintDraft(groupArea, segments), cells: ["5:5"], segmentId: "s2" };
    expect(resolvePaintConfirmation(draft, context).error).toBe("O segmento selecionado não pertence ao grupo desta área.");
  });

  it("devolve as entidades resolvidas quando valido", () => {
    const draft = { ...createGroupPaintDraft(groups), cells: ["1:1"] };
    const resolved = resolvePaintConfirmation(draft, context);
    expect(resolved.group.id).toBe("g1");
    expect(resolved.parentArea).toBeNull();
  });
});

describe("addPaintAreaToDraft", () => {
  it("cria a zona demarcada com nome e cor do segmento", () => {
    const editor = buildEditor();
    const draft = cloneEditor(editor);
    const paintDraft = { ...createSegmentPaintDraft(groupArea, segments), cells: ["5:5", "6:5"] };
    const resolved = resolvePaintConfirmation(paintDraft, { groups, segments, savedGroupAreas: [groupArea] });
    const id = addPaintAreaToDraft({ draft, paintDraft, activeFloorId: "floor-1", resolved, createId: createIdSequence() });
    const area = draft.zones.find((zone) => zone.id === id);
    expect(area).toMatchObject({ name: "Servidores", color: "#10b981", zoneType: "segment", orderIndex: 1, floorId: "floor-1" });
    expect(getPaintCells(area)).toEqual(["5:5", "6:5"]);
  });
});
