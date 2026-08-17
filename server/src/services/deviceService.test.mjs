import assert from "node:assert/strict";
import test from "node:test";
import { validateManualAsset } from "./deviceService.js";

function manualAssetPayload(overrides = {}) {
  return {
    name: "Notebook Dell",
    type: "notebook",
    brand: "Dell",
    model: "Latitude 5420",
    assetTag: "AST-001",
    ip: "192.168.1.10",
    ...overrides
  };
}

test("payload valido completo nao lanca erro", () => {
  assert.doesNotThrow(() => validateManualAsset(manualAssetPayload()));
});

test("payload faltando apenas o campo name lanca erro citando o campo ausente", () => {
  const payload = manualAssetPayload({ name: "" });

  assert.throws(
    () => validateManualAsset(payload),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, "Campos obrigatorios ausentes: name");
      return true;
    }
  );
});

test("payload faltando varios campos lanca erro listando todos, na ordem definida", () => {
  const payload = manualAssetPayload({ brand: "   ", assetTag: undefined, ip: "" });

  assert.throws(
    () => validateManualAsset(payload),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, "Campos obrigatorios ausentes: brand, assetTag, ip");
      return true;
    }
  );
});

test("payload completo com type invalido lanca erro de tipo de ativo invalido", () => {
  const payload = manualAssetPayload({ type: "smartphone" });

  assert.throws(
    () => validateManualAsset(payload),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, "Tipo de ativo invalido");
      return true;
    }
  );
});

test("quando falta campo obrigatorio E o type e invalido, a checagem de campos ausentes vence", () => {
  const payload = manualAssetPayload({ name: "", type: "smartphone" });

  assert.throws(
    () => validateManualAsset(payload),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, "Campos obrigatorios ausentes: name");
      return true;
    }
  );
});
