export const STRUCTURE_PRESETS = new Set(["wall", "partition", "room", "corridor", "desk", "rack"]);

export const VISUAL_MAP_LAYERS = new Set(["structure", "assets", "infrastructure", "electrical"]);

export const CONNECTION_LAYERS = new Set(["infrastructure", "electrical"]);

export const ASSET_PRESETS = new Set([
  "desktop",
  "notebook",
  "server",
  "switch",
  "router",
  "access_point",
  "printer",
  "ups",
  "network_point",
  "power_point"
]);

export const INFRASTRUCTURE_PRESETS = new Set([
  "network_point",
  "network_cable",
  "backbone",
  "technical_rack",
  "switch",
  "router",
  "access_point",
  "patch_panel",
  "ip_camera"
]);

export const ELECTRICAL_PRESETS = new Set([
  "power_point",
  "outlet",
  "power_line",
  "circuit",
  "electrical_panel",
  "ups"
]);

export const INFRASTRUCTURE_CONNECTION_TYPES = new Set([
  "network_cable",
  "backbone",
  "uplink",
  "rack_link",
  "ap_coverage_link"
]);

export const ELECTRICAL_CONNECTION_TYPES = new Set([
  "power_line",
  "circuit_line",
  "ups_line"
]);

export const DEFAULT_STRUCTURE_DIMENSIONS = {
  wall: { width: 4, depth: 0.18, height: 2.4, color: "#64748b", label: "Parede" },
  partition: { width: 3, depth: 0.12, height: 1.6, color: "#94a3b8", label: "Divisoria" },
  room: { width: 5, depth: 4, height: 0.15, color: "#cbd5e1", label: "Sala" },
  corridor: { width: 6, depth: 2, height: 0.08, color: "#dbeafe", label: "Corredor" },
  desk: { width: 1.8, depth: 0.85, height: 0.75, color: "#b45309", label: "Mesa" },
  rack: { width: 0.85, depth: 1, height: 2, color: "#334155", label: "Rack" }
};

export const DEFAULT_ASSET_DIMENSIONS = {
  desktop: { width: 0.9, depth: 0.65, height: 0.35, color: "#2563eb", label: "Desktop" },
  notebook: { width: 0.8, depth: 0.55, height: 0.18, color: "#7c3aed", label: "Notebook" },
  server: { width: 0.95, depth: 0.95, height: 1.25, color: "#0f766e", label: "Servidor" },
  switch: { width: 0.75, depth: 0.45, height: 0.18, color: "#1d4ed8", label: "Switch" },
  router: { width: 0.65, depth: 0.45, height: 0.22, color: "#0284c7", label: "Roteador" },
  access_point: { width: 0.45, depth: 0.45, height: 0.12, color: "#0891b2", label: "Access point" },
  printer: { width: 0.85, depth: 0.75, height: 0.45, color: "#ca8a04", label: "Impressora" },
  ups: { width: 0.55, depth: 0.6, height: 0.55, color: "#9333ea", label: "Nobreak" },
  network_point: { width: 0.28, depth: 0.12, height: 0.28, color: "#16a34a", label: "Ponto de rede" },
  power_point: { width: 0.28, depth: 0.12, height: 0.28, color: "#dc2626", label: "Ponto eletrico" }
};

export const DEFAULT_INFRASTRUCTURE_DIMENSIONS = {
  network_point: { width: 0.28, depth: 0.12, height: 0.28, color: "#16a34a", label: "Ponto de rede" },
  network_cable: { width: 2.2, depth: 0.08, height: 0.08, color: "#0ea5e9", label: "Cabo de rede" },
  backbone: { width: 3.2, depth: 0.1, height: 0.1, color: "#0284c7", label: "Backbone" },
  technical_rack: { width: 0.9, depth: 1, height: 2.1, color: "#334155", label: "Rack tecnico" },
  switch: { width: 0.75, depth: 0.45, height: 0.18, color: "#1d4ed8", label: "Switch" },
  router: { width: 0.65, depth: 0.45, height: 0.22, color: "#0284c7", label: "Roteador" },
  access_point: { width: 0.45, depth: 0.45, height: 0.12, color: "#0891b2", label: "Access point" },
  patch_panel: { width: 0.8, depth: 0.35, height: 0.16, color: "#0369a1", label: "Patch panel" },
  ip_camera: { width: 0.35, depth: 0.35, height: 0.25, color: "#475569", label: "Camera IP" }
};

export const DEFAULT_ELECTRICAL_DIMENSIONS = {
  power_point: { width: 0.28, depth: 0.12, height: 0.28, color: "#dc2626", label: "Ponto eletrico" },
  outlet: { width: 0.28, depth: 0.12, height: 0.22, color: "#f97316", label: "Tomada" },
  power_line: { width: 2.2, depth: 0.08, height: 0.08, color: "#f59e0b", label: "Linha eletrica" },
  circuit: { width: 1.4, depth: 0.16, height: 0.14, color: "#eab308", label: "Circuito" },
  electrical_panel: { width: 0.75, depth: 0.22, height: 1.1, color: "#b45309", label: "Quadro eletrico" },
  ups: { width: 0.55, depth: 0.6, height: 0.55, color: "#9333ea", label: "Nobreak" }
};

export const ALL_PRESETS = new Set([
  ...STRUCTURE_PRESETS,
  ...ASSET_PRESETS,
  ...INFRASTRUCTURE_PRESETS,
  ...ELECTRICAL_PRESETS
]);

export const CONNECTION_TYPES_BY_LAYER = {
  infrastructure: INFRASTRUCTURE_CONNECTION_TYPES,
  electrical: ELECTRICAL_CONNECTION_TYPES
};

export const DEFAULT_CONNECTION_BY_LAYER = {
  infrastructure: "network_cable",
  electrical: "power_line"
};

export const DEFAULT_CONNECTION_COLOR_BY_LAYER = {
  infrastructure: "#0ea5e9",
  electrical: "#f97316"
};

export function resolveObjectLayer(presetType, explicitLayer) {
  if (VISUAL_MAP_LAYERS.has(explicitLayer)) return explicitLayer;
  if (STRUCTURE_PRESETS.has(presetType)) return "structure";
  if (INFRASTRUCTURE_PRESETS.has(presetType)) return "infrastructure";
  if (ELECTRICAL_PRESETS.has(presetType)) return "electrical";
  return "assets";
}

export function defaultsForPreset(presetType, layer) {
  if (layer === "structure") return DEFAULT_STRUCTURE_DIMENSIONS[presetType];
  if (layer === "infrastructure") return DEFAULT_INFRASTRUCTURE_DIMENSIONS[presetType];
  if (layer === "electrical") return DEFAULT_ELECTRICAL_DIMENSIONS[presetType];
  return DEFAULT_ASSET_DIMENSIONS[presetType];
}

export function resolveConnectionTypeLayer(connectionType) {
  if (INFRASTRUCTURE_CONNECTION_TYPES.has(connectionType)) return "infrastructure";
  if (ELECTRICAL_CONNECTION_TYPES.has(connectionType)) return "electrical";
  return null;
}
