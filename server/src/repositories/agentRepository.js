import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { createAgentToken, hashAgentToken } from "../domain/agentToken.js";
import { addAssetHistory } from "./assetHistoryRepository.js";
import { insertAssetMetricSample } from "./assetMetricHistoryRepository.js";
import { deriveMetricSampleFields, hasUsefulMetricPayload } from "../domain/assetMetricSample.js";

function enrollmentFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    active: row.active,
    createdBy: row.created_by,
    productKeyId: row.product_key_id || null,
    activationId: row.activation_id || null,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at
  };
}

function assetFromRow(row) {
  const inventoryDetails =
    row.inventory_details && typeof row.inventory_details === "object"
      ? row.inventory_details
      : {};
  return {
    id: row.asset_id,
    enrollmentId: row.enrollment_id,
    hostname: row.hostname,
    machineAlias: row.machine_alias,
    operatingSystem: row.operating_system,
    osArchitecture: row.os_architecture,
    windowsVersion: row.windows_version,
    localIp: row.local_ip,
    macAddress: row.mac_address,
    cpuModel: row.cpu_model,
    cpuUsagePercent: row.cpu_usage_percent == null ? null : Number(row.cpu_usage_percent),
    memoryTotalBytes: row.memory_total_bytes == null ? null : Number(row.memory_total_bytes),
    memoryUsedBytes: row.memory_used_bytes == null ? null : Number(row.memory_used_bytes),
    memoryFreeBytes: row.memory_free_bytes == null ? null : Number(row.memory_free_bytes),
    diskTotalBytes: row.disk_total_bytes == null ? null : Number(row.disk_total_bytes),
    diskFreeBytes: row.disk_free_bytes == null ? null : Number(row.disk_free_bytes),
    deviceManufacturer: row.device_manufacturer,
    deviceModel: row.device_model,
    serialNumber: row.serial_number,
    uptimeSeconds: row.uptime_seconds == null ? null : Number(row.uptime_seconds),
    loggedUser: row.logged_user,
    agentVersion: row.agent_version,
    intervalSeconds: row.interval_seconds,
    environment: row.environment_name,
    group: row.group_name,
    segment: row.segment_name,
    inventoryDetails,
    collectedAt: row.collected_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createAgentEnrollment({ name, createdBy = null }) {
  const token = createAgentToken();
  const result = await query(
    `
      INSERT INTO agent_enrollments (id, name, token_hash, token_prefix, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [randomUUID(), name, hashAgentToken(token), token.slice(0, 12), createdBy]
  );

  return { enrollment: enrollmentFromRow(result.rows[0]), token };
}

export async function listAgentEnrollments() {
  const result = await query(`
    SELECT *
    FROM agent_enrollments
    ORDER BY created_at DESC
  `);
  return result.rows.map(enrollmentFromRow);
}

export async function revokeAgentEnrollment(id) {
  const result = await query(
    `
      UPDATE agent_enrollments
      SET active = FALSE, revoked_at = NOW()
      WHERE id = $1 AND active = TRUE
      RETURNING *
    `,
    [id]
  );
  return result.rows[0] ? enrollmentFromRow(result.rows[0]) : null;
}

export async function authenticateAgentToken(token) {
  if (!token) return null;
  const result = await query(
    `
      SELECT *
      FROM agent_enrollments
      WHERE token_hash = $1 AND active = TRUE
      LIMIT 1
    `,
    [hashAgentToken(token)]
  );
  return result.rows[0] ? enrollmentFromRow(result.rows[0]) : null;
}

export async function recordAgentInventory({ enrollment, payload }) {
  return withTransaction(async (db) => {
    const previous = await db(
      "SELECT asset_id, last_seen_at, interval_seconds FROM agent_assets WHERE asset_id = $1",
      [payload.machineId]
    );
    const previousRow = previous.rows[0];

    const result = await db(
      `
        INSERT INTO agent_assets (
          asset_id, enrollment_id, hostname, machine_alias, operating_system,
          os_architecture, windows_version, local_ip, mac_address, cpu_model,
          cpu_usage_percent, memory_total_bytes, memory_used_bytes, memory_free_bytes,
          disk_total_bytes, disk_free_bytes, device_manufacturer, device_model,
          serial_number, uptime_seconds, logged_user, agent_version, interval_seconds,
          environment_name, group_name, segment_name, inventory_details,
          collected_at, last_seen_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, NOW(), NOW()
        )
        ON CONFLICT (asset_id) DO UPDATE SET
          enrollment_id = EXCLUDED.enrollment_id,
          hostname = EXCLUDED.hostname,
          machine_alias = COALESCE(agent_assets.machine_alias, EXCLUDED.machine_alias),
          operating_system = EXCLUDED.operating_system,
          os_architecture = EXCLUDED.os_architecture,
          windows_version = EXCLUDED.windows_version,
          local_ip = EXCLUDED.local_ip,
          mac_address = EXCLUDED.mac_address,
          cpu_model = EXCLUDED.cpu_model,
          cpu_usage_percent = EXCLUDED.cpu_usage_percent,
          memory_total_bytes = EXCLUDED.memory_total_bytes,
          memory_used_bytes = EXCLUDED.memory_used_bytes,
          memory_free_bytes = EXCLUDED.memory_free_bytes,
          disk_total_bytes = EXCLUDED.disk_total_bytes,
          disk_free_bytes = EXCLUDED.disk_free_bytes,
          device_manufacturer = EXCLUDED.device_manufacturer,
          device_model = EXCLUDED.device_model,
          serial_number = EXCLUDED.serial_number,
          uptime_seconds = EXCLUDED.uptime_seconds,
          logged_user = EXCLUDED.logged_user,
          agent_version = EXCLUDED.agent_version,
          interval_seconds = EXCLUDED.interval_seconds,
          environment_name = EXCLUDED.environment_name,
          group_name = EXCLUDED.group_name,
          segment_name = EXCLUDED.segment_name,
          inventory_details = EXCLUDED.inventory_details,
          collected_at = EXCLUDED.collected_at,
          last_seen_at = NOW(),
          updated_at = NOW()
        RETURNING *
      `,
      [
        payload.machineId,
        enrollment.id,
        payload.hostname,
        payload.machineAlias,
        payload.operatingSystem,
        payload.osArchitecture,
        payload.windowsVersion,
        payload.localIp,
        payload.macAddress,
        payload.cpuModel,
        payload.cpuUsagePercent,
        payload.memoryTotalBytes,
        payload.memoryUsedBytes,
        payload.memoryFreeBytes,
        payload.diskTotalBytes,
        payload.diskFreeBytes,
        payload.deviceManufacturer,
        payload.deviceModel,
        payload.serialNumber,
        payload.uptimeSeconds,
        payload.loggedUser,
        payload.agentVersion,
        payload.intervalSeconds,
        payload.environment,
        payload.group,
        payload.segment,
        payload.inventoryDetails,
        payload.collectedAt
      ]
    );

    await db(
      `
        INSERT INTO agent_heartbeats (
          id, asset_id, enrollment_id, collected_at, payload
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [randomUUID(), payload.machineId, enrollment.id, payload.collectedAt, payload]
    );

    if (hasUsefulMetricPayload(payload)) {
      await insertAssetMetricSample({
        assetId: payload.machineId,
        collectedAt: payload.collectedAt,
        ...deriveMetricSampleFields(payload),
        db
      });
    }

    await db("UPDATE agent_enrollments SET last_used_at = NOW() WHERE id = $1", [enrollment.id]);
    if (enrollment.activationId) {
      await db(
        `
          UPDATE device_activations
          SET hostname = $2,
              alias = COALESCE($3, alias),
              collector_version = $4,
              last_seen_at = NOW(),
              updated_at = NOW()
          WHERE id = $1 AND status = 'active'
        `,
        [
          enrollment.activationId,
          payload.hostname,
          payload.machineAlias,
          payload.agentVersion
        ]
      );
    }

    const configuredThresholdSeconds = process.env.AGENT_OFFLINE_AFTER_SECONDS
      ? Number(process.env.AGENT_OFFLINE_AFTER_SECONDS)
      : Number(process.env.AGENT_OFFLINE_AFTER_MINUTES || 10) * 60;
    const staleThresholdMs = Math.max(
      configuredThresholdSeconds,
      Number(previousRow?.interval_seconds || payload.intervalSeconds) * 3
    ) * 1000;
    const wasStale = previousRow && Date.now() - new Date(previousRow.last_seen_at).getTime() > staleThresholdMs;
    if (!previousRow || wasStale) {
      await addAssetHistory({
        assetId: payload.machineId,
        eventType: previousRow ? "agent_reconnected" : "agent_enrolled",
        message: previousRow
          ? `Agente IT Guardian voltou a comunicar na maquina ${payload.hostname}.`
          : `Agente IT Guardian registrado na maquina ${payload.hostname}.`,
        newValue: JSON.stringify({
          agentVersion: payload.agentVersion,
          source: "agent",
          enrollmentId: enrollment.id
        }),
        userName: "Agente IT Guardian",
        db
      });
    }

    return assetFromRow(result.rows[0]);
  });
}

export async function listAgentAssets() {
  const result = await query("SELECT * FROM agent_assets ORDER BY hostname");
  return result.rows.map(assetFromRow);
}

export async function findAgentAssetById(assetId) {
  const result = await query("SELECT * FROM agent_assets WHERE asset_id = $1 LIMIT 1", [assetId]);
  return result.rows[0] ? assetFromRow(result.rows[0]) : null;
}

// Unico ponto que decide "este ativo tem um agente com enrollment
// ativo" - reaproveitado tanto pelo enfileiramento real de scripts
// (agentScriptJobRepository.js) quanto pelo diagnostico somente-leitura,
// para as duas nocoes de "agente ativo" nunca divergirem entre si.
export async function findActiveAgentEnrollmentForAsset(assetId, db = query) {
  const result = await db(
    `
      SELECT assets.asset_id, assets.enrollment_id
      FROM agent_assets assets
      INNER JOIN agent_enrollments enrollments ON enrollments.id = assets.enrollment_id
      WHERE assets.asset_id = $1
        AND enrollments.active = TRUE
      LIMIT 1
    `,
    [assetId]
  );
  return result.rows[0]
    ? { assetId: result.rows[0].asset_id, enrollmentId: result.rows[0].enrollment_id }
    : null;
}

export async function findAgentAssetByEnrollmentId(enrollmentId) {
  const result = await query(
    `
      SELECT * FROM agent_assets
      WHERE enrollment_id = $1
      ORDER BY last_seen_at DESC
      LIMIT 1
    `,
    [enrollmentId]
  );
  return result.rows[0] ? assetFromRow(result.rows[0]) : null;
}

export async function findAgentAssetByActivationId(activationId) {
  const result = await query(
    `
      SELECT assets.*
      FROM agent_assets assets
      INNER JOIN agent_enrollments enrollments ON enrollments.id = assets.enrollment_id
      WHERE enrollments.activation_id = $1
      ORDER BY assets.last_seen_at DESC NULLS LAST
      LIMIT 1
    `,
    [activationId]
  );
  return result.rows[0] ? assetFromRow(result.rows[0]) : null;
}

export async function updateAgentAssetAlias({ assetId, alias }) {
  return withTransaction(async (db) => {
    const result = await db(
      `
        UPDATE agent_assets
        SET machine_alias = $2, updated_at = NOW()
        WHERE asset_id = $1
        RETURNING *
      `,
      [assetId, alias || null]
    );
    if (!result.rows[0]) return null;

    const enrollment = await db(
      "SELECT activation_id FROM agent_enrollments WHERE id = $1 LIMIT 1",
      [result.rows[0].enrollment_id]
    );
    if (enrollment.rows[0]?.activation_id) {
      await db(
        "UPDATE device_activations SET alias = $2, updated_at = NOW() WHERE id = $1",
        [enrollment.rows[0].activation_id, alias || null]
      );
    }
    return assetFromRow(result.rows[0]);
  });
}
