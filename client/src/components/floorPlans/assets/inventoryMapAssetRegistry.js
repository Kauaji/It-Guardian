export const MODEL_QUALITY_SIMPLE = "simple";
export const MODEL_QUALITY_DETAILED = "detailed";

const MODEL_BASE = "/assets/inventory-map-3d/models";
const QUATERNIUS_SOURCE = "Quaternius Ultimate Furniture Pack";

const quaterniusModel = ({ label, file, fallback, category = "furniture", defaultRotationY = 0 }) => ({
  label,
  modelUrl: `quaternius/${file}`,
  source: QUATERNIUS_SOURCE,
  license: "CC0",
  fallback,
  category,
  defaultRotationY
});

export const INVENTORY_MAP_ASSET_REGISTRY = Object.freeze({
  pc: { label: "PC", modelUrl: null, fallback: "pc" },
  notebook: { label: "Notebook", modelUrl: null, fallback: "notebook" },
  printer: { label: "Impressora", modelUrl: null, fallback: "printer" },
  switch: { label: "Switch", modelUrl: null, fallback: "network-box" },
  router: { label: "Roteador", modelUrl: null, fallback: "network-box" },
  firewall: { label: "Firewall", modelUrl: null, fallback: "network-box" },
  rack: { label: "Rack", modelUrl: null, fallback: "rack" },
  server: { label: "Servidor", modelUrl: null, fallback: "rack" },
  access_point: { label: "Access point", modelUrl: null, fallback: "access-point" },
  desk: quaterniusModel({ label: "Mesa de escritorio", file: "desk.glb", fallback: "desk" }),
  table: quaterniusModel({ label: "Mesa", file: "table.glb", fallback: "desk" }),
  meeting_table: quaterniusModel({ label: "Mesa de reuniao", file: "table.glb", fallback: "desk" }),
  chair: quaterniusModel({ label: "Cadeira", file: "chair.glb", fallback: "chair" }),
  cabinet: quaterniusModel({ label: "Armario", file: "cabinet.glb", fallback: "box" }),
  shelf: quaterniusModel({ label: "Estante", file: "shelf.glb", fallback: "box" }),
  door: quaterniusModel({ label: "Porta", file: "door.glb", fallback: "door", category: "structure" }),
  window: { label: "Janela", modelUrl: null, fallback: "window" },
  stabilizer_600: { label: "Estabilizador 600V", modelUrl: null, fallback: "power-box" },
  stabilizer_1000: { label: "Estabilizador 1000V", modelUrl: null, fallback: "power-box" }
});

export function getInventoryMapAssetDefinition(type) {
  return INVENTORY_MAP_ASSET_REGISTRY[type] || { label: type || "Objeto", modelUrl: null, fallback: "box" };
}

export function resolveInventoryMapAssetMode(type, quality = MODEL_QUALITY_SIMPLE) {
  const definition = getInventoryMapAssetDefinition(type);
  return quality === MODEL_QUALITY_DETAILED && definition.modelUrl
    ? { mode: "model", url: `${MODEL_BASE}/${definition.modelUrl}`, definition }
    : { mode: "fallback", url: null, definition };
}
