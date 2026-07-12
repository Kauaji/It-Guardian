import {
  createInventoryVisualMap,
  createInventoryVisualMapConnection,
  createInventoryVisualMapObject,
  deleteInventoryVisualMap,
  deleteInventoryVisualMapConnection,
  deleteInventoryVisualMapObject,
  getInventoryVisualMap,
  listInventoryVisualMapConnections,
  listInventoryVisualMapObjects,
  listInventoryVisualMaps,
  updateInventoryVisualMap,
  updateInventoryVisualMapConnection,
  updateInventoryVisualMapObject
} from "../repositories/inventoryVisualMapRepository.js";
import { broadcastSnapshot } from "../services/realtimeService.js";

function notifyInventoryChanged() {
  broadcastSnapshot().catch((error) => {
    console.error("Failed to broadcast inventory visual map snapshot", error);
  });
}

export async function listMaps(_req, res, next) {
  try {
    const maps = await listInventoryVisualMaps();
    res.json({ maps });
  } catch (error) {
    next(error);
  }
}

export async function getMap(req, res, next) {
  try {
    const map = await getInventoryVisualMap(req.params.id);
    const objects = await listInventoryVisualMapObjects(req.params.id);
    const connections = await listInventoryVisualMapConnections(req.params.id);
    res.json({ map, objects, connections });
  } catch (error) {
    next(error);
  }
}

export async function createMap(req, res, next) {
  try {
    const map = await createInventoryVisualMap(req.body, req.user);
    notifyInventoryChanged();
    res.status(201).json({ map });
  } catch (error) {
    next(error);
  }
}

export async function updateMap(req, res, next) {
  try {
    const map = await updateInventoryVisualMap(req.params.id, req.body, req.user);
    notifyInventoryChanged();
    res.json({ map });
  } catch (error) {
    next(error);
  }
}

export async function removeMap(req, res, next) {
  try {
    const map = await deleteInventoryVisualMap(req.params.id, req.user);
    notifyInventoryChanged();
    res.json({ map });
  } catch (error) {
    next(error);
  }
}

export async function listObjects(req, res, next) {
  try {
    const objects = await listInventoryVisualMapObjects(req.params.id);
    res.json({ objects });
  } catch (error) {
    next(error);
  }
}

export async function listConnections(req, res, next) {
  try {
    const connections = await listInventoryVisualMapConnections(req.params.id);
    res.json({ connections });
  } catch (error) {
    next(error);
  }
}

export async function createObject(req, res, next) {
  try {
    const object = await createInventoryVisualMapObject(req.params.id, req.body, req.user);
    notifyInventoryChanged();
    res.status(201).json({ object });
  } catch (error) {
    next(error);
  }
}

export async function createConnection(req, res, next) {
  try {
    const connection = await createInventoryVisualMapConnection(req.params.id, req.body, req.user);
    notifyInventoryChanged();
    res.status(201).json({ connection });
  } catch (error) {
    next(error);
  }
}

export async function updateObject(req, res, next) {
  try {
    const object = await updateInventoryVisualMapObject(req.params.objectId, req.body, req.user);
    notifyInventoryChanged();
    res.json({ object });
  } catch (error) {
    next(error);
  }
}

export async function updateConnection(req, res, next) {
  try {
    const connection = await updateInventoryVisualMapConnection(req.params.connectionId, req.body, req.user);
    notifyInventoryChanged();
    res.json({ connection });
  } catch (error) {
    next(error);
  }
}

export async function removeObject(req, res, next) {
  try {
    const object = await deleteInventoryVisualMapObject(req.params.objectId, req.user);
    notifyInventoryChanged();
    res.json({ object });
  } catch (error) {
    next(error);
  }
}

export async function removeConnection(req, res, next) {
  try {
    const connection = await deleteInventoryVisualMapConnection(req.params.connectionId, req.user);
    notifyInventoryChanged();
    res.json({ connection });
  } catch (error) {
    next(error);
  }
}
