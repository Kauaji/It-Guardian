import assert from "node:assert/strict";
import test from "node:test";
import {
  buildJobMessage,
  buildUpdateMessage,
  derivePublicKeyBase64,
  generateSigningKeyPair,
  isP256PublicKey,
  sha256Hex,
  signJob,
  signMessage,
  signUpdateManifest,
  verifyMessage
} from "./agentSigning.js";

const pair = generateSigningKeyPair();
const other = generateSigningKeyPair();

test("chave gerada e P-256 e a publica derivada da privada confere", () => {
  assert.equal(isP256PublicKey(pair.publicKeyBase64), true);
  assert.equal(derivePublicKeyBase64(pair.privateKeyPem), pair.publicKeyBase64);
  assert.equal(isP256PublicKey("AAAA"), false);
});

test("mensagem de atualizacao: assinatura valida, e qualquer campo alterado invalida", () => {
  const manifest = { version: "1.4.0", sha256: "a".repeat(64), url: "https://exemplo.local/agent.exe" };
  const signature = signUpdateManifest(pair.privateKeyPem, manifest);
  assert.equal(verifyMessage(pair.publicKeyBase64, buildUpdateMessage(manifest), signature), true);
  for (const tampered of [
    { ...manifest, version: "1.4.1" },
    { ...manifest, sha256: "b".repeat(64) },
    { ...manifest, url: "https://atacante.local/agent.exe" }
  ]) {
    assert.equal(verifyMessage(pair.publicKeyBase64, buildUpdateMessage(tampered), signature), false);
  }
  assert.equal(verifyMessage(other.publicKeyBase64, buildUpdateMessage(manifest), signature), false, "chave errada");
});

test("hash em maiusculas e normalizado: a mensagem e a mesma", () => {
  const lower = buildUpdateMessage({ version: "1", sha256: "ab".repeat(32), url: "https://x" });
  const upper = buildUpdateMessage({ version: "1", sha256: "AB".repeat(32), url: "https://x" });
  assert.equal(lower, upper);
});

test("job assinado amarra job, ativo, interpretador, timeout, conteudo e validade", () => {
  const job = { jobId: "job-1", assetId: "asset-1", interpreter: "powershell", timeoutSeconds: 120, content: "Get-Date" };
  const { notAfter, signature } = signJob(pair.privateKeyPem, job, { now: 1_700_000_000_000 });
  assert.equal(notAfter, 1_700_000_900);
  const message = (overrides = {}) =>
    buildJobMessage({ ...job, contentSha256: sha256Hex(job.content), notAfter, ...overrides });
  assert.equal(verifyMessage(pair.publicKeyBase64, message(), signature), true);
  assert.equal(verifyMessage(pair.publicKeyBase64, message({ assetId: "asset-2" }), signature), false, "outro ativo");
  assert.equal(verifyMessage(pair.publicKeyBase64, message({ jobId: "job-2" }), signature), false);
  assert.equal(verifyMessage(pair.publicKeyBase64, message({ timeoutSeconds: 600 }), signature), false);
  assert.equal(verifyMessage(pair.publicKeyBase64, message({ interpreter: "cmd" }), signature), false);
  assert.equal(verifyMessage(pair.publicKeyBase64, message({ contentSha256: sha256Hex("Remove-Item *") }), signature), false, "conteudo trocado");
  assert.equal(verifyMessage(pair.publicKeyBase64, message({ notAfter: notAfter + 999999 }), signature), false, "validade estendida");
});

test("assinaturas malformadas nunca lancam: apenas falham", () => {
  const message = buildUpdateMessage({ version: "1", sha256: "a".repeat(64), url: "https://x" });
  for (const bad of ["", "nao-e-base64!!", "AAAA", Buffer.alloc(64).toString("base64"), Buffer.alloc(65, 1).toString("base64")]) {
    assert.equal(verifyMessage(pair.publicKeyBase64, message, bad), false);
  }
  assert.equal(verifyMessage("lixo", message, signMessage(pair.privateKeyPem, message)), false);
});

test("campos com quebra de linha sao recusados (injecao de campo na mensagem)", () => {
  assert.throws(() => buildUpdateMessage({ version: "1\nsha256=" + "0".repeat(64), sha256: "a".repeat(64), url: "https://x" }), /quebra de linha/);
});

test("aceita PEM com \\n literais, como vem de variavel de ambiente", () => {
  const escaped = pair.privateKeyPem.trim().replace(/\n/g, "\\n");
  const message = "ITG-UPDATE-V1\nversion=1";
  assert.equal(verifyMessage(pair.publicKeyBase64, message, signMessage(escaped, message)), true);
});
