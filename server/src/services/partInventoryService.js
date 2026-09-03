import { validatePart, validatePartMovement } from "../domain/partInventory.js";
import { createPart, getPart, listParts, movePart, updatePart } from "../repositories/partInventoryRepository.js";
export function listPartInventory(query) { return listParts(query); }
export function getPartInventoryItem(id) { return getPart(id); }
export function createPartInventoryItem(payload, user) { return createPart(validatePart(payload), user); }
export function updatePartInventoryItem(id, payload) { return updatePart(id, validatePart(payload, { partial: true })); }
export function createPartMovement(id, payload, user) { return movePart(id, validatePartMovement(payload), user); }
