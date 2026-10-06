import * as THREE from "three";
import { getPaintCellSize, getPaintCells, getPaintRuns, isPaintAreaZone } from "../utils/paintAreaGeometry.js";
import { getRoomGeometry, getRoomInterior, isRoomZone } from "../utils/roomGeometry.js";
import { FLOOR_TEXTURE_COLORS } from "./constants.js";
import { toColor } from "./resources.js";

function addPaintArea(zone, addBox) {
  const cellSize = getPaintCellSize(zone);
  getPaintRuns(getPaintCells(zone)).forEach((run) => {
    addBox({
      x: run.startColumn * cellSize,
      y: run.row * cellSize,
      width: (run.endColumn - run.startColumn + 1) * cellSize,
      depth: cellSize,
      height: 2,
      color: zone.color,
      opacity: zone.zoneType === "segment" ? 0.42 : 0.28,
      verticalOffset: 6
    });
  });
}

function addRoomFloor(zone, addBox) {
  const room = getRoomGeometry(zone);
  const interior = getRoomInterior(zone);
  const floorColor = FLOOR_TEXTURE_COLORS[zone.metadata?.floorTexture] || "#f8fafc";
  addBox({ x: room.x, y: room.y, width: room.width, depth: room.height, height: 4, color: zone.color, opacity: 0.2, verticalOffset: 5 });
  addBox({
    x: interior.x,
    y: interior.y,
    width: interior.width,
    depth: interior.height,
    height: 3,
    color: floorColor,
    opacity: 0.98,
    verticalOffset: 7,
    texturePreset: zone.metadata?.floorTexture || "ceramic",
    textureKind: "floor"
  });
}

/** Pisos dos comodos, areas demarcadas (pincel) e zonas genericas. */
export function addZones(zones, addBox) {
  zones.forEach((zone) => {
    if (isPaintAreaZone(zone)) {
      addPaintArea(zone, addBox);
    } else if (isRoomZone(zone)) {
      addRoomFloor(zone, addBox);
    } else {
      const geometry = zone.geometry || {};
      addBox({
        x: geometry.x || 0,
        y: geometry.y || 0,
        width: Number(geometry.width || 180),
        depth: Number(geometry.height || 120),
        height: 8,
        color: zone.color,
        opacity: 0.3,
        verticalOffset: 12
      });
    }
  });
}

/** Rotas de cabo: linha simples (cabo aparente) ou tubo (eletroduto/canaleta). */
export function addRoutes({ routes, scene, offsets, createMaterial }) {
  routes.forEach((route) => {
    const path = Array.isArray(route.path) ? route.path : [];
    if (path.length < 2) return;
    const routeStyle = route.metadata?.routeStyle || "free";
    const routeHeight = routeStyle === "conduit" ? 14 : routeStyle === "channel" ? 10 : 8;
    const points = path.map((point) => new THREE.Vector3(Number(point.x || 0) - offsets.x, routeHeight, Number(point.y || 0) - offsets.y));
    const routeColor = toColor(route.color, route.routeType === "power" ? "#f59e0b" : "#2563eb");
    if (routeStyle === "free") {
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: routeColor }));
      line.userData.routeId = route.id;
      scene.add(line);
    } else {
      const curve = new THREE.CatmullRomCurve3(points);
      const radius = routeStyle === "conduit" ? 4 : 3;
      const conduit = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(8, points.length * 8), radius, 8, false),
        createMaterial(routeColor, 1, routeStyle === "conduit" ? 0.28 : 0.08)
      );
      conduit.userData.routeId = route.id;
      scene.add(conduit);
    }
  });
}
