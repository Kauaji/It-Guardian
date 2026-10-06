import {
  ELECTRICAL_PRESETS,
  INFRASTRUCTURE_PRESETS,
  VISUAL_MAP_LAYER_OPTIONS
} from "../inventoryVisualMapConnectionUtils.js";

export const STRUCTURE_PRESETS = [
  { type: "wall", label: "Parede" },
  { type: "partition", label: "Divisória" },
  { type: "room", label: "Sala" },
  { type: "corridor", label: "Corredor" },
  { type: "desk", label: "Mesa" },
  { type: "rack", label: "Rack" }
];

export const ASSET_PRESETS = [
  { type: "desktop", label: "Desktop" },
  { type: "notebook", label: "Notebook" },
  { type: "server", label: "Servidor" },
  { type: "switch", label: "Switch" },
  { type: "router", label: "Roteador" },
  { type: "access_point", label: "Access point" },
  { type: "printer", label: "Impressora" },
  { type: "ups", label: "Nobreak" },
  { type: "network_point", label: "Ponto de rede" },
  { type: "power_point", label: "Ponto elétrico" }
];

export const LAYER_LABELS = VISUAL_MAP_LAYER_OPTIONS.reduce((labels, option) => {
  labels[option.key] = option.label;
  return labels;
}, {});

export const ALL_OBJECT_PRESETS = [
  ...STRUCTURE_PRESETS,
  ...ASSET_PRESETS,
  ...INFRASTRUCTURE_PRESETS,
  ...ELECTRICAL_PRESETS
];

// Grupos de botoes do painel "Adicionar", na ordem exibida.
export const ADD_PRESET_GROUPS = [
  { heading: "Estrutura", layer: "structure", presets: STRUCTURE_PRESETS },
  { heading: "Ativos", layer: "assets", presets: ASSET_PRESETS },
  { heading: "Infraestrutura", layer: "infrastructure", presets: INFRASTRUCTURE_PRESETS },
  { heading: "Elétrica", layer: "electrical", presets: ELECTRICAL_PRESETS }
];

export const METADATA_FIELDS = [
  { key: "circuit", label: "Circuito" },
  { key: "voltage", label: "Tensão" },
  { key: "panel", label: "Quadro" },
  { key: "breaker", label: "Disjuntor" },
  { key: "criticality", label: "Criticidade" },
  { key: "note", label: "Nota" }
];

export const ASSET_TYPE_TO_PRESET = {
  desktop: "desktop",
  computador: "desktop",
  computer: "desktop",
  notebook: "notebook",
  laptop: "notebook",
  servidor: "server",
  server: "server",
  impressora: "printer",
  printer: "printer",
  switch: "switch",
  roteador: "router",
  router: "router",
  access_point: "access_point",
  ap: "access_point",
  nobreak: "ups",
  ups: "ups"
};

// Campos numericos do painel do objeto (ordem e atributos identicos ao original).
export const OBJECT_NUMBER_FIELDS = [
  { key: "positionX", label: "X", step: "0.1" },
  { key: "positionY", label: "Y", step: "0.1" },
  { key: "positionZ", label: "Z", step: "0.1" },
  { key: "rotationX", label: "Rotação X", step: "5" },
  { key: "rotationY", label: "Rotação Y", step: "5" },
  { key: "rotationZ", label: "Rotação Z", step: "5" },
  { key: "width", label: "Largura", step: "0.1", min: "0.1" },
  { key: "depth", label: "Profundidade", step: "0.1", min: "0.1" },
  { key: "height", label: "Altura", step: "0.1", min: "0.05" }
];
