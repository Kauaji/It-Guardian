import {
  createConnection as createConnectionService,
  createMap as createMapService,
  createObject as createObjectService,
  getMapWithContents,
  listAllMaps,
  listConnectionsForMap,
  listObjectsForMap,
  removeConnection as removeConnectionService,
  removeMap as removeMapService,
  removeObject as removeObjectService,
  updateConnection as updateConnectionService,
  updateMap as updateMapService,
  updateObject as updateObjectService
} from "../services/inventoryVisualMapService.js";

export async function listMaps(_req, res, next) {
  try {
    const maps = await listAllMaps();
    res.json({ maps });
  } catch (error) {
    next(error);
  }
}

export async function getMap(req, res, next) {
  try {
    const { map, objects, connections } = await getMapWithContents(req.params.id);
    res.json({ map, objects, connections });
  } catch (error) {
    next(error);
  }
}

export async function createMap(req, res, next) {
  try {
    const map = await createMapService(req.body, req.user);
    res.status(201).json({ map });
  } catch (error) {
    next(error);
  }
}

export async function updateMap(req, res, next) {
  try {
    const map = await updateMapService(req.params.id, req.body, req.user);
    res.json({ map });
  } catch (error) {
    next(error);
  }
}

export async function removeMap(req, res, next) {
  try {
    const map = await removeMapService(req.params.id, req.user);
    res.json({ map });
  } catch (error) {
    next(error);
  }
}

export async function listObjects(req, res, next) {
  try {
    const objects = await listObjectsForMap(req.params.id);
    res.json({ objects });
  } catch (error) {
    next(error);
  }
}

export async function listConnections(req, res, next) {
  try {
    const connections = await listConnectionsForMap(req.params.id);
    res.json({ connections });
  } catch (error) {
    next(error);
  }
}

export async function createObject(req, res, next) {
  try {
    const object = await createObjectService(req.params.id, req.body, req.user);
    res.status(201).json({ object });
  } catch (error) {
    next(error);
  }
}

export async function createConnection(req, res, next) {
  try {
    const connection = await createConnectionService(req.params.id, req.body, req.user);
    res.status(201).json({ connection });
  } catch (error) {
    next(error);
  }
}

export async function updateObject(req, res, next) {
  try {
    const object = await updateObjectService(req.params.objectId, req.body, req.user);
    res.json({ object });
  } catch (error) {
    next(error);
  }
}

export async function updateConnection(req, res, next) {
  try {
    const connection = await updateConnectionService(req.params.connectionId, req.body, req.user);
    res.json({ connection });
  } catch (error) {
    next(error);
  }
}

export async function removeObject(req, res, next) {
  try {
    const object = await removeObjectService(req.params.objectId, req.user);
    res.json({ object });
  } catch (error) {
    next(error);
  }
}

export async function removeConnection(req, res, next) {
  try {
    const connection = await removeConnectionService(req.params.connectionId, req.user);
    res.json({ connection });
  } catch (error) {
    next(error);
  }
}
