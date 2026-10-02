import * as THREE from "three";
import { isMeasurementObject } from "../utils/measurementGeometry.js";
import { CAMERA_VIEW_FRONT, CAMERA_VIEW_TOP } from "./constants.js";

/**
 * Enquadramento do conteudo do pavimento (comodos, objetos e rotas), com folga,
 * e o centro dele em relacao ao centro do pavimento. Sem conteudo, usa o
 * pavimento inteiro.
 */
export function getFloorPlanContentFrame(data, activeFloorId, floorWidth, floorHeight) {
  const bounds = [];
  const matchesFloor = (entry) => !activeFloorId || entry?.floorId === activeFloorId;
  const addRect = (x, y, width, height) => {
    const rectWidth = Math.max(0, Number(width || 0));
    const rectHeight = Math.max(0, Number(height || 0));
    if (!rectWidth && !rectHeight) return;
    bounds.push({
      minX: Number(x || 0),
      minY: Number(y || 0),
      maxX: Number(x || 0) + rectWidth,
      maxY: Number(y || 0) + rectHeight
    });
  };

  (data?.zones || []).filter(matchesFloor).forEach((zone) => {
    const geometry = zone.geometry || {};
    addRect(geometry.x, geometry.y, geometry.width, geometry.height);
  });
  (data?.objects || []).filter(matchesFloor).forEach((object) => {
    if (!isMeasurementObject(object)) addRect(object.x, object.y, object.width, object.height);
  });
  (data?.cableRoutes || []).filter(matchesFloor).forEach((route) => {
    (route.path || []).forEach((point) => addRect(point.x, point.y, 1, 1));
  });

  const safeFloorWidth = Math.max(1, Number(floorWidth || 0));
  const safeFloorHeight = Math.max(1, Number(floorHeight || 0));
  if (!bounds.length) {
    return { width: safeFloorWidth, height: safeFloorHeight, centerX: 0, centerZ: 0 };
  }

  const minX = Math.min(...bounds.map((bound) => bound.minX));
  const minY = Math.min(...bounds.map((bound) => bound.minY));
  const maxX = Math.max(...bounds.map((bound) => bound.maxX));
  const maxY = Math.max(...bounds.map((bound) => bound.maxY));
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const padding = Math.max(48, Math.max(contentWidth, contentHeight) * 0.12);

  return {
    width: Math.min(safeFloorWidth, Math.max(420, contentWidth + padding * 2)),
    height: Math.min(safeFloorHeight, Math.max(320, contentHeight + padding * 2)),
    centerX: (minX + maxX) / 2 - safeFloorWidth / 2,
    centerZ: (minY + maxY) / 2 - safeFloorHeight / 2
  };
}

/** Posicao e alvo da camera para uma vista (superior, frontal ou isometrica) que enquadra o conteudo. */
export function getFloorPlanCameraPreset(
  view,
  floorWidth,
  floorHeight,
  aspect = 1,
  fieldOfView = 42,
  targetX = 0,
  targetZ = 0
) {
  const safeWidth = Math.max(1, Number(floorWidth || 0));
  const safeHeight = Math.max(1, Number(floorHeight || 0));
  const safeAspect = Math.max(0.2, Number(aspect || 1));
  const verticalFov = THREE.MathUtils.degToRad(fieldOfView);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * safeAspect);
  const fitWidthDistance = safeWidth / 2 / Math.tan(horizontalFov / 2);
  const fitDepthDistance = safeHeight / 2 / Math.tan(verticalFov / 2);
  const fitDistance = Math.max(280, fitWidthDistance, fitDepthDistance) * 1.08;
  const target = new THREE.Vector3(Number(targetX || 0), 28, Number(targetZ || 0));

  if (view === CAMERA_VIEW_TOP) {
    return {
      position: target.clone().add(new THREE.Vector3(0, fitDistance, 0.01)),
      target
    };
  }

  if (view === CAMERA_VIEW_FRONT) {
    return {
      position: target.clone().add(new THREE.Vector3(0, fitDistance * 0.42, fitDistance * 1.02)),
      target
    };
  }

  const direction = new THREE.Vector3(0.64, 0.72, 0.82).normalize();
  return {
    position: target.clone().add(direction.multiplyScalar(fitDistance * 1.12)),
    target
  };
}

/** Suavizacao (ease in-out cubica) da animacao de camera; progresso de 0 a 1. */
export function easeCamera(progress) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}
