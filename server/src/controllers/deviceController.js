import {
  changeAlias,
  changeBackupStatus,
  changeType,
  createManualDevice,
  getDeviceDetailsAndLog,
  getPublicDeviceDetails,
  listAllDevices,
  moveDeviceToSegment,
  refreshDevicePing,
  removeDeviceById,
  updateManualDevice
} from "../services/deviceService.js";

export async function list(req, res, next) {
  try {
    const result = await listAllDevices(req.query.search, req.query.status);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function details(req, res, next) {
  try {
    const device = await getDeviceDetailsAndLog(req.params.id, req.user);
    res.json({ device });
  } catch (error) {
    next(error);
  }
}

export async function publicDetails(req, res, next) {
  try {
    const device = await getPublicDeviceDetails(req.params.id);
    res.json({ device });
  } catch (error) {
    next(error);
  }
}

export async function createManual(req, res, next) {
  try {
    const device = await createManualDevice(req.body, req.user);
    res.status(201).json({ device });
  } catch (error) {
    next(error);
  }
}

export async function updateManual(req, res, next) {
  try {
    const device = await updateManualDevice(req.params.id, req.body, req.user);
    res.json({ device });
  } catch (error) {
    next(error);
  }
}

export async function refreshPing(req, res, next) {
  try {
    const result = await refreshDevicePing(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function changeDeviceType(req, res, next) {
  try {
    const device = await changeType(req.params.id, req.body.assetType, req.user);
    res.json({ device });
  } catch (error) {
    next(error);
  }
}

export async function changeDeviceAlias(req, res, next) {
  try {
    const device = await changeAlias(req.params.id, req.body.alias, req.user);
    res.json({ device });
  } catch (error) {
    next(error);
  }
}

export async function moveToSegment(req, res, next) {
  try {
    const result = await moveDeviceToSegment(req.params.id, req.body, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function changeDeviceBackup(req, res, next) {
  try {
    const device = await changeBackupStatus(req.params.id, req.body, req.user);
    res.json({ device });
  } catch (error) {
    next(error);
  }
}

export async function removeDevice(req, res, next) {
  try {
    const result = await removeDeviceById(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
