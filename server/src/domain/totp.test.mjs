import assert from "node:assert/strict";
import test from "node:test";
import {
  base32Decode,
  base32Encode,
  buildOtpauthUri,
  generateRecoveryCode,
  generateTotpSecret,
  hotp,
  normalizeRecoveryCode,
  totpAt,
  verifyTotp
} from "./totp.js";

// Vetores do RFC 6238, Apendice B (SHA-1, segredo ASCII "12345678901234567890").
const rfcSecret = Buffer.from("12345678901234567890");
const rfcVectors = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"]
];

test("hotp reproduz os vetores oficiais do RFC 6238", () => {
  for (const [seconds, expected] of rfcVectors) {
    assert.equal(hotp(rfcSecret, Math.floor(seconds / 30), 8), expected);
  }
});

test("base32 faz ida e volta e rejeita caracteres invalidos", () => {
  const encoded = base32Encode(rfcSecret);
  assert.equal(encoded, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.deepEqual(base32Decode(encoded), rfcSecret);
  assert.deepEqual(base32Decode(encoded.toLowerCase()), rfcSecret);
  assert.throws(() => base32Decode("AB1!"), /inválido/);
});

test("verifyTotp aceita a janela de +-1 passo e nada alem disso", () => {
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = totpAt(secret, now);
  assert.notEqual(verifyTotp(secret, code, { timeMs: now }), null);
  assert.notEqual(verifyTotp(secret, code, { timeMs: now + 30_000 }), null);
  assert.equal(verifyTotp(secret, code, { timeMs: now + 95_000 }), null);
  assert.equal(verifyTotp(secret, "12345", { timeMs: now }), null);
  assert.equal(verifyTotp(secret, "abcdef", { timeMs: now }), null);
});

test("verifyTotp nao aceita o mesmo passo duas vezes (anti-replay)", () => {
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = totpAt(secret, now);
  const step = verifyTotp(secret, code, { timeMs: now });
  assert.equal(typeof step, "number");
  assert.equal(verifyTotp(secret, code, { timeMs: now, lastUsedStep: step }), null);
});

test("URI otpauth carrega segredo, emissor e parametros", () => {
  const uri = buildOtpauthUri({ secret: "ABC234", accountName: "ana@empresa.com" });
  assert.match(uri, /^otpauth:\/\/totp\/IT%20Guardian%3Aana%40empresa\.com\?/);
  assert.match(uri, /secret=ABC234/);
  assert.match(uri, /period=30/);
});

test("codigos de recuperacao tem formato estavel e normalizam", () => {
  const code = generateRecoveryCode();
  assert.match(code, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  assert.equal(normalizeRecoveryCode(code.toLowerCase()), code.replace("-", ""));
  assert.notEqual(generateRecoveryCode(), generateRecoveryCode());
});
