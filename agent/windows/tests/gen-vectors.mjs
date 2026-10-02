// Gera signing-vectors.json: vetores de assinatura produzidos pela implementacao Node
// (server/src/security/agentSigning.js) para os testes do verificador C# (ITGuardian.Signing.cs).
//
//   node agent/windows/tests/gen-vectors.mjs
//
// Antes de gravar, confere que a propria verificacao do Node concorda com TODOS os positivos e
// rejeita TODOS os negativos; se algo divergir, o script falha e nada e gravado.
// As assinaturas ECDSA sao aleatorizadas: regenerar muda o arquivo (o que e esperado). Os testes
// dependem apenas da validade, nao dos bytes.
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildJobMessage,
  buildUpdateMessage,
  generateSigningKeyPair,
  isP256PublicKey,
  sha256Hex,
  signJob,
  signMessage,
  signUpdateManifest,
  verifyMessage
} from "../../../server/src/security/agentSigning.js";

const outputPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "signing-vectors.json");
const KEY_COUNT = 8;
const POSITIVE_COUNT = 240;

// PRNG deterministico (mulberry32) so para variar os campos das mensagens.
let seed = 0x1badc0de;
function random() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (items) => items[Math.floor(random() * items.length)];
const int = (min, max) => min + Math.floor(random() * (max - min + 1));
const hex = (bytes) => Array.from({ length: bytes }, () => int(0, 255).toString(16).padStart(2, "0")).join("");
const uuid = () => `${hex(4)}-${hex(2)}-4${hex(2).slice(1)}-a${hex(2).slice(1)}-${hex(6)}`;

const keys = Array.from({ length: KEY_COUNT }, () => generateSigningKeyPair());
const wrongKey = generateSigningKeyPair();

const urls = [
  "https://releases.exemplo.local/ITGuardian.exe",
  "https://github.com/org/it-guardian/releases/download/v1.7.0/ITGuardian.exe",
  "https://cdn.exemplo.com.br/agent/ITGuardian-1.8.2.exe?token=a%20b&x=1",
  "https://xn--exemplo-9ua.example/atualização.exe"
];
const interpreters = ["powershell", "cmd", "bat"];
const scripts = [
  "Get-Date",
  "ipconfig /all",
  "Restart-Service -Name Spooler -Force",
  "Write-Output 'acentuação: ção ñ 日本語 😀'",
  "@echo off\r\nipconfig /renew\r\n",
  "x".repeat(600)
];

const positives = [];
for (let index = 0; index < POSITIVE_COUNT; index += 1) {
  const key = keys[index % KEY_COUNT];
  if (index % 2 === 0) {
    const fields = {
      version: `${int(1, 9)}.${int(0, 40)}.${int(0, 99)}${random() < 0.2 ? `.${int(0, 9)}` : ""}`,
      sha256: hex(32),
      url: pick(urls)
    };
    positives.push({
      kind: "update",
      publicKey: key.publicKeyBase64,
      fields,
      message: buildUpdateMessage(fields),
      signature: signUpdateManifest(key.privateKeyPem, fields)
    });
  } else {
    const job = {
      jobId: uuid(),
      assetId: random() < 0.5 ? uuid() : `MACHINE-${hex(6)}`,
      interpreter: pick(interpreters),
      timeoutSeconds: int(15, 600),
      content: pick(scripts) + (random() < 0.5 ? "" : `\n# ${hex(4)}`)
    };
    const { notAfter, signature } = signJob(key.privateKeyPem, job, { now: int(1_700_000_000, 1_900_000_000) * 1000 });
    const fields = {
      jobId: job.jobId,
      assetId: job.assetId,
      interpreter: job.interpreter,
      timeoutSeconds: job.timeoutSeconds,
      content: job.content,
      contentSha256: sha256Hex(job.content),
      notAfter
    };
    positives.push({
      kind: "job",
      publicKey: key.publicKeyBase64,
      fields,
      message: buildJobMessage(fields),
      signature
    });
  }
}

// ---- negativos ---------------------------------------------------------------------------
const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const be32 = (value) => Buffer.from(value.toString(16).padStart(64, "0"), "hex");
const sigParts = (signature) => {
  const raw = Buffer.from(signature, "base64");
  return { r: raw.subarray(0, 32), s: raw.subarray(32, 64) };
};
const join = (r, s) => Buffer.concat([r, s]).toString("base64");

const negatives = [];
// strictOnly: o createPublicKey do Node tolera bytes sobrando no DER; o verificador do agente e mais
// estrito (exige exatamente 91 bytes). Esses vetores so conferem que isP256PublicKey recusa a chave.
function negative(name, publicKey, message, signature, { strictOnly = false } = {}) {
  negatives.push({ name, publicKey, message, signature, ...(strictOnly ? { strictOnly: true } : {}) });
}

