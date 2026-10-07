export const FLOOR_PLAN_LAYER_OPTIONS = [
  { id: "rooms", label: "Cômodos" },
  { id: "areas", label: "Áreas" },
  { id: "objects", label: "Objetos" },
  { id: "network", label: "Rede" },
  { id: "energy", label: "Energia" },
  { id: "labels", label: "Textos" }
];

export const DEFAULT_FLOOR_PLAN_LAYERS = FLOOR_PLAN_LAYER_OPTIONS.reduce(
  (layers, option) => ({
    ...layers,
    [option.id]: true
  }),
  {}
);

/** Mescla as camadas escolhidas com o padrao (camadas ausentes ficam visiveis). */
export function resolveLayerState(visibleLayers) {
  return { ...DEFAULT_FLOOR_PLAN_LAYERS, ...(visibleLayers || {}) };
}
