import test from "node:test";
import assert from "node:assert/strict";
import { validatePart, validatePartMovement } from "../src/domain/partInventory.js";

test("valida cadastro rastreavel de peca", () => {
  const part = validatePart({ name: "Memoria DDR5", quantity: 4, minimumStock: 2, serialNumber: "SN-1" });
  assert.equal(part.quantity, 4);
  assert.equal(part.conditionStatus, "new");
});

test("rejeita estoque negativo", () => {
  assert.throws(() => validatePart({ name: "SSD", quantity: -1 }), /não pode ser negativa/);
});

test("consumo exige vinculo operacional", () => {
  assert.throws(() => validatePartMovement({ movementType: "consumption", quantity: 1 }), /Vincule o consumo/);
});
