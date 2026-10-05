import {
  getInventoryVisualMap,
  listInventoryVisualMaps
} from "../repositories/inventoryVisualMap/visualMapRepository.js";
import { listInventoryVisualMapConnections } from "../repositories/inventoryVisualMap/visualMapConnectionRepository.js";
import { listInventoryVisualMapObjects } from "../repositories/inventoryVisualMap/visualMapObjectRepository.js";
import {
  createInventoryVisualMapConnection,
  deleteInventoryVisualMapConnection,
  updateInventoryVisualMapConnection
} from "./inventoryVisualMap/visualMapConnectionService.js";
import {
  createInventoryVisualMap,
  deleteInventoryVisualMap,
  updateInventoryVisualMap
} from "./inventoryVisualMap/visualMapCommandService.js";
import {
  createInventoryVisualMapObject,
  deleteInventoryVisualMapObject,
  updateInventoryVisualMapObject
} from "./inventoryVisualMap/visualMapObjectService.js";
import { broadcastSnapshot } from "./realtimeService.js";
import { logger } from "../lib/logger.js";

function notifyInventoryChanged() {
  broadcastSnapshot().catch((error) => {
    logger.error("realtime_broadcast_failed", { context: "inventory_visual_map", error });
  });
}

export async function listAllMaps() {
  return listInventoryVisualMaps();
}

export async function getMapWithContents(id) {
  const map = await getInventoryVisualMap(id);
  const objects = await listInventoryVisualMapObjects(id);
  const connections = await listInventoryVisualMapConnections(id);
  return { map, objects, connections };
}

export async function createMap(payload, user) {
  const map = await createInventoryVisualMap(payload, user);
  notifyInventoryChanged();
  return map;
}

export async function updateMap(id, payload, user) {
  const map = await updateInventoryVisualMap(id, payload, user);
  notifyInventoryChanged();
  return map;
}

export async function removeMap(id, user) {
  const map = await deleteInventoryVisualMap(id, user);
  notifyInventoryChanged();
  return map;
}

export async function listObjectsForMap(id) {
  return listInventoryVisualMapObjects(id);
}

export async function listConnectionsForMap(id) {
  return listInventoryVisualMapConnections(id);
}

export async function createObject(mapId, payload, user) {
  const object = await createInventoryVisualMapObject(mapId, payload, user);
  notifyInventoryChanged();
  return object;
}

export async function createConnection(mapId, payload, user) {
  const connection = await createInventoryVisualMapConnection(mapId, payload, user);
  notifyInventoryChanged();
  return connection;
}

export async function updateObject(objectId, payload, user) {
  const object = await updateInventoryVisualMapObject(objectId, payload, user);
  notifyInventoryChanged();
  return object;
}

export async function updateConnection(connectionId, payload, user) {
  const connection = await updateInventoryVisualMapConnection(connectionId, payload, user);
  notifyInventoryChanged();
  return connection;
}

export async function removeObject(objectId, user) {
  const object = await deleteInventoryVisualMapObject(objectId, user);
  notifyInventoryChanged();
  return object;
}

export async function removeConnection(connectionId, user) {
  const connection = await deleteInventoryVisualMapConnection(connectionId, user);
  notifyInventoryChanged();
  return connection;
}
