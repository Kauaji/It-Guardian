import * as THREE from "three";
import { FLOOR_TEXTURE_COLORS, PHYSICAL_TEXTURE_URLS, WALL_TEXTURE_COLORS } from "./constants.js";

const TEXTURE_SIZE = 256;

export function seededNoise(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function drawWoodGrain(context, kind) {
  context.strokeStyle = kind === "wall" ? "rgba(72, 42, 24, 0.34)" : "rgba(89, 54, 31, 0.3)";
  context.lineWidth = 2;
  const plankSize = kind === "wall" ? 32 : 48;
  for (let offset = 0; offset <= TEXTURE_SIZE; offset += plankSize) {
    context.beginPath();
    if (kind === "wall") {
      context.moveTo(offset, 0);
      context.lineTo(offset, TEXTURE_SIZE);
    } else {
      context.moveTo(0, offset);
      context.lineTo(TEXTURE_SIZE, offset);
    }
    context.stroke();
  }
  context.strokeStyle = "rgba(255, 255, 255, 0.14)";
  for (let line = 0; line < 20; line += 1) {
    const axis = seededNoise(line + 1) * TEXTURE_SIZE;
    context.beginPath();
    if (kind === "wall") {
      context.moveTo(axis, 0);
      context.bezierCurveTo(axis + 7, 72, axis - 8, 164, axis + 4, TEXTURE_SIZE);
    } else {
      context.moveTo(0, axis);
      context.bezierCurveTo(72, axis + 5, 164, axis - 7, TEXTURE_SIZE, axis + 3);
    }
    context.stroke();
  }
}

function drawBricks(context) {
  context.strokeStyle = "rgba(71, 35, 25, 0.42)";
  context.lineWidth = 3;
  for (let row = 0; row < 8; row += 1) {
    const y = row * 32;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(TEXTURE_SIZE, y);
    context.stroke();
    const offset = row % 2 ? 32 : 0;
    for (let x = offset; x < TEXTURE_SIZE; x += 64) {
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x, y + 32);
      context.stroke();
    }
  }
}

function drawTiles(context, preset) {
  context.strokeStyle = preset === "technical" ? "rgba(50, 74, 92, 0.28)" : "rgba(91, 110, 124, 0.2)";
  context.lineWidth = 2;
  const tileSize = preset === "technical" ? 32 : 64;
  for (let offset = 0; offset <= TEXTURE_SIZE; offset += tileSize) {
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset, TEXTURE_SIZE);
    context.moveTo(0, offset);
    context.lineTo(TEXTURE_SIZE, offset);
    context.stroke();
  }
}

function drawSpeckles(context, preset) {
  for (let index = 0; index < 900; index += 1) {
    const alpha = preset === "carpet" ? 0.16 : 0.08;
    const shade = seededNoise(index + 7) > 0.5 ? 255 : 24;
    context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${alpha})`;
    context.fillRect(seededNoise(index * 3 + 1) * TEXTURE_SIZE, seededNoise(index * 5 + 2) * TEXTURE_SIZE, 1.5, 1.5);
  }
}

/** Textura procedural (canvas 256x256) de piso ou parede para o preset informado. */
export function createSurfaceTexture(preset, kind = "floor") {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext("2d");
  context.fillStyle = kind === "wall"
    ? WALL_TEXTURE_COLORS[preset] || WALL_TEXTURE_COLORS.paint
    : FLOOR_TEXTURE_COLORS[preset] || FLOOR_TEXTURE_COLORS.ceramic;
  context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  if (preset === "wood") drawWoodGrain(context, kind);
  else if (preset === "brick") drawBricks(context);
  else if (preset === "ceramic" || preset === "technical") drawTiles(context, preset);
  else drawSpeckles(context, preset);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "wall" ? 3 : 5, kind === "wall" ? 2 : 5);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Cache de texturas da cena: procedurais (canvas) e fotograficas (arquivos
 * locais, so madeira e tijolo). `onLoad` e chamado quando uma imagem termina
 * de carregar; `dispose` libera todas as texturas criadas.
 */
export function createTextureCache({ renderer, onLoad }) {
  const surfaceTextures = new Map();
  const physicalTextures = new Map();
  const textureLoader = new THREE.TextureLoader();

  const getSurfaceTexture = (preset, kind) => {
    const key = `${kind}:${preset || "default"}`;
    if (!surfaceTextures.has(key)) surfaceTextures.set(key, createSurfaceTexture(preset, kind));
    return surfaceTextures.get(key);
  };

  const getPhysicalTexture = (preset, channel, kind) => {
    const url = PHYSICAL_TEXTURE_URLS[preset]?.[channel];
    if (!url) return null;
    const key = `${kind}:${preset}:${channel}`;
    if (!physicalTextures.has(key)) {
      const texture = textureLoader.load(url, onLoad);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(kind === "wall" ? 3 : 5, kind === "wall" ? 2 : 5);
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (channel === "map") texture.colorSpace = THREE.SRGBColorSpace;
      physicalTextures.set(key, texture);
    }
    return physicalTextures.get(key);
  };

  return {
    getSurfaceTexture,
    getMaterialTextureMaps: (preset, kind) => ({
      map: getPhysicalTexture(preset, "map", kind) || getSurfaceTexture(preset, kind),
      normalMap: getPhysicalTexture(preset, "normalMap", kind),
      roughnessMap: getPhysicalTexture(preset, "roughnessMap", kind)
    }),
    dispose() {
      surfaceTextures.forEach((texture) => texture.dispose());
      physicalTextures.forEach((texture) => texture.dispose());
    }
  };
}
