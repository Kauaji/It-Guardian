import { normalizeText } from "./serviceOrderText.js";

export const generalSector = { id: "sector-geral", name: "Geral" };

export const defaultServiceOrderSector = {
  sectorId: generalSector.id,
  sectorName: generalSector.name
};

export function isGeneralSector({ sectorId, sectorName } = {}) {
  return !sectorId || sectorId === generalSector.id || normalizeText(sectorName) === normalizeText(generalSector.name);
}
