const WIDTH_COLUMNS = { s: 3, m: 4, l: 8, xl: 12 };
const HEIGHT_ROWS = { s: 2, m: 3, l: 4 };
const DEFAULT_WIDTH_TIER = "m";
const DEFAULT_HEIGHT_TIER = "s";

export const WIDTH_TIERS = Object.keys(WIDTH_COLUMNS);
export const HEIGHT_TIERS = Object.keys(HEIGHT_ROWS);

export function widthColumns(tier) {
  return WIDTH_COLUMNS[tier] || WIDTH_COLUMNS[DEFAULT_WIDTH_TIER];
}

export function heightRows(tier) {
  return HEIGHT_ROWS[tier] || HEIGHT_ROWS[DEFAULT_HEIGHT_TIER];
}

/**
 * Estilo inline do widget dentro do grid CSS (grid-auto-flow: dense) --
 * x/y do modelo salvo so definem a ORDEM (a densidade do proprio grid faz o
 * empacotamento visual), entao aqui so precisamos do span de largura/altura
 * a partir dos tiers discretos.
 */
export function widgetGridStyle(widget) {
  return {
    gridColumn: `span ${widthColumns(widget?.w)}`,
    gridRow: `span ${heightRows(widget?.h)}`
  };
}

/**
 * Ordena os widgets pela mesma chave usada como posicao no modelo salvo (y
 * crescente, x como desempate) -- e essa ordem no DOM que o grid denso usa
 * para decidir onde encaixar cada um.
 */
export function sortWidgetsByPosition(widgets) {
  return [...(widgets || [])].sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

/**
 * Reindexa y sequencialmente (0..N-1) preservando a ordem recebida -- usado
 * apos reordenar por drag-and-drop, mantendo x sempre 0 (x so existe no
 * modelo por compatibilidade futura, o layout de hoje e uma lista 1D).
 */
export function reindexWidgetPositions(widgets) {
  return widgets.map((widget, index) => ({ ...widget, x: 0, y: index }));
}
