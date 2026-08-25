// Mesmo valor de ROOM_DEFAULTS.metersPerGridCell (roomGeometry.js) - duplicado
// como constante isolada (nao importado) para este util nao depender de volta
// de roomGeometry.js, que por sua vez passa a depender deste arquivo.
const DEFAULT_METERS_PER_GRID_CELL = 0.5;
const DEFAULT_GRID_SIZE = 25;

/**
 * Fonte unica da conversao px<->metros do editor de planta baixa - antes
 * vivia embutida (e duplicada) dentro de roomGeometry.js, so para a area de
 * salas. Generalizada aqui para tambem servir a ferramenta de medida.
 */
export function pxToMeters(px, plan = {}) {
  const gridSize = Number(plan.gridSize || DEFAULT_GRID_SIZE);
  const metersPerGridCell = Number(plan.metersPerGridCell || DEFAULT_METERS_PER_GRID_CELL);
  return (Number(px || 0) / gridSize) * metersPerGridCell;
}

export function metersToPx(meters, plan = {}) {
  const gridSize = Number(plan.gridSize || DEFAULT_GRID_SIZE);
  const metersPerGridCell = Number(plan.metersPerGridCell || DEFAULT_METERS_PER_GRID_CELL);
  return (Number(meters || 0) / metersPerGridCell) * gridSize;
}

/**
 * "85 cm" abaixo de 1 metro (mais legivel que "0,85 m" pra medidas curtas
 * tipo vao de porta), "3,20 m" com virgula decimal pt-BR acima disso.
 */
export function formatLength(meters) {
  const value = Number(meters || 0);
  if (value < 1) {
    return `${Math.round(value * 100)} cm`;
  }
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
}
