import { findNearestDesktop, getActiveFloor, isPowerAccessoryObject } from "./editorGeometry.js";
import { resolveLayerState } from "./layers.js";
import { isRoomZone } from "./roomGeometry.js";
import { syncAnchoredOpenings } from "./wallGeometry.js";
import { getFloorSize } from "./viewportGeometry.js";

function isPointVisible(point, layerState) {
  return point.pointType === "power" ? layerState.energy : layerState.network;
}

function isRouteVisible(route, layerState) {
  return route.routeType === "power" ? layerState.energy : layerState.network;
}

/** Pares acessorio de energia -> equipamento mais proximo, desenhados como ligacao. */
export function getPowerLinks(objects) {
  return objects
    .filter(isPowerAccessoryObject)
    .map((accessory) => {
      const target = findNearestDesktop(accessory, objects);
      return target ? { accessory, target } : null;
    })
    .filter(Boolean);
}

/**
 * Entidades do pavimento ativo que o canvas 2D desenha, ja filtradas pelas
 * camadas visiveis, mais as dimensoes do pavimento.
 */
export function getCanvasScene({ editor, activeFloorId, visibleLayers }) {
  const floor = getActiveFloor(editor, activeFloorId);
  const layerState = resolveLayerState(visibleLayers);
  const zones = (editor?.zones || []).filter((zone) => zone.floorId === floor?.id);
  const objects = layerState.objects ? syncAnchoredOpenings(editor?.objects || []).filter((object) => object.floorId === floor?.id) : [];
  const { width, height } = getFloorSize(floor, editor?.plan);
  return {
    floor,
    layerState,
    zones,
    roomZones: layerState.rooms ? zones.filter(isRoomZone) : [],
    areaZones: layerState.areas ? zones.filter((zone) => !isRoomZone(zone)) : [],
    objects,
    points: (editor?.connectionPoints || [])
      .filter((point) => point.floorId === floor?.id)
      .filter((point) => isPointVisible(point, layerState)),
    routes: (editor?.cableRoutes || []).filter((route) => route.floorId === floor?.id).filter((route) => isRouteVisible(route, layerState)),
    powerLinks: getPowerLinks(objects),
    width,
    height
  };
}
