import { useCallback, useEffect, useRef, useState } from "react";
import { expandFloorInDraft } from "../utils/entityMutations.js";
import { createPanDrag } from "../utils/dragState.js";
import {
  clientToSvgPoint,
  getBaseViewBox,
  getFitViewBox,
  getFloorSize,
  panViewBox,
  zoomViewBoxAtPoint,
  zoomViewBoxCentered
} from "../utils/viewportGeometry.js";

const WHEEL_ZOOM_IN = 0.86;
const WHEEL_ZOOM_OUT = 1.14;
const CLICK_ZOOM_IN = 0.82;
const CLICK_ZOOM_OUT = 1.22;

/**
 * Viewport do canvas 2D: caixa de visualizacao (zoom/pan), conversao de
 * coordenadas de tela para SVG, zoom por roda/clique/botoes e expansao da area.
 */
export function useCanvasViewport({ doc, ui }) {
  const { editor, activeFloorId, activeFloorRecord, commitEditor } = doc;
  const { zoomMode } = ui;
  const svgRef = useRef(null);
  const [canvasViewBox, setCanvasViewBox] = useState(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    setCanvasViewBox(null);
  }, [activeFloorId, editor?.plan?.id]);

  const getFloorDimensions = () => getFloorSize(activeFloorRecord, editor?.plan);

  const getSvgPoint = useCallback((event) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    return clientToSvgPoint({
      rect: svg.getBoundingClientRect(),
      viewBox: svg.viewBox.baseVal,
      clientX: event.clientX,
      clientY: event.clientY
    });
  }, []);

  /** Zoom ancorado no ponteiro (roda do mouse com o modo zoom ligado). */
  const handleWheel = (event) => {
    if (!zoomMode) return;
    event.preventDefault();
    if (!activeFloorRecord) return;
    setCanvasViewBox(zoomViewBoxAtPoint({
      viewBox: canvasViewBox,
      floorSize: getFloorDimensions(),
      pointer: getSvgPoint(event),
      factor: event.deltaY < 0 ? WHEEL_ZOOM_IN : WHEEL_ZOOM_OUT
    }));
  };

  /** Clique no modo zoom: aproxima (ou afasta com Shift) no ponto clicado. */
  const zoomAtClick = (event) => {
    if (!activeFloorRecord) return;
    setCanvasViewBox(zoomViewBoxAtPoint({
      viewBox: canvasViewBox,
      floorSize: getFloorDimensions(),
      pointer: getSvgPoint(event),
      factor: event.shiftKey ? CLICK_ZOOM_OUT : CLICK_ZOOM_IN
    }));
  };

  /** Inicia o pan e devolve o estado do arrasto a ser guardado pelo chamador. */
  const beginPan = (event) => {
    const floorSize = getFloorDimensions();
    setIsPanning(true);
    return createPanDrag({
      clientX: event.clientX,
      clientY: event.clientY,
      viewBox: canvasViewBox || getBaseViewBox(floorSize)
    });
  };

  const movePan = (event, drag) => {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds?.height) return;
    setCanvasViewBox(panViewBox({
      origin: drag.viewBox,
      startClient: { x: drag.clientX, y: drag.clientY },
      currentClient: { x: event.clientX, y: event.clientY },
      bounds,
      floorSize: getFloorDimensions()
    }));
  };

  const endPan = (event) => {
    event?.currentTarget?.releasePointerCapture?.(event.pointerId);
    setIsPanning(false);
  };

  const fitToFloor = () => {
    if (!activeFloorRecord) return;
    setCanvasViewBox(getFitViewBox(getFloorDimensions()));
  };

  const resetZoom = useCallback(() => {
    setCanvasViewBox(null);
  }, []);

  const zoomBy = (factor) => {
    if (!activeFloorRecord) return;
    setCanvasViewBox(zoomViewBoxCentered({ viewBox: canvasViewBox, floorSize: getFloorDimensions(), factor }));
  };

  const expandCanvas = (axis) => {
    commitEditor((draft) => expandFloorInDraft(draft, activeFloorId, axis));
    setCanvasViewBox(null);
  };

  return {
    svgRef,
    canvasViewBox,
    spacePressed,
    setSpacePressed,
    isPanning,
    getSvgPoint,
    handleWheel,
    zoomAtClick,
    beginPan,
    movePan,
    endPan,
    fitToFloor,
    resetZoom,
    zoomBy,
    expandCanvas,
    zoomIn: () => zoomBy(CLICK_ZOOM_IN),
    zoomOut: () => zoomBy(CLICK_ZOOM_OUT)
  };
}
