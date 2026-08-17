import { badRequest, conflict, notFoundError } from "../lib/errors.js";
import { addLog } from "../repositories/logRepository.js";
import {
  createSector,
  deactivateSector,
  listSectors,
  updateSector,
  updateSectorPermissions
} from "../repositories/sectorRepository.js";

function remapUniqueViolation(error) {
  if (error.code === "23505") {
    throw conflict("Ja existe um setor com esse nome.");
  }
  throw error;
}

export async function listAllSectors() {
  return listSectors();
}

export async function createNewSector(payload, user) {
  if (!payload.name?.trim()) {
    throw badRequest("Informe o nome do setor.");
  }

  let sector;
  try {
    sector = await createSector(payload);
  } catch (error) {
    remapUniqueViolation(error);
  }

  await addLog({
    type: "sector_create",
    message: `Sector created: ${sector.name}`,
    userId: user.id,
    meta: { sectorId: sector.id }
  });

  return sector;
}

export async function updateExistingSector(id, payload, user) {
  if (!payload.name?.trim()) {
    throw badRequest("Informe o nome do setor.");
  }

  let sector;
  try {
    sector = await updateSector(id, payload);
  } catch (error) {
    remapUniqueViolation(error);
  }
  if (!sector) throw notFoundError("Setor nao encontrado.");

  await addLog({
    type: "sector_update",
    message: `Sector updated: ${sector.name}`,
    userId: user.id,
    meta: { sectorId: sector.id }
  });

  return sector;
}

export async function updatePermissionsForSector(id, permissions, user) {
  const sector = await updateSectorPermissions(id, permissions || []);
  if (!sector) throw notFoundError("Setor nao encontrado.");

  await addLog({
    type: "sector_permissions",
    message: `Sector permissions updated: ${sector.name}`,
    userId: user.id,
    meta: { sectorId: sector.id }
  });

  return sector;
}

export async function deactivateExistingSector(id, user) {
  const sector = await deactivateSector(id);
  if (!sector) throw notFoundError("Setor nao encontrado.");

  await addLog({
    type: "sector_deactivate",
    message: `Sector deactivated: ${sector.name}`,
    userId: user.id,
    meta: { sectorId: sector.id }
  });

  return sector;
}
