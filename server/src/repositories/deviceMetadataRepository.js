import { query } from "../database.js";

export async function listDeviceMetadataMap() {
  const result = await query("SELECT device_id, asset_type, updated_at FROM device_metadata");

  return new Map(
    result.rows.map((row) => [
      row.device_id,
      {
        assetType: row.asset_type,
        updatedAt: row.updated_at
      }
    ])
  );
}

export async function findDeviceMetadata(deviceId) {
  const result = await query(
    "SELECT device_id, asset_type, updated_at FROM device_metadata WHERE device_id = $1",
    [deviceId]
  );

  return result.rows[0]
    ? {
        deviceId: result.rows[0].device_id,
        assetType: result.rows[0].asset_type,
        updatedAt: result.rows[0].updated_at
      }
    : null;
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
      RETURNING device_id, asset_type, updated_at
    `,
    [deviceId, assetType, userId]
  );

  return {
    deviceId: result.rows[0].device_id,
    assetType: result.rows[0].asset_type,
    updatedAt: result.rows[0].updated_at
  };
}
