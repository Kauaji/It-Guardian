import * as THREE from "three";

const DOOR_WOOD = "#b7793f";
const FRAME_WOOD = "#6b4423";
const HANDLE_GOLD = "#d6a923";

function addDoorHandle(parts, group, options) {
  parts.addModelPart(group, { color: HANDLE_GOLD, metalness: 0.65, ...options });
}

function buildDoubleDoor(ctx, metrics) {
  const { group, object, width: objectWidth, parts } = ctx;
  const { doorHeight, panelDepth } = metrics;
  const leafWidth = objectWidth * 0.46;
  const openAngle = object.metadata?.swing === "outward" ? -32 : 32;
  [-1, 1].forEach((side) => {
    const leaf = new THREE.Group();
    leaf.position.x = side * (objectWidth / 2 - 5);
    leaf.rotation.y = THREE.MathUtils.degToRad(openAngle * -side);
    parts.addModelPart(leaf, {
      x: (-side * leafWidth) / 2,
      width: leafWidth,
      depth: panelDepth,
      height: doorHeight,
      color: DOOR_WOOD,
      texturePreset: "wood"
    });
    addDoorHandle(parts, leaf, {
      x: -side * leafWidth * 0.42,
      z: -panelDepth,
      y: doorHeight * 0.48,
      width: 4,
      depth: 4,
      height: 4
    });
    group.add(leaf);
  });
}

function buildSlidingDoor(ctx, metrics, doorType) {
  const { group, object, width: objectWidth, parts } = ctx;
  const { doorHeight, frameDepth, panelDepth } = metrics;
  const reverseSlide = object.metadata?.slideDirection === "left";
  const panelWidth = objectWidth * (doorType === "pocket" ? 0.52 : 0.58);
  const panelX = (reverseSlide ? -1 : 1) * objectWidth * 0.2;
  if (doorType === "pocket") {
    parts.addModelPart(group, {
      x: -panelX,
      width: objectWidth * 0.46,
      depth: frameDepth,
      height: doorHeight + 2,
      color: "#7c5738",
      opacity: 0.9,
      texturePreset: "wood"
    });
  } else {
    parts.addModelPart(group, { y: doorHeight + 5, width: objectWidth * 0.92, depth: 4, height: 5, color: "#64748b", metalness: 0.65 });
  }
  parts.addModelPart(group, {
    x: panelX,
    z: doorType === "sliding" ? -panelDepth : 0,
    width: panelWidth,
    depth: panelDepth,
    height: doorHeight,
    color: DOOR_WOOD,
    texturePreset: "wood"
  });
  addDoorHandle(parts, group, {
    x: panelX - (reverseSlide ? -1 : 1) * panelWidth * 0.38,
    z: -panelDepth,
    y: doorHeight * 0.48,
    width: 4,
    depth: 4,
    height: 4
  });
}

function buildSwingDoor(ctx, metrics) {
  const { group, object, width: objectWidth, parts } = ctx;
  const { doorHeight, panelDepth } = metrics;
  const leaf = new THREE.Group();
  leaf.position.x = -objectWidth / 2 + 5;
  leaf.rotation.y = THREE.MathUtils.degToRad(object.metadata?.swing === "outward" ? -36 : 36);
  parts.addModelPart(leaf, {
    x: objectWidth * 0.46,
    width: objectWidth * 0.92,
    depth: panelDepth,
    height: doorHeight,
    color: DOOR_WOOD,
    texturePreset: "wood"
  });
  addDoorHandle(parts, leaf, {
    x: objectWidth * 0.82,
    z: -panelDepth,
    y: doorHeight * 0.48,
    width: 5,
    depth: 5,
    height: 5
  });
  group.add(leaf);
}

/** Porta com batente e folha(s): simples, dupla, de correr ou embutida. */
export function buildDoor(ctx) {
  const { group, object, width: objectWidth, depth: objectDepth, parts } = ctx;
  const doorType = object.metadata?.doorType || "single";
  const metrics = {
    doorHeight: Number(object.height3d || 92),
    frameDepth: Math.max(6, objectDepth * 0.55),
    panelDepth: Math.max(4, objectDepth * 0.28)
  };
  [-objectWidth / 2 + 3, objectWidth / 2 - 3].forEach((x) => {
    parts.addModelPart(group, {
      x,
      width: 6,
      depth: metrics.frameDepth,
      height: metrics.doorHeight + 6,
      color: FRAME_WOOD,
      texturePreset: "wood"
    });
  });
  parts.addModelPart(group, {
    y: metrics.doorHeight,
    width: objectWidth,
    depth: metrics.frameDepth,
    height: 6,
    color: FRAME_WOOD,
    texturePreset: "wood"
  });

  if (doorType === "double") buildDoubleDoor(ctx, metrics);
  else if (doorType === "sliding" || doorType === "pocket") buildSlidingDoor(ctx, metrics, doorType);
  else buildSwingDoor(ctx, metrics);
}
