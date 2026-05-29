import { query } from "../database.js";

function fromRow(row) {
  return {
    deviceId: row.device_id,
    assetType: row.asset_type,
    removedAt: row.removed_at,
    isBackup: Boolean(row.is_backup),
    backupStatus: row.backup_status || "available",
    backupOrderId: row.backup_order_id || null,
    backupOriginalSegmentId: row.backup_original_segment_id || null,
    backupOriginalSegmentName: row.backup_original_segment_name || null,
    updatedAt: row.updated_at
  };
}

export async function listDeviceMetadataMap() {
  const result = await query(`
    SELECT device_id,
           asset_type,
           removed_at,
           is_backup,
           backup_status,
           backup_order_id,
           backup_original_segment_id,
           backup_original_segment_name,
           updated_at
    FROM device_metadata
  `);

  return new Map(
    result.rows.map((row) => [row.device_id, fromRow(row)])
  );
}

export async function findDeviceMetadata(deviceId) {
  const result = await query(
    `
      SELECT device_id,
             asset_type,
             removed_at,
             is_backup,
             backup_status,
             backup_order_id,
             backup_original_segment_id,
             backup_original_segment_name,
             updated_at
      FROM device_metadata
      WHERE device_id = $1
    `,
    [deviceId]
  );

  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function markDeviceRemoved({ deviceId, assetType, userId }) {
  const result = await query(
    `
      INSERT INTO device_metadata (device_id, asset_type, removed_at, removed_by, updated_by)
      VALUES ($1, $2, NOW(), $3, $3)
      ON CONFLICT (device_id)
      DO UPDATE SET asset_type = COALESCE(device_metadata.asset_type, EXCLUDED.asset_type),
                    removed_at = NOW(),
                    removed_by = EXCLUDED.removed_by,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = NOW()
      RETURNING device_id, asset_type, removed_at, is_backup, backup_status, backup_order_id,
                backup_original_segment_id, backup_original_segment_name, updated_at
    `,
    [deviceId, assetType, userId]
  );

  return fromRow(result.rows[0]);
}

export async function updateDeviceType({ deviceId, assetType, userId }) {
  const result = await query(
    `
      INSERT INTO device_metadata (device_id, asset_type, updated_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (device_id)
      DO UPDATE SET asset_type = EXCLUDED.asset_type,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = NOW()
      RETURNING device_id, asset_type, removed_at, is_backup, backup_status, backup_order_id,
                backup_original_segment_id, backup_original_segment_name, updated_at
    `,
    [deviceId, assetType, userId]
  );

  return fromRow(result.rows[0]);
}

export async function updateDeviceBackup({
  deviceId,
  assetType,
  isBackup,
  backupStatus = "available",
  backupOrderId = null,
  backupOriginalSegmentId = null,
  backupOriginalSegmentName = null,
  userId
}) {
  const nextStatus = backupStatus === "in_use" ? "in_use" : "available";
  const nextIsBackup = Boolean(isBackup);

  const result = await query(
    `
      INSERT INTO device_metadata (
        device_id,
        asset_type,
        updated_by,
        is_backup,
        backup_status,
        backup_order_id,
        backup_original_segment_id,
        backup_original_segment_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (device_id)
      DO UPDATE SET asset_type = COALESCE(EXCLUDED.asset_type, device_metadata.asset_type),
                    updated_by = EXCLUDED.updated_by,
                    is_backup = EXCLUDED.is_backup,
                    backup_status = CASE WHEN EXCLUDED.is_backup THEN EXCLUDED.backup_status ELSE 'available' END,
                    backup_order_id = CASE WHEN EXCLUDED.is_backup THEN EXCLUDED.backup_order_id ELSE NULL END,
                    backup_original_segment_id = CASE WHEN EXCLUDED.is_backup THEN EXCLUDED.backup_original_segment_id ELSE NULL END,
                    backup_original_segment_name = CASE WHEN EXCLUDED.is_backup THEN EXCLUDED.backup_original_segment_name ELSE NULL END,
                    updated_at = NOW()
      RETURNING device_id, asset_type, removed_at, is_backup, backup_status, backup_order_id,
                backup_original_segment_id, backup_original_segment_name, updated_at
    `,
    [
      deviceId,
      assetType,
      userId,
      nextIsBackup,
      nextIsBackup ? nextStatus : "available",
      nextIsBackup ? backupOrderId : null,
      nextIsBackup ? backupOriginalSegmentId : null,
      nextIsBackup ? backupOriginalSegmentName : null
    ]
  );

  return fromRow(result.rows[0]);
}
