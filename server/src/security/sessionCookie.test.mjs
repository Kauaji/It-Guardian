import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSessionCookie,
  readSessionCookie,
  sessionCookieName,
  setSessionCookie
} from "./sessionCookie.js";

function responseProbe() {
  const headers = new Map();
  return {
    headers,
    setHeader(name, value) {
      headers.set(name, value);
    }
  };
}

test("cookie de sessao e HttpOnly, SameSite e disponivel para API e WebSocket", () => {
  const response = responseProbe();
  setSessionCookie(response, "signed-token");
  const cookie = response.headers.get("Set-Cookie");

  assert.match(cookie, new RegExp(`^${sessionCookieName}=signed-token`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.equal(readSessionCookie({ headers: { cookie } }), "signed-token");
});

test("logout expira o cookie de sessao", () => {
  const response = responseProbe();
  clearSessionCookie(response);
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
});
