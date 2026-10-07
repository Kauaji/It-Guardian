import assert from "node:assert/strict";
import test from "node:test";

process.env.API_RATE_LIMIT_PER_MINUTE = "3";
process.env.API_MUTATION_RATE_LIMIT_PER_MINUTE = "2";
process.env.API_ANONYMOUS_RATE_LIMIT_PER_MINUTE = "2";
process.env.API_ANONYMOUS_MUTATION_RATE_LIMIT_PER_MINUTE = "1";
const { globalApiRateLimit } = await import("./securityMiddleware.js");

async function hit({ method = "GET", path = "/devices", headers = {}, ip = "10.0.0.1" } = {}) {
  let status = 200;
  const res = {
    setHeader() {},
    status(code) {
      status = code;
      return this;
    },
    json() {
      return this;
    }
  };
  await globalApiRateLimit({ method, path, headers, ip }, res, () => {});
  return status;
}

test("contagem por credencial: usuarios atras do mesmo IP nao dividem o limite", async () => {
  const a = { authorization: "Bearer token-a-bem-longo-1234567890" };
  const b = { authorization: "Bearer token-b-bem-longo-1234567890" };
  for (let index = 0; index < 3; index += 1) assert.equal(await hit({ headers: a }), 200);
  assert.equal(await hit({ headers: a }), 429, "quarta leitura do usuario A passa do limite");
  assert.equal(await hit({ headers: b }), 200, "usuario B, mesmo IP, segue liberado");
});

test("escrita tem limite proprio e menor que o de leitura", async () => {
  const headers = { cookie: "it_guardian_session=cookie-de-teste-longo-abcdefghij" };
  assert.equal(await hit({ method: "POST", headers }), 200);
  assert.equal(await hit({ method: "POST", headers }), 200);
  assert.equal(await hit({ method: "POST", headers }), 429);
  assert.equal(await hit({ method: "GET", headers }), 200);
});

test("sem credencial o limite e por IP e mais baixo", async () => {
  assert.equal(await hit({ ip: "10.9.9.9" }), 200);
  assert.equal(await hit({ ip: "10.9.9.9" }), 200);
  assert.equal(await hit({ ip: "10.9.9.9" }), 429);
  assert.equal(await hit({ ip: "10.9.9.8" }), 200);
});

test("agentes e health ficam fora do limite geral", async () => {
  for (let index = 0; index < 10; index += 1) {
    assert.equal(await hit({ path: "/agents/heartbeat", ip: "10.7.7.7" }), 200);
    assert.equal(await hit({ path: "/health/ready", ip: "10.7.7.7" }), 200);
  }
});
