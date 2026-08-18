import {
  addLink,
  addNode,
  createMap,
  editLink,
  editNode,
  generateAutoLayout,
  getMapWithNodesAndLinks,
  listMaps,
  removeLink,
  removeMap,
  removeNode,
  saveNodePositions,
  updateMap
} from "../services/networkTopologyService.js";

export async function listNetworkTopologyMapsController(req, res, next) {
  try {
    const maps = await listMaps();
    res.json({ maps });
  } catch (error) {
    next(error);
  }
}

export async function getNetworkTopologyMapController(req, res, next) {
  try {
    const bundle = await getMapWithNodesAndLinks(req.params.id);
    res.json(bundle);
  } catch (error) {
    next(error);
  }
}

export async function createNetworkTopologyMapController(req, res, next) {
  try {
    const map = await createMap(req.body, req.user);
    res.status(201).json({ map });
  } catch (error) {
    next(error);
  }
}

export async function updateNetworkTopologyMapController(req, res, next) {
  try {
    const map = await updateMap(req.params.id, req.body, req.user);
    res.json({ map });
  } catch (error) {
    next(error);
  }
}

export async function deleteNetworkTopologyMapController(req, res, next) {
  try {
    const map = await removeMap(req.params.id, req.user);
    res.json({ map });
  } catch (error) {
    next(error);
  }
}

export async function createNetworkTopologyNodeController(req, res, next) {
  try {
    const node = await addNode(req.params.id, req.body, req.user);
    res.status(201).json({ node });
  } catch (error) {
    next(error);
  }
}

export async function updateNetworkTopologyNodeController(req, res, next) {
  try {
    const node = await editNode(req.params.nodeId, req.body, req.user);
    res.json({ node });
  } catch (error) {
    next(error);
  }
}

export async function saveNetworkTopologyNodePositionsController(req, res, next) {
  try {
    const nodes = await saveNodePositions(req.params.id, req.body?.positions, req.user);
    res.json({ nodes });
  } catch (error) {
    next(error);
  }
}

export async function deleteNetworkTopologyNodeController(req, res, next) {
  try {
    const node = await removeNode(req.params.nodeId, req.user);
    res.json({ node });
  } catch (error) {
    next(error);
  }
}

export async function createNetworkTopologyLinkController(req, res, next) {
  try {
    const link = await addLink(req.params.id, req.body, req.user);
    res.status(201).json({ link });
  } catch (error) {
    next(error);
  }
}

export async function updateNetworkTopologyLinkController(req, res, next) {
  try {
    const link = await editLink(req.params.linkId, req.body, req.user);
    res.json({ link });
  } catch (error) {
    next(error);
  }
}

export async function deleteNetworkTopologyLinkController(req, res, next) {
  try {
    const link = await removeLink(req.params.linkId, req.user);
    res.json({ link });
  } catch (error) {
    next(error);
  }
}

export async function generateNetworkTopologyAutoLayoutController(req, res, next) {
  try {
    const nodes = await generateAutoLayout(req.params.id, req.body?.hints, req.user);
    res.json({ nodes });
  } catch (error) {
    next(error);
  }
}
