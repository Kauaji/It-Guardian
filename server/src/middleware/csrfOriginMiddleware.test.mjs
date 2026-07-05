import assert from "node:assert/strict";
import test from "node:test";
import { requireTrustedCookieOrigin } from "./csrfOriginMiddleware.js";
import { sessionCookieName } from "../security/sessionCookie.js";

function invoke({ method = "POST", origin = "", authorization = "", cookie = "" } = {}) {
  let nextCalled = false;
  let statusCode = 200;
  let payload;
  const req = { method, headers: { origin, authorization, cookie } };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    }
  };
  requireTrustedCookieOrigin(req, res, () => {
    nextCalled = true;
  });
  return { nextCalled, statusCode, payload };
}

test("mutacao autenticada por cookie exige origem confiavel", () => {
  const cookie = `${sessionCookieName}=token`;
  assert.equal(invoke({ cookie }).statusCode, 403);
  assert.equal(invoke({ cookie, origin: "http://localhost:5173" }).nextCalled, true);
});

test("requisicoes seguras e bearer token nao dependem de origem", () => {
  const cookie = `${sessionCookieName}=token`;
  assert.equal(invoke({ method: "GET", cookie }).nextCalled, true);
  assert.equal(invoke({ authorization: "Bearer token" }).nextCalled, true);
});
