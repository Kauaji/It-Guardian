import { getObjectSize } from "./editorGeometry.js";

/**
 * Alcas de redimensionamento de um objeto selecionado (coordenadas locais, antes
 * da rotacao): quatro setas nas laterais e quatro cantos.
 */
export function getObjectResizeHandles(object) {
  const { width, height } = getObjectSize(object);
  const x = Number(object.x || 0);
  const y = Number(object.y || 0);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  return [
    { side: "north", x: centerX, y: y - 18, label: "Ajustar altura para cima" },
    { side: "east", x: x + width + 18, y: centerY, label: "Ajustar largura para direita" },
    { side: "south", x: centerX, y: y + height + 18, label: "Ajustar altura para baixo" },
    { side: "west", x: x - 18, y: centerY, label: "Ajustar largura para esquerda" },
    { side: "northwest", x: x - 8, y: y - 8, label: "Redimensionar pelo canto superior esquerdo" },
    { side: "northeast", x: x + width + 8, y: y - 8, label: "Redimensionar pelo canto superior direito" },
    { side: "southeast", x: x + width + 8, y: y + height + 8, label: "Redimensionar pelo canto inferior direito" },
    { side: "southwest", x: x - 8, y: y + height + 8, label: "Redimensionar pelo canto inferior esquerdo" }
  ];
}
