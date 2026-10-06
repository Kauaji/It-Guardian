import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Cor hexadecimal (#rrggbb) valida ou o valor de reserva. */
export function toColor(value, fallback = "#1f7a61") {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
}

function createRoundedGeometry(width, height, depth) {
  const smallestSide = Math.max(0.5, Math.min(width, height, depth));
  const radius = Math.min(2.4, smallestSide * 0.16);
  return new RoundedBoxGeometry(width, height, depth, 2, radius);
}

/** Remove propriedades indefinidas (o three.js emite aviso para cada uma). */
function withoutUndefined(values) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

/**
 * Geometrias e materiais compartilhados entre as pecas procedurais da cena.
 * Ficam em cache (por dimensoes/parametros) e sao liberados junto com a cena;
 * `disposeObject3D` poupa os compartilhados ao trocar um objeto por um modelo.
 */
export function createSharedResources({ textures }) {
  const geometries = new Map();
  const materials = new Map();
  const sharedGeometries = new Set();
  const sharedMaterials = new Set();

  const getRoundedGeometry = (width, height, depth) => {
    const key = [width, height, depth].map((value) => Number(value).toFixed(2)).join(":");
    if (!geometries.has(key)) {
      const geometry = createRoundedGeometry(width, height, depth);
      geometries.set(key, geometry);
      sharedGeometries.add(geometry);
    }
    return geometries.get(key);
  };

  const createMaterial = (color, opacity = 1, metalness = 0.04, texturePreset = null, textureKind = "object", options = {}) => {
    const normalizedTextureKind = textureKind === "wall" ? "wall" : "floor";
    const materialKey = JSON.stringify({ color, opacity, metalness, texturePreset, normalizedTextureKind, ...options });
    if (materials.has(materialKey)) return materials.get(materialKey);
    const textureMaps = texturePreset ? textures.getMaterialTextureMaps(texturePreset, normalizedTextureKind) : {};
    const Material = options.glass ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const material = new Material(
      withoutUndefined({
        color: toColor(color, "#1f7a61"),
        ...textureMaps,
        transparent: opacity < 1,
        opacity,
        roughness: options.roughness ?? (metalness > 0.2 ? 0.34 : 0.64),
        metalness,
        normalScale: textureMaps.normalMap ? new THREE.Vector2(0.38, 0.38) : undefined,
        emissive: options.emissive ? new THREE.Color(options.emissive) : undefined,
        emissiveIntensity: Number(options.emissiveIntensity || 0),
        transmission: options.glass ? 0.28 : undefined,
        thickness: options.glass ? 0.6 : undefined,
        depthWrite: !options.glass,
        envMapIntensity: options.glass ? 1.18 : 0.82
      })
    );
    materials.set(materialKey, material);
    sharedMaterials.add(material);
    return material;
  };

  /** Libera geometrias e materiais de uma arvore, exceto os compartilhados. */
  const disposeObject3D = (root) => {
    root?.traverse?.((child) => {
      if (child.geometry && !sharedGeometries.has(child.geometry)) child.geometry.dispose?.();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => {
          if (!sharedMaterials.has(material)) material.dispose?.();
        });
      } else if (child.material && !sharedMaterials.has(child.material)) child.material.dispose?.();
    });
  };

  return { getRoundedGeometry, createMaterial, disposeObject3D };
}
