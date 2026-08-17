import {
  createNewSector,
  deactivateExistingSector,
  listAllSectors,
  updateExistingSector,
  updatePermissionsForSector
} from "../services/sectorService.js";

export async function list(req, res, next) {
  try {
    res.json({ sectors: await listAllSectors() });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const sector = await createNewSector(req.body, req.user);
    res.status(201).json({ sector });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const sector = await updateExistingSector(req.params.id, req.body, req.user);
    res.json({ sector });
  } catch (error) {
    next(error);
  }
}

export async function updatePermissions(req, res, next) {
  try {
    const sector = await updatePermissionsForSector(req.params.id, req.body.permissions, req.user);
    res.json({ sector });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const sector = await deactivateExistingSector(req.params.id, req.user);
    res.json({ sector });
  } catch (error) {
    next(error);
  }
}