for (let index = 0; index < 16; index += 1) {
  const base = positives[index * 7 % positives.length];
  const { r, s } = sigParts(base.signature);
  const tag = `#${index}`;

  negative(`mensagem alterada (um caractere) ${tag}`, base.publicKey, base.message.replace(/.$/, (c) => (c === "0" ? "1" : "0")), base.signature);
  negative(`mensagem com sufixo ${tag}`, base.publicKey, `${base.message}\n`, base.signature);
  negative(`mensagem vazia ${tag}`, base.publicKey, "", base.signature);

  const flipped = Buffer.from(base.signature, "base64");
  flipped[index % 64] ^= 1 << (index % 8);
  negative(`bit flip na assinatura (byte ${index % 64}) ${tag}`, base.publicKey, base.message, flipped.toString("base64"));

  const otherKey = keys.find((key) => key.publicKeyBase64 !== base.publicKey);
  negative(`chave errada ${tag}`, otherKey.publicKeyBase64, base.message, base.signature);
  negative(`chave nao relacionada ${tag}`, wrongKey.publicKeyBase64, base.message, base.signature);

  negative(`r = 0 ${tag}`, base.publicKey, base.message, join(Buffer.alloc(32), s));
  negative(`s = 0 ${tag}`, base.publicKey, base.message, join(r, Buffer.alloc(32)));
  negative(`r = n ${tag}`, base.publicKey, base.message, join(be32(N), s));
  negative(`s = n ${tag}`, base.publicKey, base.message, join(r, be32(N)));
  negative(`r = n + 1 ${tag}`, base.publicKey, base.message, join(be32(N + 1n), s));
  negative(`s = n + 1 ${tag}`, base.publicKey, base.message, join(r, be32(N + 1n)));
  negative(`r = 2^256-1 ${tag}`, base.publicKey, base.message, join(Buffer.alloc(32, 0xff), s));
  negative(`s = 2^256-1 ${tag}`, base.publicKey, base.message, join(r, Buffer.alloc(32, 0xff)));
  // Assinatura de uma mensagem diferente com a mesma chave.
  const signer = keys.find((key) => key.publicKeyBase64 === base.publicKey);
  negative(`assinatura de outra mensagem ${tag}`, base.publicKey, base.message, signMessage(signer.privateKeyPem, `${base.message}\nextra=1`));
}

const reference = positives[0];
const rawSignature = Buffer.from(reference.signature, "base64");
negative("assinatura vazia", reference.publicKey, reference.message, "");
negative("assinatura 63 bytes", reference.publicKey, reference.message, rawSignature.subarray(0, 63).toString("base64"));
negative("assinatura 65 bytes", reference.publicKey, reference.message, Buffer.concat([rawSignature, Buffer.from([1])]).toString("base64"));
negative("assinatura 128 bytes", reference.publicKey, reference.message, Buffer.concat([rawSignature, rawSignature]).toString("base64"));
negative("assinatura nao e base64", reference.publicKey, reference.message, "@@@nao-e-base64@@@");
negative("assinatura DER em vez de P1363", reference.publicKey, reference.message,
  Buffer.concat([Buffer.from([0x30, 0x44, 0x02, 0x20]), rawSignature.subarray(0, 32), Buffer.from([0x02, 0x20]), rawSignature.subarray(32)]).toString("base64"));

const spki = Buffer.from(reference.publicKey, "base64");
const flipLast = Buffer.from(spki);
flipLast[flipLast.length - 1] ^= 1;
const flipX = Buffer.from(spki);
flipX[27] ^= 0x80;
const compressed = Buffer.from(spki);
compressed[26] = 0x02;
const otherCurves = ["secp256k1", "secp384r1", "secp521r1"].map((namedCurve) => ({
  namedCurve,
  spki: generateKeyPairSync("ec", { namedCurve }).publicKey.export({ type: "spki", format: "der" })
}));

negative("chave: ponto fora da curva (Y alterado)", flipLast.toString("base64"), reference.message, reference.signature);
negative("chave: ponto fora da curva (X alterado)", flipX.toString("base64"), reference.message, reference.signature);
negative("chave: marcador de ponto comprimido", compressed.toString("base64"), reference.message, reference.signature);
negative("chave: sem prefixo SPKI (so o ponto, 65 bytes)", spki.subarray(26).toString("base64"), reference.message, reference.signature);
negative("chave: prefixo SPKI errado (91 bytes)", Buffer.concat([Buffer.alloc(26, 0x11), spki.subarray(26)]).toString("base64"), reference.message, reference.signature);
negative("chave: truncada (90 bytes)", spki.subarray(0, 90).toString("base64"), reference.message, reference.signature);
negative("chave: com byte extra (92 bytes)", Buffer.concat([spki, Buffer.from([0])]).toString("base64"), reference.message, reference.signature, { strictOnly: true });
negative("chave: vazia", "", reference.message, reference.signature);
negative("chave: nao e base64", "%%%", reference.message, reference.signature);
negative("chave: ponto no infinito (X=Y=0)", Buffer.concat([spki.subarray(0, 27), Buffer.alloc(64)]).toString("base64"), reference.message, reference.signature);
for (const { namedCurve, spki: otherSpki } of otherCurves) {
  negative(`chave: SPKI de outra curva (${namedCurve})`, otherSpki.toString("base64"), reference.message, reference.signature);
}

