import { vi } from "vitest";

// Doubles de api.js compartilhados pelos testes do inventario de pecas (usados via vi.mock em cada arquivo).
export const fetchPartsInventory = vi.fn();
export const fetchPartInventoryItem = vi.fn();
export const createPartInventoryItem = vi.fn();
export const updatePartInventoryItem = vi.fn();
export const createPartInventoryMovement = vi.fn();
export const fetchPartCategories = vi.fn();
export const createPartCategory = vi.fn();
export const deletePartCategory = vi.fn();
export const syncPartsFromAssets = vi.fn();
export const importPartsInvoice = vi.fn();
export const reviewPartInventoryDiscrepancy = vi.fn();
