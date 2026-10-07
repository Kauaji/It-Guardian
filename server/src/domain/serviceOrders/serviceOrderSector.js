import { normalizeText } from "./serviceOrderText.js";

export const generalSector = { id: "sector-geral", name: "Geral" };

export const defaultServiceOrderSector = {
  sectorId: generalSector.id,
  sectorName: generalSector.name
};

/**
 * @param {{ sectorId?: string | null, sectorName?: string | null }} [sector]
 * @returns {boolean}
 */
export function isGeneralSector({ sectorId, sectorName } = {}) {
  return !sectorId || sectorId === generalSector.id || normalizeText(sectorName) === normalizeText(generalSector.name);
}
