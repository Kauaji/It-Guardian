/**
 * Recortes (vaos) que as aberturas ancoradas fazem em uma parede de largura
 * `width`, ordenados da esquerda para a direita. Cada vao tem pelo menos 12 px
 * e fica centrado em `metadata.anchorOffset` (0 a 1) da parede.
 */
export function getWallOpeningCuts(width, openings = []) {
  return openings
    .map((opening) => {
      const openingWidth = Math.min(width, Math.max(12, Number(opening.width || 0)));
      const center = Math.max(0, Math.min(width, Number(opening.metadata?.anchorOffset ?? 0.5) * width));
      return {
        start: Math.max(0, center - openingWidth / 2),
        end: Math.min(width, center + openingWidth / 2)
      };
    })
    .sort((a, b) => a.start - b.start);
}

/**
 * Trechos macicos da parede entre os vaos. Sem vaos, a parede inteira e um
 * unico trecho (`[{ start: 0, end: width }]`).
 */
export function getWallSolidSegments(width, cuts) {
  if (!cuts.length) return [{ start: 0, end: width }];
  const segments = [];
  let cursor = 0;
  cuts.forEach((cut) => {
    if (cut.start > cursor) segments.push({ start: cursor, end: cut.start });
    cursor = Math.max(cursor, cut.end);
  });
  if (cursor < width) segments.push({ start: cursor, end: width });
  return segments;
}
