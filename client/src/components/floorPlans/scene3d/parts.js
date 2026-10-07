import * as THREE from "three";
import { toColor } from "./resources.js";

/**
 * Fabrica das pecas basicas da cena: caixas soltas no cenario (pisos, zonas),
 * pecas arredondadas e cilindros que compoem os objetos procedurais.
 * `offsets` converte coordenadas da planta (px) para o centro da cena.
 */
export function createPartFactory({ scene, textures, resources, offsets }) {
  const addBox = ({
    x,
    y,
    width,
    depth,
    height,
    color,
    opacity = 1,
    verticalOffset = 0,
    metalness = 0.02,
    texturePreset = null,
    textureKind = "floor"
  }) => {
    const textureMaps = texturePreset ? textures.getMaterialTextureMaps(texturePreset, textureKind) : {};
    const material = new THREE.MeshStandardMaterial({
      color: toColor(color, "#dbeafe"),
      ...textureMaps,
      transparent: opacity < 1,
      opacity,
      roughness: textureKind === "wall" ? 0.7 : 0.82,
      metalness,
      ...(textureMaps.normalMap ? { normalScale: new THREE.Vector2(0.42, 0.42) } : {})
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(Number(x || 0) + width / 2 - offsets.x, height / 2 + verticalOffset, Number(y || 0) + depth / 2 - offsets.y);
    mesh.castShadow = height > 8;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  const addModelPart = (
    group,
    {
      x = 0,
      z = 0,
      y = 0,
      width = 12,
      depth = 12,
      height = 12,
      color = "#1f7a61",
      opacity = 1,
      metalness = 0.04,
      texturePreset = null,
      textureKind = "object",
      emissive = null,
      emissiveIntensity = 0,
      glass = false
    }
  ) => {
    const mesh = new THREE.Mesh(
      resources.getRoundedGeometry(width, height, depth),
      resources.createMaterial(color, opacity, metalness, texturePreset, textureKind, { emissive, emissiveIntensity, glass })
    );
    mesh.position.set(x, y + height / 2, z);
    mesh.castShadow = opacity >= 0.5;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const addCylinderPart = (group, { x = 0, z = 0, y = 0, radius = 8, height = 12, color = "#1f7a61", opacity = 1 }) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 24), resources.createMaterial(color, opacity, 0.08));
    mesh.position.set(x, y + height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  return { addBox, addModelPart, addCylinderPart };
}
