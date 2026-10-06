import { describe, expect, it } from "vitest";
import {
  EMPTY_MAP_DRAFT,
  buildConnectionPayload,
  buildDuplicateObjectPayload,
  buildMapPayload,
  buildObjectPayload,
  connectionToDraft,
  draftsMatch,
  getNextObjectPosition,
  layerLabel,
  mapToDraft,
  numberInputValue,
  objectToDraft,
  withAddedConnectionPoint,
  withConnectionField,
  withConnectionMetadata,
  withConnectionPoint,
  withObjectField,
  withObjectMetadata,
  withoutConnectionPoint
} from "./visualMapDrafts.js";
import { getDeviceMeta, getDeviceName, getDevicePreset } from "./visualMapDevices.js";

describe("visualMapDrafts", () => {
  it("converte números com fallback e compara rascunhos", () => {
    expect(numberInputValue("3.5")).toBe(3.5);
    expect(numberInputValue("x", 9)).toBe(9);
    expect(draftsMatch({ a: 1 }, { a: 1 })).toBe(true);
    expect(draftsMatch(undefined, null)).toBe(true);
    expect(draftsMatch({ a: 1 }, { a: 2 })).toBe(false);
    expect(layerLabel("assets")).toBeTruthy();
    expect(layerLabel("inexistente")).toBe("Mapa");
  });

  it("calcula posições em grade dentro dos limites do mapa", () => {
    expect(getNextObjectPosition([], { width: 30, depth: 20 })).toEqual({ positionX: -8.3, positionZ: -9 });
    const many = Array.from({ length: 13 }, (_, index) => ({ id: index }));
    expect(getNextObjectPosition(many, { width: 30, depth: 20 })).toEqual({ positionX: -6.8, positionZ: -7.5 });
    expect(getNextObjectPosition([], null)).toEqual({ positionX: -8.3, positionZ: -9 });
    expect(getNextObjectPosition(Array.from({ length: 100 }), { width: 5, depth: 2 }).positionZ).toBe(0);
  });

  it("converte entidades em rascunhos com valores padrão", () => {
    expect(mapToDraft(null)).toBe(EMPTY_MAP_DRAFT);
    expect(mapToDraft({ name: "A" })).toMatchObject({ name: "A", width: 30, depth: 20, scale: 1, notes: "" });
    expect(objectToDraft(null)).toBeNull();
    expect(objectToDraft({})).toMatchObject({ label: "", color: "#2563eb", width: 1, metadata: {} });
    expect(connectionToDraft(null)).toBeNull();
    const draft = connectionToDraft({ layer: "electrical" });
    expect(draft.points).toHaveLength(2);
    expect(draft).toMatchObject({ thickness: 2, dashed: false, color: "#0ea5e9" });
    expect(connectionToDraft({ points: [{ x: 1 }] }).points).toEqual([{ x: 1 }]);
  });

  it("monta os payloads convertendo campos numéricos e vazios", () => {
    expect(buildMapPayload({ name: "n", width: "x", depth: "40", scale: "" })).toEqual({ name: "n", width: 30, depth: 40, scale: 0 });
    expect(buildObjectPayload({ label: "o", linkedAssetId: "", positionX: "1", width: "z" })).toMatchObject({
      linkedAssetId: null,
      positionX: 1,
      positionY: 0,
      width: 1,
      height: 1
    });
    expect(buildDuplicateObjectPayload({ label: "", positionX: 1, positionZ: "2", linkedAssetId: "a" }, "Base")).toMatchObject({
      label: "Base (cópia)",
      linkedAssetId: null,
      positionX: 1.5,
      positionZ: 2.5
    });
    const connection = buildConnectionPayload({ sourceObjectId: "", points: [{ x: "1", y: "q", z: 2 }], thickness: "" });
    expect(connection).toMatchObject({ sourceObjectId: null, points: [{ x: 1, y: 0.08, z: 2 }], thickness: 0 });
    expect(buildConnectionPayload({}).points).toEqual([]);
  });

  it("atualiza rascunhos de forma pura", () => {
    expect(withObjectField(null, "label", "a")).toEqual({ label: "a" });
    expect(withObjectMetadata({ metadata: { a: 1 } }, "b", 2).metadata).toEqual({ a: 1, b: 2 });
    expect(withObjectMetadata(null, "b", 2).metadata).toEqual({ b: 2 });
    expect(withConnectionField(null, "label", "x").label).toBe("x");
    const changed = withConnectionField({ layer: "infrastructure", color: "#fff" }, "layer", "electrical");
    expect(changed.layer).toBe("electrical");
    expect(changed.color).not.toBe("#fff");
    expect(withConnectionPoint(null, 3, "x", 4).points[3]).toEqual({ x: 4, y: 0.08, z: 0 });
    expect(withConnectionPoint({ points: [{ x: 1, y: 2, z: 3 }] }, 0, "y", 9).points[0]).toEqual({ x: 1, y: 9, z: 3 });
    expect(withAddedConnectionPoint({ points: [{ x: 1, y: 2, z: 3 }] }).points.at(-1)).toEqual({ x: 2, y: 2, z: 4 });
    expect(withAddedConnectionPoint({ points: [] }).points).toEqual([{ x: 1, y: 0.08, z: 1 }]);
    expect(withAddedConnectionPoint(null).points.length).toBeGreaterThan(2);
    const three = { points: [{ x: 0 }, { x: 1 }, { x: 2 }] };
    expect(withoutConnectionPoint(three, 1).points).toEqual([{ x: 0 }, { x: 2 }]);
    const two = { points: [{ x: 0 }, { x: 1 }] };
    expect(withoutConnectionPoint(two, 0).points).toBe(two.points);
    expect(withoutConnectionPoint(null, 0).points).toBeDefined();
    expect(withConnectionMetadata({ metadata: { a: 1 } }, "b", 2).metadata).toEqual({ a: 1, b: 2 });
    expect(withConnectionMetadata(null, "b", 2).metadata).toEqual({ b: 2 });
  });

  it("resolve nome, preset e metadados do ativo", () => {
    expect(getDeviceName(null)).toBe("Ativo");
    expect(getDeviceName({ hostname: "h" })).toBe("h");
    expect(getDevicePreset({ assetType: "Servidor" })).toBe("server");
    expect(getDevicePreset({})).toBe("desktop");
    expect(getDeviceMeta(null).ip).toBe("Não informado");
    expect(getDeviceMeta({ address: "1", operatingSystem: "L", segment: "s", group: "g", environmentName: "e", status: "ok" })).toEqual({
      status: "ok",
      ip: "1",
      os: "L",
      segment: "s",
      group: "g",
      environment: "e"
    });
  });
});
