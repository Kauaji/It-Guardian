import assert from "node:assert/strict";
import test from "node:test";
import { OcsInventoryService } from "./ocs/OcsInventoryService.js";
import { ZabbixService } from "./zabbix/ZabbixService.js";

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}

test("integracoes desabilitadas nao acessam a rede nem quebram o sistema", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new Error("nao deveria chamar a rede");
  };
  const ocs = new OcsInventoryService({ mode: "disabled", enabled: false, fetchImpl });
  const zabbix = new ZabbixService({ mode: "disabled", enabled: false, fetchImpl });

  assert.deepEqual(await ocs.listInventory(), []);
  assert.deepEqual(await zabbix.getHosts(), []);
  assert.deepEqual(await zabbix.getAlerts(), []);
  assert.equal((await ocs.testConnection()).skipped, true);
  assert.equal((await zabbix.testConnection()).skipped, true);
  assert.equal(calls, 0);
});

test("modo mock legado e tratado como desabilitado e nunca produz maquinas falsas", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new Error("nao deveria chamar a rede");
  };
  const ocs = new OcsInventoryService({ mode: "mock", enabled: true, fetchImpl });
  const zabbix = new ZabbixService({ mode: "mock", enabled: true, fetchImpl });

  assert.equal(ocs.getConfiguration().mode, "disabled");
  assert.equal(zabbix.getConfiguration().mode, "disabled");
  assert.deepEqual(await ocs.listInventory(), []);
  assert.deepEqual(await zabbix.getHosts(), []);
  assert.deepEqual(await zabbix.getAlerts(), []);
  assert.equal(calls, 0);
});

test("cliente OCS usa autenticacao sem expor credenciais na configuracao", async () => {
  const password = "senha-super-secreta";
  let request;
  const ocs = new OcsInventoryService({
    mode: "real",
    enabled: true,
    baseUrl: "http://ocs.internal/ocsapi/v1",
    username: "integration-reader",
    password,
    retries: 0,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return jsonResponse({ computers: [{ id: "42", name: "SRV-APP-01" }] });
    }
  });

  const assets = await ocs.listInventory();
  const serializedConfiguration = JSON.stringify(ocs.getConfiguration());

  assert.equal(assets.length, 1);
  assert.equal(request.url, "http://ocs.internal/ocsapi/v1/computers");
  assert.match(request.options.headers.authorization, /^Basic /);
  assert.equal(serializedConfiguration.includes(password), false);
  assert.equal(serializedConfiguration.includes("integration-reader"), false);
});

test("cliente Zabbix usa token somente no cabecalho e consulta apenas leitura", async () => {
  const token = "zabbix-token-super-secreto";
  const methods = [];
  const zabbix = new ZabbixService({
    mode: "real",
    enabled: true,
    apiUrl: "http://zabbix.internal/api_jsonrpc.php",
    token,
    retries: 0,
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      methods.push(payload.method);
      assert.equal(options.headers.authorization, `Bearer ${token}`);
      return jsonResponse({
        jsonrpc: "2.0",
        result: payload.method === "host.get"
          ? [{ hostid: "10084", host: "WS-FIN-07", interfaces: [] }]
          : [],
        id: payload.id
      });
    }
  });

  const hosts = await zabbix.getHosts();
  assert.equal(hosts.length, 1);
  assert.deepEqual(methods, ["host.get"]);
  assert.equal(JSON.stringify(zabbix.getConfiguration()).includes(token), false);
});

test("falhas externas retornam mensagem amigavel sem senha ou token", async () => {
  const password = "senha-que-nao-pode-vazar";
  const token = "token-que-nao-pode-vazar";
  const failedFetch = async () => jsonResponse({ error: "upstream" }, 503);
  const ocs = new OcsInventoryService({
    mode: "real",
    enabled: true,
    baseUrl: "http://ocs.internal",
    username: "reader",
    password,
    retries: 0,
    fetchImpl: failedFetch
  });
  const zabbix = new ZabbixService({
    mode: "real",
    enabled: true,
    apiUrl: "http://zabbix.internal/api_jsonrpc.php",
    token,
    retries: 0,
    fetchImpl: failedFetch
  });

  await assert.rejects(ocs.listInventory(), (error) => {
    assert.equal(error.code, "EXTERNAL_INTEGRATION_UNAVAILABLE");
    assert.match(error.message, /Nao foi possivel conectar/);
    assert.equal(error.message.includes(password), false);
    return true;
  });
  await assert.rejects(zabbix.getHosts(), (error) => {
    assert.equal(error.code, "EXTERNAL_INTEGRATION_UNAVAILABLE");
    assert.match(error.message, /Nao foi possivel conectar/);
    assert.equal(error.message.includes(token), false);
    return true;
  });
});
