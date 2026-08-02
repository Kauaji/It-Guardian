import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.ENABLE_DEMO_SEED = "false";
process.env.JWT_SECRET = "cloud-activation-test-secret-with-32-characters";
process.env.NODE_ENV = "test";
process.env.PUBLIC_APP_URL = "https://it-guardian-server.vercel.app";

const { createApp } = await import("../src/app.js");
const { initializeRuntime } = await import("../src/bootstrap.js");
const { closeDatabase, query } = await import("../src/database.js");
const { default: jwt } = await import("jsonwebtoken");
const {
  createProductKey,
  deactivateDeviceActivation,
  setProductKeyActive
} = await import("../src/repositories/productKeyRepository.js");
const { createUser } = await import("../src/repositories/userRepository.js");

const monitoringA = {
  ocsServerUrl: "https://ocs.empresa-a.test/ocsinventory",
  zabbixServer: "zabbix.empresa-a.test",
  zabbixServerActive: "zabbix-active.empresa-a.test"
};

const monitoringB = {
  ocsServerUrl: "https://ocs.empresa-b.test/ocsinventory",
  zabbixServer: "zabbix.empresa-b.test",
  zabbixServerActive: "zabbix-active.empresa-b.test"
};

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function heartbeat(machineId, overrides = {}) {
  return {
    machineId,
    hostname: "CLOUD-PC-01",
    operatingSystem: "Microsoft Windows 11 Pro",
    osArchitecture: "64-bit",
    windowsVersion: "23H2",
    localIp: "10.20.30.40",
    macAddress: "00-11-22-33-44-55",
    cpuModel: "Intel Core i7",
    cpuUsagePercent: 27,
    memoryTotalBytes: 17179869184,
    memoryUsedBytes: 8589934592,
    memoryFreeBytes: 8589934592,
    diskTotalBytes: 512000000000,
    diskFreeBytes: 256000000000,
    deviceManufacturer: "Dell",
    deviceModel: "Latitude 5550",
    serialNumber: "SERIAL-CLOUD-01",
    uptimeSeconds: 7200,
    agentVersion: "1.1.0",
    collectedAt: new Date().toISOString(),
    intervalSeconds: 300,
    ...overrides
  };
}

