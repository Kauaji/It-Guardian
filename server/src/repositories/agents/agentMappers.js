/** Mapeamento das linhas de agent_enrollments e agent_assets para objetos de dominio. */

export function enrollmentFromRow(row) {
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

export function assetFromRow(row) {
  const inventoryDetails = row.inventory_details && typeof row.inventory_details === "object" ? row.inventory_details : {};
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
    rustdeskId: row.rustdesk_id || null,
    rustdeskIdUpdatedAt: row.rustdesk_id_updated_at || null,
    collectedAt: row.collected_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
