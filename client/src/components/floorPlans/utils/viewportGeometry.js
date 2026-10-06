import { DEFAULT_PLAN_SIZE, clamp } from "./editorGeometry.js";

/** Folga (fracao do pavimento) permitida ao arrastar/dar zoom alem das bordas. */
export const VIEWPORT_PADDING_RATIO = 0.12;

/** Dimensoes do pavimento ativo, com fallback para o plano e para o padrao. */
export function getFloorSize(floor, plan) {
  return {
    width: Number(floor?.width || plan?.width || DEFAULT_PLAN_SIZE.width),
    height: Number(floor?.height || plan?.height || DEFAULT_PLAN_SIZE.height)
  };
}

/** Caixa de visualizacao que enquadra o pavimento inteiro (zoom 100%). */
export function getBaseViewBox(floorSize) {
  return { x: 0, y: 0, width: floorSize.width, height: floorSize.height };
}

/** Zoom ancorado no ponteiro (roda do mouse e clique no modo zoom). */
export function zoomViewBoxAtPoint({ viewBox, floorSize, pointer, factor }) {
  const { width: floorWidth, height: floorHeight } = floorSize;
  const current = viewBox || getBaseViewBox(floorSize);
  const nextWidth = clamp(current.width * factor, floorWidth * 0.2, floorWidth * 1.4);
  const nextHeight = clamp(current.height * factor, floorHeight * 0.2, floorHeight * 1.4);
  const widthRatio = nextWidth / current.width;
  const heightRatio = nextHeight / current.height;
  const paddingX = floorWidth * VIEWPORT_PADDING_RATIO;
  const paddingY = floorHeight * VIEWPORT_PADDING_RATIO;
  return {
    x: clamp(pointer.x - (pointer.x - current.x) * widthRatio, floorWidth - nextWidth - paddingX, paddingX),
    y: clamp(pointer.y - (pointer.y - current.y) * heightRatio, floorHeight - nextHeight - paddingY, paddingY),
    width: nextWidth,
    height: nextHeight
  };
}

/**
 * Pan: desloca a caixa de origem pelo movimento do cursor em pixels de tela,
 * convertido para unidades do SVG.
 */
export function panViewBox({ origin, startClient, currentClient, bounds, floorSize }) {
  const deltaX = (currentClient.x - startClient.x) * (origin.width / bounds.width);
  const deltaY = (currentClient.y - startClient.y) * (origin.height / bounds.height);
  const paddingX = floorSize.width * VIEWPORT_PADDING_RATIO;
  const paddingY = floorSize.height * VIEWPORT_PADDING_RATIO;
  return {
    ...origin,
    x: clamp(origin.x - deltaX, floorSize.width - origin.width - paddingX, paddingX),
    y: clamp(origin.y - deltaY, floorSize.height - origin.height - paddingY, paddingY)
  };
}

/** Zoom pelos botoes (+/-): mantem o centro e nao passa do pavimento. */
export function zoomViewBoxCentered({ viewBox, floorSize, factor }) {
  const { width: floorWidth, height: floorHeight } = floorSize;
  const current = viewBox || getBaseViewBox(floorSize);
  const centerX = current.x + current.width / 2;
  const centerY = current.y + current.height / 2;
  const nextWidth = clamp(current.width * factor, floorWidth * 0.25, floorWidth);
  const nextHeight = clamp(current.height * factor, floorHeight * 0.25, floorHeight);
  return {
    x: clamp(centerX - nextWidth / 2, 0, Math.max(0, floorWidth - nextWidth)),
    y: clamp(centerY - nextHeight / 2, 0, Math.max(0, floorHeight - nextHeight)),
    width: nextWidth,
    height: nextHeight
  };
}

/** "Enquadrar planta": pavimento inteiro com uma margem proporcional. */
export function getFitViewBox(floorSize) {
  const { width, height } = floorSize;
  const padding = Math.max(32, Math.round(Math.min(width, height) * 0.04));
  return {
    x: -padding,
    y: -padding,
    width: width + padding * 2,
    height: height + padding * 2
  };
}

/** Percentual de zoom mostrado no controle (100% = pavimento inteiro). */
export function getZoomPercent(floor, viewBox) {
  const floorWidth = Number(floor?.width || DEFAULT_PLAN_SIZE.width);
  return Math.round((100 * floorWidth) / Number(viewBox?.width || floor?.width || DEFAULT_PLAN_SIZE.width));
}

/** Converte coordenadas de tela (cliente) para o sistema de coordenadas do SVG. */
export function clientToSvgPoint({ rect, viewBox, clientX, clientY }) {
  return {
    x: ((clientX - rect.left) / rect.width) * viewBox.width + viewBox.x,
    y: ((clientY - rect.top) / rect.height) * viewBox.height + viewBox.y
  };
}
