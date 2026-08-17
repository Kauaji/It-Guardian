import assert from "node:assert/strict";
import test from "node:test";
import { ensureRole } from "./userService.js";

const expectedMessage = "Role must be admin, operator or viewer";

test("aceita a role admin sem lancar erro", () => {
  assert.doesNotThrow(() => ensureRole("admin"));
});

test("aceita a role operator sem lancar erro", () => {
  assert.doesNotThrow(() => ensureRole("operator"));
});

test("aceita a role viewer sem lancar erro", () => {
  assert.doesNotThrow(() => ensureRole("viewer"));
});

test("rejeita uma role desconhecida com AppError 400 e mensagem exata", () => {
  assert.throws(
    () => ensureRole("superadmin"),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, expectedMessage);
      return true;
    }
  );
});

test("rejeita string vazia como role com AppError 400 e mensagem exata", () => {
  assert.throws(
    () => ensureRole(""),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, expectedMessage);
      return true;
    }
  );
});

test("rejeita role undefined com AppError 400 e mensagem exata", () => {
  assert.throws(
    () => ensureRole(undefined),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, expectedMessage);
      return true;
    }
  );
});
