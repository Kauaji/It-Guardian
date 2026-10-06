import { assetFromRow } from "./agentMappers.js";

/**
 * SQL do registro de inventario/heartbeat do agente: estado anterior da
 * maquina, upsert do ativo, heartbeat, uso do enrollment e sincronizacao da
 * ativacao do dispositivo. Todas as funcoes recebem o executor (db) da
 * transacao aberta por services/agentInventoryService.js.
 */

/** Estado de presenca anterior da maquina (null na primeira vez que ela aparece). */
export async function findAgentAssetPresence(db, assetId) {
  const previous = await db("SELECT asset_id, last_seen_at, interval_seconds FROM agent_assets WHERE asset_id = $1", [assetId]);
  const row = previous.rows[0];
  return row ? { assetId: row.asset_id, lastSeenAt: row.last_seen_at, intervalSeconds: row.interval_seconds } : null;
}

/** Cria ou atualiza o ativo do agente com o inventario recebido; preserva o apelido definido pelo operador. */
export async function upsertAgentAsset(db, { enrollmentId, payload }) {
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
      enrollmentId,
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

  return assetFromRow(result.rows[0]);
}

export async function insertAgentHeartbeat(db, { id, enrollmentId, payload }) {
  await db(
    `
      INSERT INTO agent_heartbeats (
        id, asset_id, enrollment_id, collected_at, payload
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [id, payload.machineId, enrollmentId, payload.collectedAt, payload]
  );
}

export async function touchAgentEnrollment(db, enrollmentId) {
  await db("UPDATE agent_enrollments SET last_used_at = NOW() WHERE id = $1", [enrollmentId]);
}

/** Mantem a ativacao do dispositivo (apenas as ativas) alinhada ao ultimo heartbeat. */
export async function syncDeviceActivationFromHeartbeat(db, { activationId, payload }) {
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
    [activationId, payload.hostname, payload.machineAlias, payload.agentVersion]
  );
}
