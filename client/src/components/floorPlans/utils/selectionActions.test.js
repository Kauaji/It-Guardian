import { describe, expect, it } from "vitest";
import { buildDesk, buildEditor, buildPc } from "../test/fixtures.js";
import {
  getActionObjectIds,
  getPrimarySelection,
  getSelectionActionState,
  mergeMarqueeSelection,
  toggleIdInSelection
} from "./selectionActions.js";

describe("getActionObjectIds", () => {
  it("prefere a multipla selecao e cai para o objeto selecionado", () => {
    expect(getActionObjectIds({ type: "object", id: "a" }, ["b", "c"])).toEqual(["b", "c"]);
    expect(getActionObjectIds({ type: "object", id: "a" }, [])).toEqual(["a"]);
    expect(getActionObjectIds({ type: "zone", id: "z" }, [])).toEqual([]);
    expect(getActionObjectIds(null, [])).toEqual([]);
  });
});

describe("getSelectionActionState", () => {
  const editor = buildEditor({
    objects: [
      buildDesk(),
      buildPc(),
      buildDesk({ id: "desk-locked", metadata: { parentRoomId: "room-1", locked: true } }),
      { id: "door-1", floorId: "floor-1", objectType: "door", x: 0, y: 0, width: 40, height: 10, metadata: { anchorType: "wall", parentObjectId: "wall-1" } }
    ]
  });

  it("permite todas as acoes para um objeto livre", () => {
    const state = getSelectionActionState({ editor, selected: { type: "object", id: "desk-1" }, selectedObjectIds: ["desk-1"] });
    expect(state).toMatchObject({ objectSelectionActive: true, allLocked: false, canDuplicate: true, canRotate: true, canDelete: true });
  });

  it("bloqueia rotacao e exclusao quando tudo esta travado", () => {
    const state = getSelectionActionState({ editor, selected: { type: "object", id: "desk-locked" }, selectedObjectIds: ["desk-locked"] });
    expect(state).toMatchObject({ allLocked: true, canRotate: false, canDelete: false, canDuplicate: true });
  });

  it("nao duplica aberturas ancoradas nem multipla selecao", () => {
    const door = getSelectionActionState({ editor, selected: { type: "object", id: "door-1" }, selectedObjectIds: ["door-1"] });
    expect(door.canDuplicate).toBe(false);
    const multiple = getSelectionActionState({ editor, selected: { type: "object", id: "desk-1" }, selectedObjectIds: ["desk-1", "pc-1"] });
    expect(multiple.canDuplicate).toBe(false);
    expect(multiple.actionObjects).toHaveLength(2);
  });

  it("comodos podem ser duplicados, girados e excluidos", () => {
    const state = getSelectionActionState({ editor, selected: { type: "zone", id: "room-1" }, selectedObjectIds: [] });
    expect(state).toMatchObject({ objectSelectionActive: false, canDuplicate: true, canRotate: true, canDelete: true });
  });

  it("sem selecao, nao ha acao de objeto", () => {
    const state = getSelectionActionState({ editor, selected: null, selectedObjectIds: [] });
    expect(state).toMatchObject({ objectSelectionActive: false, canDuplicate: false, canRotate: false, canDelete: true });
  });
});

describe("selecao multipla", () => {
  it("alterna ids", () => {
    expect(toggleIdInSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleIdInSelection(["a", "b"], "a")).toEqual(["b"]);
  });

  it("combina o retangulo com a selecao atual quando aditivo", () => {
    expect(mergeMarqueeSelection(["a"], ["a", "b"], true)).toEqual(["a", "b"]);
    expect(mergeMarqueeSelection(["a"], ["b"], false)).toEqual(["b"]);
  });

  it("escolhe o ultimo objeto como principal", () => {
    expect(getPrimarySelection(["a", "b"])).toEqual({ type: "object", id: "b" });
    expect(getPrimarySelection([])).toBeNull();
  });
});
