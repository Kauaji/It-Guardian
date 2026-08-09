const MODEL_BASE = "/assets/inventory-map-3d/models";

const cc0 = (id, label, category, modelPath, fallback, extra = {}) => ({
  id,
  label,
  category,
  modelPath: modelPath ? `${MODEL_BASE}/${modelPath}` : null,
  thumbnailPath: null,
  license: "CC0-1.0",
  source: modelPath?.startsWith("kenney/") ? "Kenney Furniture Kit" : modelPath ? "Quaternius Ultimate Furniture Pack" : "IT Guardian procedural geometry",
  author: modelPath?.startsWith("kenney/") ? "Kenney" : modelPath ? "Quaternius" : "IT Guardian",
  sourceUrl: modelPath?.startsWith("kenney/") ? "https://kenney.nl/assets/furniture-kit" : modelPath ? "https://quaternius.com/packs/ultimatefurniture.html" : null,
  dimensions: extra.dimensions || { width: 80, depth: 50, height: 80 },
  defaultScale: extra.defaultScale || 1,
  defaultRotation: extra.defaultRotation || 0,
  tags: extra.tags || [],
  linkableToInventory: Boolean(extra.linkableToInventory),
  assetType: extra.assetType || id,
  fallback
});

export const FLOOR_PLAN_LIBRARY = Object.freeze([
  cc0("desk", "Mesa de escritorio", "office", "quaternius/desk.glb", "desk", { dimensions: { width: 96, depth: 54, height: 46 }, tags: ["mesa", "trabalho"] }),
  cc0("meeting_table", "Mesa de reuniao", "office", "quaternius/table.glb", "desk", { dimensions: { width: 150, depth: 78, height: 46 }, tags: ["mesa", "reuniao"] }),
  cc0("chair", "Cadeira", "office", "quaternius/chair.glb", "chair", { dimensions: { width: 42, depth: 42, height: 82 } }),
  cc0("cabinet", "Armario", "office", "quaternius/cabinet.glb", "box"),
  cc0("shelf", "Estante", "office", "quaternius/shelf.glb", "box"),
  cc0("door", "Porta", "structure", "quaternius/door.glb", "door"),
  cc0("pc", "Computador", "it", null, "pc", { dimensions: { width: 82, depth: 58, height: 46 }, tags: ["computador", "desktop"], linkableToInventory: true, assetType: "computer" }),
  cc0("notebook", "Notebook", "it", "kenney/laptop.glb", "notebook", { linkableToInventory: true }),
  cc0("monitor", "Monitor", "it", "kenney/computerScreen.glb", "monitor", { linkableToInventory: true }),
  cc0("tv", "TV", "office", "kenney/televisionModern.glb", "tv", { linkableToInventory: true }),
  cc0("printer", "Impressora", "it", null, "printer", { linkableToInventory: true }),
  cc0("switch", "Switch", "network", null, "network-box", { linkableToInventory: true }),
  cc0("router", "Roteador", "network", null, "network-box", { linkableToInventory: true }),
  cc0("rack", "Rack", "network", null, "rack", { linkableToInventory: true }),
  cc0("server", "Servidor", "it", null, "rack", { linkableToInventory: true }),
  cc0("access_point", "Access point", "network", null, "access-point", { linkableToInventory: true }),
  cc0("camera", "Camera IP", "network", null, "camera", { linkableToInventory: true }),
  cc0("patch_panel", "Patch panel", "network", null, "network-box", { linkableToInventory: true }),
  cc0("ups", "Nobreak", "it", null, "power-box", { linkableToInventory: true }),
  cc0("hospital_bed", "Leito hospitalar", "hospital", null, "hospital-bed", { dimensions: { width: 96, depth: 210, height: 64 } }),
  cc0("stretcher", "Maca", "hospital", null, "hospital-bed", { dimensions: { width: 76, depth: 190, height: 72 } }),
  cc0("medical_cart", "Carrinho medico", "hospital", null, "medical-cart"),
  cc0("reception_counter", "Balcao de recepcao", "hospital", null, "counter", { dimensions: { width: 150, depth: 60, height: 105 } })
]);

export const FLOOR_PLAN_LIBRARY_BY_ID = Object.freeze(Object.fromEntries(FLOOR_PLAN_LIBRARY.map((asset) => [asset.id, asset])));

export function getFloorPlanLibraryAsset(id) {
  return FLOOR_PLAN_LIBRARY_BY_ID[id] || null;
}
