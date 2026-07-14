function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function addUniqueId(errors, ids, entityName, item) {
  if (!item?.id) {
    errors.push(`${entityName} sem identificador.`);
    return;
  }
  if (ids.has(item.id)) {
    errors.push(`${entityName} duplicado: ${item.id}.`);
    return;
  }
  ids.add(item.id);
}

function assertFloorReference(errors, floorIds, entityName, item) {
  if (!floorIds.has(item?.floorId)) {
    errors.push(`${entityName} ${item?.id || "sem id"} referencia uma planta inexistente.`);
  }
}

function assertPositiveSize(errors, entityName, item) {
  if (!isFiniteNumber(item?.width) || Number(item.width) <= 0) {
    errors.push(`${entityName} ${item?.id || "sem id"} tem largura invalida.`);
  }
  if (!isFiniteNumber(item?.height) || Number(item.height) <= 0) {
    errors.push(`${entityName} ${item?.id || "sem id"} tem altura invalida.`);
  }
}

function assertPoint(errors, entityName, item) {
  if (!isFiniteNumber(item?.x) || !isFiniteNumber(item?.y)) {
    errors.push(`${entityName} ${item?.id || "sem id"} tem coordenadas invalidas.`);
  }
}

function assertGeometry(errors, entityName, item) {
  const geometry = item?.geometry || {};
  if (!isFiniteNumber(geometry.x) || !isFiniteNumber(geometry.y)) {
    errors.push(`${entityName} ${item?.id || "sem id"} tem origem invalida.`);
  }
  if (!isFiniteNumber(geometry.width) || Number(geometry.width) <= 0) {
    errors.push(`${entityName} ${item?.id || "sem id"} tem largura invalida.`);
  }
  if (!isFiniteNumber(geometry.height) || Number(geometry.height) <= 0) {
    errors.push(`${entityName} ${item?.id || "sem id"} tem altura invalida.`);
  }
}

export function validateFloorPlanEditorData(data = {}) {
  const errors = [];
  const floors = Array.isArray(data.floors) ? data.floors : [];
  const zones = Array.isArray(data.zones) ? data.zones : [];
  const objects = Array.isArray(data.objects) ? data.objects : [];
  const points = Array.isArray(data.connectionPoints) ? data.connectionPoints : [];
  const routes = Array.isArray(data.cableRoutes) ? data.cableRoutes : [];

  if (!floors.length) errors.push("A planta precisa ter pelo menos um andar.");

  const floorIds = new Set();
  for (const floor of floors) {
    addUniqueId(errors, floorIds, "Andar", floor);
    assertPositiveSize(errors, "Andar", floor);
  }

  const zoneIds = new Set();
  for (const zone of zones) {
    addUniqueId(errors, zoneIds, "Zona", zone);
    assertFloorReference(errors, floorIds, "Zona", zone);
    assertGeometry(errors, "Zona", zone);
  }

  const objectIds = new Set();
  const objectsById = new Map();
  for (const object of objects) {
    addUniqueId(errors, objectIds, "Objeto", object);
    if (object?.id) objectsById.set(object.id, object);
    assertFloorReference(errors, floorIds, "Objeto", object);
    assertPositiveSize(errors, "Objeto", object);
    assertPoint(errors, "Objeto", object);
  }

  for (const object of objects) {
    if (object?.metadata?.anchorType !== "wall") continue;
    const parent = objectsById.get(object.metadata.parentObjectId);
    if (!parent) {
      errors.push(`Objeto ${object.id} referencia uma parede inexistente.`);
      continue;
    }
    if (!["wall", "divider"].includes(parent.objectType)) {
      errors.push(`Objeto ${object.id} possui ancora em objeto que nao e parede.`);
    }
    const anchorOffset = Number(object.metadata.anchorOffset);
    if (!Number.isFinite(anchorOffset) || anchorOffset < 0 || anchorOffset > 1) {
      errors.push(`Objeto ${object.id} possui posicao de ancora invalida.`);
    }
    if (parent.floorId !== object.floorId) {
      errors.push(`Objeto ${object.id} e sua parede pertencem a andares diferentes.`);
    }
  }

  const pointIds = new Set();
  for (const point of points) {
    addUniqueId(errors, pointIds, "Ponto", point);
    assertFloorReference(errors, floorIds, "Ponto", point);
    assertPoint(errors, "Ponto", point);
    if (point.linkedObjectId && !objectIds.has(point.linkedObjectId)) {
      errors.push(`Ponto ${point.id} referencia um objeto inexistente.`);
    }
  }

  const routeIds = new Set();
  for (const route of routes) {
    addUniqueId(errors, routeIds, "Rota", route);
    assertFloorReference(errors, floorIds, "Rota", route);
    if (route.sourcePointId && !pointIds.has(route.sourcePointId)) {
      errors.push(`Rota ${route.id} referencia ponto de origem inexistente.`);
    }
    if (route.targetPointId && !pointIds.has(route.targetPointId)) {
      errors.push(`Rota ${route.id} referencia ponto de destino inexistente.`);
    }
    for (const [index, pathPoint] of (route.path || []).entries()) {
      if (!isFiniteNumber(pathPoint?.x) || !isFiniteNumber(pathPoint?.y)) {
        errors.push(`Rota ${route.id} possui ponto de caminho invalido na posicao ${index + 1}.`);
      }
    }
  }

  if (errors.length) {
    const error = new Error(`Dados da planta invalidos: ${errors.join(" ")}`);
    error.statusCode = 400;
    throw error;
  }

  return true;
}
