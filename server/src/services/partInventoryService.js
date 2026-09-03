import { validatePart, validatePartCategory, validatePartMovement } from "../domain/partInventory.js";
import { parseNfePurchaseXml } from "../domain/partInventoryImport.js";
import { createPart, createPartCategory, deletePartCategory, getPart, importPartInvoice, listPartCategories, listParts, movePart, syncAgentHardwareParts, updatePart } from "../repositories/partInventoryRepository.js";
export function listPartInventory(query) { return listParts(query); }
export function getPartInventoryItem(id) { return getPart(id); }
export function createPartInventoryItem(payload, user) { return createPart(validatePart(payload), user); }
export function updatePartInventoryItem(id, payload) { return updatePart(id, validatePart(payload, { partial: true })); }
export function createPartMovement(id, payload, user) { return movePart(id, validatePartMovement(payload), user); }
export function getPartCategories() { return listPartCategories(); }
export function addPartCategory(payload, user) { return createPartCategory(validatePartCategory(payload), user); }
export function removePartCategory(id) { return deletePartCategory(id); }
export function reconcileAgentHardware(user) { return syncAgentHardwareParts(user); }
export function importPurchaseInvoice(xml, user) { return importPartInvoice(parseNfePurchaseXml(xml), user); }