// ---- cenarios do portao de atualizacao (assinados por scenarioKey) ------------------------------
// O Node assina qualquer campo sem validar formato; o agente (UpdateGate) recusa os malformados
// MESMO com assinatura valida. "expect" e o que o agente deve decidir.
const scenarioKey = keys[0];
const goodSha = hex(32);
const scenarioFields = [
  ["aceita: manifesto normal", { version: "9.9.9", sha256: goodSha, url: "https://releases.exemplo.local/ITGuardian.exe" }, "allowed"],
  ["aceita: SHA-256 em maiusculas (mensagem usa minusculas)", { version: "9.9.9", sha256: goodSha.toUpperCase(), url: "https://releases.exemplo.local/ITGuardian.exe" }, "allowed"],
  ["recusa: URL http", { version: "9.9.9", sha256: goodSha, url: "http://releases.exemplo.local/ITGuardian.exe" }, "refused"],
  ["recusa: URL ftp", { version: "9.9.9", sha256: goodSha, url: "ftp://releases.exemplo.local/ITGuardian.exe" }, "refused"],
  ["recusa: URL relativa", { version: "9.9.9", sha256: goodSha, url: "releases.exemplo.local/ITGuardian.exe" }, "refused"],
  ["recusa: SHA-256 com 63 caracteres", { version: "9.9.9", sha256: goodSha.slice(1), url: "https://releases.exemplo.local/ITGuardian.exe" }, "refused"],
  ["recusa: SHA-256 nao hexadecimal", { version: "9.9.9", sha256: `${"z".repeat(64)}`, url: "https://releases.exemplo.local/ITGuardian.exe" }, "refused"],
  ["recusa: versao fora do formato (sufixo)", { version: "9.9.9-beta", sha256: goodSha, url: "https://releases.exemplo.local/ITGuardian.exe" }, "refused"],
  ["recusa: versao com espaco", { version: " 9.9.9", sha256: goodSha, url: "https://releases.exemplo.local/ITGuardian.exe" }, "refused"],
  ["recusa: versao com cinco segmentos", { version: "9.9.9.9.9", sha256: goodSha, url: "https://releases.exemplo.local/ITGuardian.exe" }, "refused"]
];
const updateScenarios = scenarioFields.map(([name, fields, expect]) => ({
  name,
  expect,
  publicKey: scenarioKey.publicKeyBase64,
  fields,
  signature: signUpdateManifest(scenarioKey.privateKeyPem, fields)
}));

// ---- autoconferencia contra a implementacao do Node ---------------------------------------
for (const [index, vector] of positives.entries()) {
  if (!isP256PublicKey(vector.publicKey)) throw new Error(`positivo ${index}: chave nao e P-256`);
  if (!verifyMessage(vector.publicKey, vector.message, vector.signature)) {
    throw new Error(`positivo ${index} (${vector.kind}) nao verifica no Node`);
  }
}
for (const vector of negatives) {
  if (vector.strictOnly) {
    if (isP256PublicKey(vector.publicKey)) throw new Error(`negativo "${vector.name}" passou em isP256PublicKey`);
    continue;
  }
  if (verifyMessage(vector.publicKey, vector.message, vector.signature)) {
    throw new Error(`negativo "${vector.name}" foi ACEITO pelo Node`);
  }
}

const document = {
  description: "Vetores gerados por agent/windows/tests/gen-vectors.mjs (server/src/security/agentSigning.js). Nao edite a mao.",
  positives,
  negatives,
  updateScenarios
};
// Um vetor por linha: diff legivel e arquivo compacto.
const lines = (items) => items.map((item) => `  ${JSON.stringify(item)}`).join(",\n");
writeFileSync(
  outputPath,
  `{\n "description": ${JSON.stringify(document.description)},\n "positives": [\n${lines(positives)}\n ],\n "negatives": [\n${lines(negatives)}\n ],\n "updateScenarios": [\n${lines(updateScenarios)}\n ]\n}\n`
);
console.log(`signing-vectors.json: ${positives.length} positivos, ${negatives.length} negativos, ${updateScenarios.length} cenarios (todos conferidos no Node).`);
