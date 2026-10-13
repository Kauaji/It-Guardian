import assert from "node:assert/strict";
import test from "node:test";
import { generateActionToken, hashActionToken, isPlausibleActionToken, resolveActionTokenTtlMinutes } from "./actionToken.js";

test("gera token aleatorio de 256 bits em base64url e guarda so o hash", () => {
  const first = generateActionToken();
  const second = generateActionToken();

  assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.token, second.token);
  assert.match(first.tokenHash, /^[0-9a-f]{64}$/);
  assert.equal(first.tokenHash, hashActionToken(first.token));
  assert.ok(!first.tokenHash.includes(first.token), "o hash nao pode conter o token em claro");
});

test("o hash e deterministico e diferente para tokens diferentes", () => {
  assert.equal(hashActionToken("abc"), hashActionToken("abc"));
  assert.notEqual(hashActionToken("abc"), hashActionToken("abd"));
});

test("isPlausibleActionToken recusa lixo antes de qualquer consulta ao banco", () => {
  assert.equal(isPlausibleActionToken(generateActionToken().token), true);
  for (const bad of ["", "curto", "x".repeat(300), "com espaco no meio ".repeat(3), `${"a".repeat(42)}!`, null, undefined, 42, {}]) {
    assert.equal(isPlausibleActionToken(bad), false, `deveria recusar ${JSON.stringify(bad)}`);
  }
});

test("a validade padrao e de 30 minutos e respeita limites seguros", () => {
  assert.equal(resolveActionTokenTtlMinutes(undefined), 30);
  assert.equal(resolveActionTokenTtlMinutes("45"), 45);
  assert.equal(resolveActionTokenTtlMinutes("1"), 10, "nao menos que 10 minutos");
  assert.equal(resolveActionTokenTtlMinutes("100000"), 120, "nao mais que 2 horas");
  assert.equal(resolveActionTokenTtlMinutes("abc"), 30);
});
