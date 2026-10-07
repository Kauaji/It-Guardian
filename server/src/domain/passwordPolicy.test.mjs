import assert from "node:assert/strict";
import test from "node:test";
import { assertValidPassword, validatePassword } from "./passwordPolicy.js";

test("aceita frase longa e imprevisivel", () => {
  assert.equal(validatePassword("cavalo-bateria-grampo-correto").valid, true);
  assert.equal(validatePassword("Zr7#kQ2!vLm9@xPw").valid, true);
});

test("rejeita senhas curtas, vazias e acima de 72 bytes", () => {
  assert.equal(validatePassword("curta1!").valid, false);
  assert.equal(validatePassword("            ").valid, false);
  assert.equal(validatePassword("a1".repeat(40)).valid, false);
});

test("rejeita senhas comuns mesmo com sufixo, caixa e leetspeak", () => {
  for (const weak of ["Password123456", "p@ssw0rd2024!!", "SENHA1234567890", "qwerty123456", "Admin@123456"]) {
    assert.equal(validatePassword(weak).valid, false, weak);
  }
});

test("rejeita repeticoes e sequencias", () => {
  for (const weak of ["aaaaaaaaaaaa", "123456789012", "abcabcabcabc", "abcdefghijkl", "qwertyuiopas"]) {
    assert.equal(validatePassword(weak).valid, false, weak);
  }
});

test("rejeita senha que contem nome ou e-mail", () => {
  const result = validatePassword("ana.pereira-2024-xk", { email: "ana.pereira@empresa.com", name: "Ana Pereira" });
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /nome ou e-mail/);
});

test("assertValidPassword lanca erro 400 exposto com codigo estavel", () => {
  assert.throws(
    () => assertValidPassword("123"),
    (error) => error.statusCode === 400 && error.expose === true && error.code === "WEAK_PASSWORD"
  );
});
