import { getWallOpeningCuts, getWallSolidSegments } from "../utils/wallSegments.js";
import { WALL_TEXTURE_COLORS } from "./constants.js";

/**
 * Construtores procedurais de estrutura e mobiliario. Cada um recebe o
 * contexto `{ group, object, type, width, depth, color, parts, activeObjects }`
 * e adiciona pecas ao grupo do objeto.
 */

export function buildWall(ctx) {
  const { group, object, type, width: objectWidth, depth: objectDepth, parts, activeObjects } = ctx;
  const openings = activeObjects.filter((candidate) => (
    candidate.metadata?.parentObjectId === object.id && ["door", "window"].includes(candidate.objectType)
  ));
  const segments = getWallSolidSegments(objectWidth, getWallOpeningCuts(objectWidth, openings));
  segments.forEach((segment) => {
    const segmentWidth = Math.max(0, segment.end - segment.start);
    parts.addModelPart(group, {
      x: segment.start + segmentWidth / 2 - objectWidth / 2,
      width: segmentWidth,
      depth: Math.max(4, objectDepth),
      height: Number(object.height3d || (type === "divider" ? 82 : 110)),
      y: 0,
      color: WALL_TEXTURE_COLORS[object.metadata?.texturePreset] || object.color || "#64748b",
      opacity: type === "divider" ? 0.82 : 0.96,
      texturePreset: object.metadata?.texturePreset || "paint",
      textureKind: "wall"
    });
  });
}

export function buildTable(ctx) {
  const { group, object, width: objectWidth, depth: objectDepth, parts } = ctx;
  const tableHeight = Math.max(20, Number(object.height3d || 46));
  const topThickness = Math.min(10, tableHeight * 0.24);
  const legHeight = tableHeight - topThickness;
  parts.addModelPart(group, {
    width: objectWidth,
    depth: objectDepth,
    height: topThickness,
    y: legHeight,
    color: "#a9825c",
    texturePreset: "wood"
  });
  const legOffsetX = objectWidth / 2 - 8;
  const legOffsetZ = objectDepth / 2 - 8;
  [
    [-legOffsetX, -legOffsetZ],
    [legOffsetX, -legOffsetZ],
    [-legOffsetX, legOffsetZ],
    [legOffsetX, legOffsetZ]
  ].forEach(([x, z]) => parts.addModelPart(group, { x, z, width: 7, depth: 7, height: legHeight, color: "#6b4f35" }));
}

export function buildChair(ctx) {
  const { group, width: objectWidth, depth: objectDepth, color, parts } = ctx;
  parts.addModelPart(group, { width: objectWidth * 0.72, depth: objectDepth * 0.72, height: 10, y: 22, color });
  parts.addModelPart(group, { z: objectDepth * 0.22, width: objectWidth * 0.72, depth: 8, height: 42, y: 22, color });
  [
    [-objectWidth * 0.25, -objectDepth * 0.25],
    [objectWidth * 0.25, -objectDepth * 0.25],
    [-objectWidth * 0.25, objectDepth * 0.25],
    [objectWidth * 0.25, objectDepth * 0.25]
  ].forEach(([x, z]) => parts.addModelPart(group, { x, z, width: 4, depth: 4, height: 24, color: "#334155" }));
}

export function buildCabinet(ctx) {
  const { group, object, width: objectWidth, depth: objectDepth, parts } = ctx;
  parts.addModelPart(group, { width: objectWidth * 0.9, depth: objectDepth * 0.84, height: Number(object.height3d || 96), color: "#b08968", texturePreset: "wood" });
  parts.addModelPart(group, { x: -1, z: -objectDepth * 0.43, y: 6, width: 2, depth: 2, height: Number(object.height3d || 96) - 12, color: "#6b4f35" });
  parts.addModelPart(group, { x: -objectWidth * 0.08, z: -objectDepth * 0.45, y: 48, width: 3, depth: 3, height: 8, color: "#e2e8f0", metalness: 0.45 });
  parts.addModelPart(group, { x: objectWidth * 0.08, z: -objectDepth * 0.45, y: 48, width: 3, depth: 3, height: 8, color: "#e2e8f0", metalness: 0.45 });
}

export function buildShelf(ctx) {
  const { group, object, width: objectWidth, depth: objectDepth, parts } = ctx;
  const shelfHeight = Number(object.height3d || 92);
  [-objectWidth * 0.43, objectWidth * 0.43].forEach((x) => {
    parts.addModelPart(group, { x, width: 6, depth: objectDepth * 0.82, height: shelfHeight, color: "#8b5e3c" });
  });
  [4, 32, 60, 88].filter((y) => y < shelfHeight).forEach((y) => {
    parts.addModelPart(group, { width: objectWidth * 0.88, depth: objectDepth * 0.82, height: 5, y, color: "#b08968", texturePreset: "wood" });
  });
}

export function buildWindow(ctx) {
  const { group, width: objectWidth, parts } = ctx;
  parts.addModelPart(group, { width: objectWidth, depth: 5, height: 42, y: 22, color: "#bfdbfe", opacity: 0.58, glass: true });
  parts.addModelPart(group, { width: objectWidth, depth: 7, height: 5, y: 22, color: "#64748b" });
}

export function buildGenericBox(ctx) {
  const { group, object, width: objectWidth, depth: objectDepth, color, parts } = ctx;
  parts.addModelPart(group, { width: objectWidth, depth: objectDepth, height: Number(object.height3d || 42), y: 0, color, metalness: object.category === "asset" ? 0.18 : 0.04 });
}