async function activate(baseUrl, productKey, fingerprint, hostname = "CLOUD-PC-01") {
  return fetch(`${baseUrl}/api/collector/activate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      productKey,
      machineFingerprint: fingerprint,
      hostname,
      collectorVersion: "1.1.0"
    })
  });
}

test("ativacao cloud controla licencas, reinstalacao, revogacao e heartbeat", async (t) => {
  await initializeRuntime();
  const server = await listen(createApp());
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await closeDatabase();
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const protectedList = await fetch(`${baseUrl}/api/product-keys`);
  assert.equal(protectedList.status, 401);

  const regularUser = await createUser({
    name: "Tecnico Cloud",
    email: "tecnico-cloud@itguardian.test",
    password: "not-used-in-this-test",
    role: "operator"
  });
  const adminUser = await createUser({
    name: "Administrador Cloud",
    email: "admin-cloud@itguardian.test",
    password: "not-used-in-this-test",
    role: "admin",
    permissions: ["admin.full"]
  });
  const regularToken = jwt.sign({ sub: regularUser.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const adminToken = jwt.sign({ sub: adminUser.id }, process.env.JWT_SECRET, { expiresIn: "1h" });

  const forbiddenList = await fetch(`${baseUrl}/api/product-keys`, {
    headers: { authorization: `Bearer ${regularToken}` }
  });
  assert.equal(forbiddenList.status, 403);

  const authorizedList = await fetch(`${baseUrl}/api/product-keys`, {
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(authorizedList.status, 200);

  const invalid = await activate(baseUrl, "ITG-INVALID", "fingerprint-a");
  assert.equal(invalid.status, 400);

  const created = await createProductKey({
    displayName: "Cliente Cloud",
    organizationName: "Empresa Teste",
    planName: "Beta",
    activationLimit: 1
  });

  const missingMonitoring = await activate(baseUrl, created.key, "fingerprint-a");
  assert.equal(missingMonitoring.status, 201);
  const missingMonitoringBody = await missingMonitoring.json();
  assert.match(missingMonitoringBody.agentToken, /^itg_/);
  assert.deepEqual(missingMonitoringBody.monitoring, {
    configured: false,
    ocsServerUrl: null,
    zabbixServer: null,
    zabbixServerActive: null
  });
  assert.equal(missingMonitoringBody.ocsServerUrl, null);
  assert.equal(missingMonitoringBody.zabbixServer, null);
  assert.equal(missingMonitoringBody.zabbixServerActive, null);
  const activatedKey = await query(
    "SELECT activation_count FROM product_keys WHERE id = $1",
    [created.productKey.id]
  );
  assert.equal(Number(activatedKey.rows[0].activation_count), 1);
  const activatedRelations = await query(
    `
      SELECT
        (SELECT COUNT(*) FROM device_activations WHERE product_key_id = $1) AS activations,
        (SELECT COUNT(*) FROM agent_enrollments WHERE product_key_id = $1) AS enrollments
    `,
    [created.productKey.id]
  );
  assert.equal(Number(activatedRelations.rows[0].activations), 1);
  assert.equal(Number(activatedRelations.rows[0].enrollments), 1);

  const forbiddenMonitoring = await fetch(
    `${baseUrl}/api/product-keys/${created.productKey.id}/monitoring`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${regularToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(monitoringA)
    }
  );
  assert.equal(forbiddenMonitoring.status, 403);

  const invalidMonitoring = await fetch(
    `${baseUrl}/api/product-keys/${created.productKey.id}/monitoring`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ ...monitoringA, ocsServerUrl: "file:///servidor" })
    }
  );
  assert.equal(invalidMonitoring.status, 400);

  const configuredMonitoring = await fetch(
    `${baseUrl}/api/product-keys/${created.productKey.id}/monitoring`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(monitoringA)
    }
  );
  assert.equal(configuredMonitoring.status, 200);
  assert.deepEqual(
    (await configuredMonitoring.json()).productKey.monitoring,
    { configured: true, ...monitoringA }
  );

  const first = await activate(baseUrl, created.key, "fingerprint-a");
  assert.equal(first.status, 201);
  const firstBody = await first.json();
  assert.match(firstBody.agentToken, /^itg_/);
  const supportUrl = new URL(firstBody.supportUrl);
  assert.equal(supportUrl.origin, "https://it-guardian-server.vercel.app");
  assert.equal(supportUrl.pathname, "/abrir-chamado");
  assert.match(supportUrl.searchParams.get("device"), /^[A-Za-z0-9._-]+$/);
  assert.equal(firstBody.organization.organizationName, "Empresa Teste");
  assert.deepEqual(firstBody.monitoring, { configured: true, ...monitoringA });
  assert.equal(firstBody.ocsServerUrl, monitoringA.ocsServerUrl);
  assert.equal(firstBody.zabbixServer, monitoringA.zabbixServer);
  assert.equal(firstBody.zabbixServerActive, monitoringA.zabbixServerActive);
  assert.equal(JSON.stringify(firstBody).includes(created.key), false);

  const accepted = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${firstBody.agentToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(heartbeat("fingerprint-a"))
  });
  assert.equal(accepted.status, 202);

  const assetRows = await query(
    "SELECT cpu_usage_percent, device_manufacturer, serial_number FROM agent_assets"
  );
  assert.deepEqual(
    {
      cpuUsagePercent: Number(assetRows.rows[0].cpu_usage_percent),
      manufacturer: assetRows.rows[0].device_manufacturer,
      serialNumber: assetRows.rows[0].serial_number
    },
    { cpuUsagePercent: 27, manufacturer: "Dell", serialNumber: "SERIAL-CLOUD-01" }
  );

  const reinstalled = await activate(baseUrl, created.key, "FINGERPRINT-A", "CLOUD-PC-RENAMED");
  assert.equal(reinstalled.status, 201);
  const reinstalledBody = await reinstalled.json();
  assert.notEqual(reinstalledBody.agentToken, firstBody.agentToken);

  const oldToken = await fetch(`${baseUrl}/api/agents/heartbeat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${firstBody.agentToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(heartbeat("fingerprint-a"))
  });
  assert.equal(oldToken.status, 401);

  const keyRows = await query(
    "SELECT key_hash, activation_count FROM product_keys WHERE id = $1",
    [created.productKey.id]
  );
  assert.equal(Number(keyRows.rows[0].activation_count), 1);
  assert.notEqual(keyRows.rows[0].key_hash, created.key);

  const activationRows = await query(
    "SELECT id, machine_fingerprint FROM device_activations WHERE product_key_id = $1",
    [created.productKey.id]
  );
  assert.equal(activationRows.rows.length, 1);
  assert.notEqual(activationRows.rows[0].machine_fingerprint, "fingerprint-a");

  const overLimit = await activate(baseUrl, created.key, "fingerprint-b", "CLOUD-PC-02");
  assert.equal(overLimit.status, 409);

  await deactivateDeviceActivation(activationRows.rows[0].id);
  const replacement = await activate(baseUrl, created.key, "fingerprint-b", "CLOUD-PC-02");
  assert.equal(replacement.status, 201);

  await setProductKeyActive(created.productKey.id, false);
  const inactive = await activate(baseUrl, created.key, "fingerprint-c", "CLOUD-PC-03");
  assert.equal(inactive.status, 403);

  const expired = await createProductKey({
    displayName: "Expirada",
    organizationName: "Empresa Teste",
    planName: "Beta",
    activationLimit: 1,
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
    monitoring: monitoringA
  });
  const expiredResponse = await activate(baseUrl, expired.key, "fingerprint-expired");
  assert.equal(expiredResponse.status, 403);

  const concurrent = await createProductKey({
    displayName: "Concorrencia",
    organizationName: "Empresa Teste",
    planName: "Beta",
    activationLimit: 1,
    monitoring: monitoringA
  });
  const concurrentResponses = await Promise.all([
    activate(baseUrl, concurrent.key, "concurrent-a", "CLOUD-CONCURRENT-A"),
    activate(baseUrl, concurrent.key, "concurrent-b", "CLOUD-CONCURRENT-B")
  ]);
  assert.deepEqual(
    concurrentResponses.map((response) => response.status).sort(),
    [201, 409]
  );
  const concurrentRows = await query(
    `
      SELECT
        product_keys.activation_count,
        COUNT(device_activations.id) AS activation_rows
      FROM product_keys
      LEFT JOIN device_activations
        ON device_activations.product_key_id = product_keys.id
       AND device_activations.status = 'active'
      WHERE product_keys.id = $1
      GROUP BY product_keys.activation_count
    `,
    [concurrent.productKey.id]
  );
  assert.equal(Number(concurrentRows.rows[0].activation_count), 1);
  assert.equal(Number(concurrentRows.rows[0].activation_rows), 1);

  const isolated = await createProductKey({
    displayName: "Cliente isolado",
    organizationName: "Empresa B",
    planName: "Beta",
    activationLimit: 1,
    monitoring: monitoringB
  });
  const isolatedResponse = await activate(
    baseUrl,
    isolated.key,
    "fingerprint-isolated",
    "CLOUD-ISOLATED"
  );
  assert.equal(isolatedResponse.status, 201);
  const isolatedBody = await isolatedResponse.json();
  assert.deepEqual(isolatedBody.monitoring, { configured: true, ...monitoringB });
  assert.notDeepEqual(isolatedBody.monitoring, firstBody.monitoring);
});
