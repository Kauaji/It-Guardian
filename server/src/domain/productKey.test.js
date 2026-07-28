import assert from "node:assert/strict";
import test from "node:test";
import {
  generateProductKey,
  hashMachineFingerprint,
  hashProductKey,
  normalizeProductKey,
  productKeyHint
} from "./productKey.js";

test("chaves de produto sao normalizadas, mascaradas e armazenadas por hash", () => {
  const productKey = generateProductKey();

  assert.match(productKey, /^ITG(?:-[A-Z2-9]{4}){5}$/);
  assert.equal(normalizeProductKey(productKey.toLowerCase()), productKey);
  assert.equal(normalizeProductKey("chave-invalida"), "");
  assert.match(productKeyHint(productKey), /^ITG-[A-Z2-9]{4}-\*{4}-\*{4}-[A-Z2-9]{4}$/);
  assert.match(hashProductKey(productKey), /^[a-f0-9]{64}$/);
  assert.notEqual(hashProductKey(productKey), productKey);
});

test("fingerprint e normalizado antes do hash para reinstalacao idempotente", () => {
  assert.equal(
    hashMachineFingerprint("  MACHINE-FINGERPRINT  "),
    hashMachineFingerprint("machine-fingerprint")
  );
  assert.match(hashMachineFingerprint("machine-fingerprint"), /^[a-f0-9]{64}$/);
});
