import * as THREE from "three";
import { getConnectionLabel, normalizeNumber, normalizePoint } from "./sceneHelpers.js";
import { createTextSprite } from "./textSprite.js";

function buildLine(connection, points, color, selected) {
  const materialOptions = {
    color,
    linewidth: Math.max(1, normalizeNumber(connection.thickness, 2) + (selected ? 2 : 0)),
    transparent: true,
    opacity: selected ? 0.98 : 0.78
  };
  const material = connection.dashed
    ? new THREE.LineDashedMaterial({ ...materialOptions, dashSize: 0.42, gapSize: 0.22 })
    : new THREE.LineBasicMaterial(materialOptions);

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, material);
  line.userData.connectionId = connection.id;
  if (connection.dashed) line.computeLineDistances();
  return line;
}

function addEndpoints(group, connection, points, color, selected) {
  const endpointMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.04,
    transparent: true,
    opacity: selected ? 1 : 0.86
  });
  const endpointGeometry = new THREE.SphereGeometry(selected ? 0.13 : 0.09, 16, 16);
  points.forEach((point) => {
    const endpoint = new THREE.Mesh(endpointGeometry, endpointMaterial);
    endpoint.position.copy(point);
    endpoint.userData.connectionId = connection.id;
    group.add(endpoint);
  });
}

function addMidpointLabel(group, connection, points) {
  const midpoint = points[Math.floor((points.length - 1) / 2)].clone().lerp(points[Math.ceil((points.length - 1) / 2)], 0.5);
  const label = createTextSprite(getConnectionLabel(connection));
  label.position.set(midpoint.x, midpoint.y + 0.35, midpoint.z);
  group.add(label);
}

export function buildConnectionLine(connection, selectedConnectionId) {
  const points = (connection.points || []).map(normalizePoint).filter(Boolean);
  if (points.length < 2) return null;

  const selected = selectedConnectionId === connection.id;
  const color = connection.color || (connection.layer === "electrical" ? "#f97316" : "#0ea5e9");
  const line = buildLine(connection, points, color, selected);

  const group = new THREE.Group();
  group.add(line);
  addEndpoints(group, connection, points, color, selected);
  addMidpointLabel(group, connection, points);

  return {
    group,
    selectable: [line, ...group.children.filter((child) => child.userData.connectionId === connection.id && child !== line)]
  };
}
