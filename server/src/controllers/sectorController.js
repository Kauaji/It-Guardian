import { addLog } from "../repositories/logRepository.js";
import {
  createSector,
  deactivateSector,
  listSectors,
  updateSector,
  updateSectorPermissions
} from "../repositories/sectorRepository.js";

export async function list(req, res, next) {
  try {
    res.json({ sectors: await listSectors() });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    if (!req.body.name?.trim()) {
      return res.status(400).json({ message: "Informe o nome do setor." });
    }

    const sector = await createSector(req.body);
    await addLog({
      type: "sector_create",
      message: `Sector created: ${sector.name}`,
      userId: req.user.id,
      meta: { sectorId: sector.id }
    });

    res.status(201).json({ sector });
  } catch (error) {
    if (error.code === "23505") {
      error.statusCode = 409;
      error.message = "Ja existe um setor com esse nome.";
    }
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    if (!req.body.name?.trim()) {
      return res.status(400).json({ message: "Informe o nome do setor." });
    }

    const sector = await updateSector(req.params.id, req.body);
    if (!sector) return res.status(404).json({ message: "Setor nao encontrado." });

    await addLog({
      type: "sector_update",
      message: `Sector updated: ${sector.name}`,
      userId: req.user.id,
      meta: { sectorId: sector.id }
    });

    res.json({ sector });
  } catch (error) {
    if (error.code === "23505") {
      error.statusCode = 409;
      error.message = "Ja existe um setor com esse nome.";
    }
    next(error);
  }
}

export async function updatePermissions(req, res, next) {
  try {
    const sector = await updateSectorPermissions(req.params.id, req.body.permissions || []);
    if (!sector) return res.status(404).json({ message: "Setor nao encontrado." });

    await addLog({
      type: "sector_permissions",
      message: `Sector permissions updated: ${sector.name}`,
      userId: req.user.id,
      meta: { sectorId: sector.id }
    });

    res.json({ sector });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const sector = await deactivateSector(req.params.id);
    if (!sector) return res.status(404).json({ message: "Setor nao encontrado." });

    await addLog({
      type: "sector_deactivate",
      message: `Sector deactivated: ${sector.name}`,
      userId: req.user.id,
      meta: { sectorId: sector.id }
    });

    res.json({ sector });
  } catch (error) {
    next(error);
  }
}
