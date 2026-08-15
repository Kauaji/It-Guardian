import assert from "node:assert/strict";
import test from "node:test";
import { AppError, badRequest, conflict, forbidden, notFoundError, serviceUnavailable } from "./errors.js";

test("AppError e uma instancia real de Error, com statusCode/expose/code opcionais", () => {
  const error = new AppError("mensagem", { statusCode: 418, code: "TEAPOT" });
  assert.ok(error instanceof Error);
  assert.equal(error.message, "mensagem");
  assert.equal(error.statusCode, 418);
  assert.equal(error.code, "TEAPOT");
  assert.equal(error.expose, true);
});

test("AppError usa statusCode 500 e expose true por padrao, sem code quando omitido", () => {
  const error = new AppError("falha interna");
  assert.equal(error.statusCode, 500);
  assert.equal(error.expose, true);
  assert.equal("code" in error, false);
});

test("factories atalho aplicam o statusCode correto e aceitam code/expose opcionais", () => {
  assert.equal(badRequest("x").statusCode, 400);
  assert.equal(forbidden("x").statusCode, 403);
  assert.equal(notFoundError("x").statusCode, 404);
  assert.equal(conflict("x").statusCode, 409);
  assert.equal(serviceUnavailable("x").statusCode, 503);

  const withCode = forbidden("bloqueado", { code: "SECOND_REVIEWER_REQUIRED" });
  assert.equal(withCode.code, "SECOND_REVIEWER_REQUIRED");

  const notExposed = serviceUnavailable("indisponivel", { expose: false });
  assert.equal(notExposed.expose, false);
});
