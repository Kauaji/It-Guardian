export const VISUAL_MAP_LAYER_OPTIONS = [
  { key: "structure", label: "Estrutura" },
  { key: "assets", label: "Ativos" },
  { key: "infrastructure", label: "Infraestrutura" },
  { key: "electrical", label: "Eletrica" }
];

export const QUICK_LAYER_VIEWS = [
  { key: "all", label: "Tudo", layers: ["structure", "assets", "infrastructure", "electrical"] },
  { key: "structure", label: "Estrutura", layers: ["structure"] },
  { key: "assets", label: "Ativos", layers: ["assets"] },
  { key: "infrastructure", label: "Infra", layers: ["infrastructure"] },
  { key: "electrical", label: "Eletrica", layers: ["electrical"] },
  { key: "infra-assets", label: "Infra + ativos", layers: ["infrastructure", "assets"] },
  { key: "electrical-assets", label: "Eletrica + ativos", layers: ["electrical", "assets"] }
];

export const INFRASTRUCTURE_PRESETS = [
  { type: "network_point", label: "Ponto de rede", layer: "infrastructure" },
  { type: "network_cable", label: "Cabo", layer: "infrastructure" },
  { type: "backbone", label: "Backbone", layer: "infrastructure" },
  { type: "technical_rack", label: "Rack tecnico", layer: "infrastructure" },
  { type: "switch", label: "Switch", layer: "infrastructure" },
  { type: "router", label: "Roteador", layer: "infrastructure" },
  { type: "access_point", label: "Access point", layer: "infrastructure" },
  { type: "patch_panel", label: "Patch panel", layer: "infrastructure" },
  { type: "ip_camera", label: "Camera IP", layer: "infrastructure" }
];

export const ELECTRICAL_PRESETS = [
  { type: "power_point", label: "Ponto eletrico", layer: "electrical" },
  { type: "outlet", label: "Tomada", layer: "electrical" },
  { type: "power_line", label: "Linha", layer: "electrical" },
  { type: "circuit", label: "Circuito", layer: "electrical" },
  { type: "electrical_panel", label: "Quadro eletrico", layer: "electrical" },
  { type: "ups", label: "Nobreak", layer: "electrical" }
];

export const CONNECTION_TYPE_OPTIONS = [
  { type: "network_cable", label: "Cabo de rede", layer: "infrastructure" },
  { type: "backbone", label: "Backbone", layer: "infrastructure" },
  { type: "uplink", label: "Uplink", layer: "infrastructure" },
  { type: "rack_link", label: "Rack link", layer: "infrastructure" },
  { type: "ap_coverage_link", label: "Cobertura AP", layer: "infrastructure" },
  { type: "power_line", label: "Linha eletrica", layer: "electrical" },
  { type: "circuit_line", label: "Circuito", layer: "electrical" },
  { type: "ups_line", label: "Linha nobreak", layer: "electrical" }
];

export function getQuickLayerState(viewKey) {
  const quickView = QUICK_LAYER_VIEWS.find((view) => view.key === viewKey) || QUICK_LAYER_VIEWS[0];
  return VISUAL_MAP_LAYER_OPTIONS.reduce((state, option) => {
    state[option.key] = quickView.layers.includes(option.key);
    return state;
  }, {});
}

export function getConnectionTypeLabel(type) {
  return CONNECTION_TYPE_OPTIONS.find((option) => option.type === type)?.label || type || "Conexao";
}

export function getConnectionLayer(type) {
  return CONNECTION_TYPE_OPTIONS.find((option) => option.type === type)?.layer || "infrastructure";
}

export function buildDefaultConnectionDraft(layer = "infrastructure") {
  const connectionType = layer === "electrical" ? "power_line" : "network_cable";
  return {
    layer,
    connectionType,
    label: "",
    points: [
      { x: -2, y: 0.08, z: -2 },
      { x: 2, y: 0.08, z: 2 }
    ],
    color: layer === "electrical" ? "#f97316" : "#0ea5e9",
    thickness: 2,
    dashed: false,
    notes: "",
    metadata: {}
  };
}

export function isLayerVisible(layers, layer) {
  return layers?.[layer] !== false;
}

