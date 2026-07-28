import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { createAgentToken, hashAgentToken } from "../domain/agentToken.js";
import {
  generateProductKey,
  hashMachineFingerprint,
  hashProductKey,
  productKeyHint
} from "../domain/productKey.js";

function activationError(message, statusCode = 400, code = "ACTIVATION_FAILED") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.expose = true;
  return error;
}

function monitoringFromRow(row) {
  const ocsServerUrl = row.ocs_server_url || null;
  const zabbixServer = row.zabbix_server || null;
  const zabbixServerActive = row.zabbix_server_active || null;
  return {
    configured: Boolean(ocsServerUrl && zabbixServer && zabbixServerActive),
    ocsServerUrl,
    zabbixServer,
    zabbixServerActive
  };
}

function productKeyFromRow(row) {
  return {
    id: row.id,
    keyHint: row.key_hint,
    displayName: row.display_name,
    organizationName: row.organization_name,
    planName: row.plan_name,
    activationLimit: Number(row.activation_limit),
    activationCount: Number(row.activation_count),
    active: row.active,
    expiresAt: row.expires_at,
    monitoring: monitoringFromRow(row),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function activationFromRow(row) {
  return {
    id: row.id,
    productKeyId: row.product_key_id,
    hostname: row.hostname,
    alias: row.alias,
    status: row.status,
    collectorVersion: row.collector_version,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    deactivatedAt: row.deactivated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function insertEnrollment(db, {
  name,
  token,
  productKeyId,
  activationId,
  createdBy = null
}) {
  const tokenHash = hashAgentToken(token);
  const id = randomUUID();

  await db(
    `
      INSERT INTO agent_enrollments (
        id, name, token_hash, token_prefix, created_by, product_key_id, activation_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [id, name, tokenHash, token.slice(0, 12), createdBy, productKeyId, activationId]
  );

  return id;
}

export async function createProductKey({
  displayName,
  organizationName,
  planName,
  activationLimit,
  expiresAt = null,
  createdBy = null,
  monitoring = null
}) {
  const key = generateProductKey();
  const id = randomUUID();
  const result = await query(
    `
      INSERT INTO product_keys (
        id, key_hash, key_hint, display_name, organization_name, plan_name,
        activation_limit, expires_at, created_by, ocs_server_url, zabbix_server,
        zabbix_server_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
    [
      id,
      hashProductKey(key),
      productKeyHint(key),
      displayName,
      organizationName,
      planName,
      activationLimit,
      expiresAt,
      createdBy,
      monitoring?.ocsServerUrl || null,
      monitoring?.zabbixServer || null,
      monitoring?.zabbixServerActive || null
    ]
  );

  return { productKey: productKeyFromRow(result.rows[0]), key };
}

export async function listProductKeys() {
  const result = await query(`
    SELECT *
    FROM product_keys
    ORDER BY created_at DESC
  `);
  return result.rows.map(productKeyFromRow);
}

export async function listDeviceActivations(productKeyId = null) {
  const result = productKeyId
    ? await query(
      `
        SELECT *
        FROM device_activations
        WHERE product_key_id = $1
        ORDER BY last_seen_at DESC
      `,
      [productKeyId]
    )
    : await query(`
        SELECT *
        FROM device_activations
        ORDER BY last_seen_at DESC
      `);
  return result.rows.map(activationFromRow);
}

export async function activateCollector({
  productKey,
  machineFingerprint,
  hostname,
  alias = null,
  collectorVersion = null
}) {
  const keyHash = hashProductKey(productKey);
  const fingerprintHash = hashMachineFingerprint(machineFingerprint);
  if (!keyHash || !fingerprintHash) {
    throw activationError("Chave de produto ou identificador da maquina invalido.", 400, "INVALID_INPUT");
  }

  return withTransaction(async (db) => {
    const keyResult = await db(
      "SELECT * FROM product_keys WHERE key_hash = $1 FOR UPDATE",
      [keyHash]
    );
    const keyRow = keyResult.rows[0];
    if (!keyRow) {
      throw activationError("Chave de produto invalida.", 401, "INVALID_PRODUCT_KEY");
    }
    if (!keyRow.active) {
      throw activationError("Esta chave de produto esta inativa.", 403, "INACTIVE_PRODUCT_KEY");
    }
    if (keyRow.expires_at && new Date(keyRow.expires_at).getTime() <= Date.now()) {
      throw activationError("Esta chave de produto expirou.", 403, "EXPIRED_PRODUCT_KEY");
    }
    const monitoring = monitoringFromRow(keyRow);

    const existingResult = await db(
      `
        SELECT *
        FROM device_activations
        WHERE product_key_id = $1 AND machine_fingerprint = $2
        LIMIT 1
      `,
      [keyRow.id, fingerprintHash]
    );
    let activationRow = existingResult.rows[0];
    const needsSeat = !activationRow || activationRow.status !== "active";
    let currentKeyRow = keyRow;

    if (needsSeat) {
      const reservedSeat = await db(
        `
          UPDATE product_keys
          SET activation_count = activation_count + 1, updated_at = NOW()
          WHERE id = $1
            AND active = TRUE
            AND activation_count < activation_limit
          RETURNING *
        `,
        [keyRow.id]
      );
      if (!reservedSeat.rows[0]) {
        throw activationError(
          "O limite de ativacoes desta chave foi atingido.",
          409,
          "ACTIVATION_LIMIT_REACHED"
        );
      }
      currentKeyRow = reservedSeat.rows[0];
    }

    if (!activationRow) {
      const inserted = await db(
        `
          INSERT INTO device_activations (
            id, product_key_id, machine_fingerprint, hostname, alias, status, collector_version
          )
          VALUES ($1, $2, $3, $4, $5, 'active', $6)
          RETURNING *
        `,
        [randomUUID(), keyRow.id, fingerprintHash, hostname, alias, collectorVersion]
      );
      activationRow = inserted.rows[0];
    } else {
      const updated = await db(
        `
          UPDATE device_activations
          SET hostname = $2,
              alias = $3,
              status = 'active',
              collector_version = $4,
              last_seen_at = NOW(),
              deactivated_at = NULL,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [activationRow.id, hostname, alias, collectorVersion]
      );
      activationRow = updated.rows[0];
    }

    await db(
      `
        UPDATE agent_enrollments
        SET active = FALSE, revoked_at = NOW()
        WHERE activation_id = $1 AND active = TRUE
      `,
      [activationRow.id]
    );

    const token = createAgentToken();
    await insertEnrollment(db, {
      name: `Cloud collector - ${hostname}`,
      token,
      productKeyId: keyRow.id,
      activationId: activationRow.id
    });

    return {
      activation: activationFromRow(activationRow),
      productKey: productKeyFromRow(currentKeyRow),
      monitoring,
      token
    };
  });
}

export async function touchDeviceActivation(activationId, { hostname, alias, collectorVersion } = {}) {
  if (!activationId) return null;
  const result = await query(
    `
      UPDATE device_activations
      SET hostname = COALESCE($2, hostname),
          alias = COALESCE($3, alias),
          collector_version = COALESCE($4, collector_version),
          last_seen_at = NOW(),
          updated_at = NOW()
      WHERE id = $1 AND status = 'active'
      RETURNING *
    `,
    [activationId, hostname || null, alias || null, collectorVersion || null]
  );
  return result.rows[0] ? activationFromRow(result.rows[0]) : null;
}

export async function deactivateDeviceActivation(id) {
  return withTransaction(async (db) => {
    const result = await db(
      "SELECT * FROM device_activations WHERE id = $1 FOR UPDATE",
      [id]
    );
    const activation = result.rows[0];
    if (!activation) return null;
    if (activation.status !== "active") return activationFromRow(activation);

    const updated = await db(
      `
        UPDATE device_activations
        SET status = 'deactivated', deactivated_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id]
    );
    await db(
      `
        UPDATE product_keys
        SET activation_count = CASE
          WHEN activation_count > 0 THEN activation_count - 1
          ELSE 0
        END,
        updated_at = NOW()
        WHERE id = $1
      `,
      [activation.product_key_id]
    );
    await db(
      `
        UPDATE agent_enrollments
        SET active = FALSE, revoked_at = NOW()
        WHERE activation_id = $1 AND active = TRUE
      `,
      [id]
    );
    return activationFromRow(updated.rows[0]);
  });
}

export async function setProductKeyActive(id, active) {
  return withTransaction(async (db) => {
    const result = await db(
      `
        UPDATE product_keys
        SET active = $2,
            activation_count = CASE WHEN $2 = FALSE THEN 0 ELSE activation_count END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [id, active]
    );
    if (!result.rows[0]) return null;

    if (!active) {
      await db(
        `
          UPDATE device_activations
          SET status = 'deactivated', deactivated_at = NOW(), updated_at = NOW()
          WHERE product_key_id = $1 AND status = 'active'
        `,
        [id]
      );
      await db(
        `
          UPDATE agent_enrollments
          SET active = FALSE, revoked_at = NOW()
          WHERE product_key_id = $1 AND active = TRUE
        `,
        [id]
      );
    }

    return productKeyFromRow(result.rows[0]);
  });
}

export async function updateProductKeyMonitoring(id, monitoring) {
  const result = await query(
    `
      UPDATE product_keys
      SET ocs_server_url = $2,
          zabbix_server = $3,
          zabbix_server_active = $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      monitoring.ocsServerUrl,
      monitoring.zabbixServer,
      monitoring.zabbixServerActive
    ]
  );
  return result.rows[0] ? productKeyFromRow(result.rows[0]) : null;
}
