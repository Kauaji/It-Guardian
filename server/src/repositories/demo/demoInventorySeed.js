import { query } from "../../database.js";
import { demoAssignments, demoBackups, demoGroups, demoSegments } from "./demoInventoryData.js";

// Grupos, segmentos, atribuicao de maquinas a segmentos e maquinas de backup.
export async function seedDemoInventory() {
  for (const group of demoGroups) {
    await query(
      `
        INSERT INTO segment_groups (id, name, color, created_by)
        VALUES ($1, $2, $3, 'seed-admin')
        ON CONFLICT (id) DO NOTHING
      `,
      [group.id, group.name, group.color]
    );
  }

  for (const segment of demoSegments) {
    await query(
      `
        INSERT INTO inventory_segments (id, name, color, group_id, created_by)
        VALUES ($1, $2, $3, $4, 'seed-admin')
        ON CONFLICT (id) DO NOTHING
      `,
      [segment.id, segment.name, segment.color, segment.groupId]
    );
  }

  for (const [deviceId, segmentId] of demoAssignments) {
    await query(
      `
        INSERT INTO device_segments (device_id, segment_id, updated_by)
        VALUES ($1, $2, 'seed-admin')
        ON CONFLICT (device_id) DO NOTHING
      `,
      [deviceId, segmentId]
    );
  }

  for (const backup of demoBackups) {
    await query(
      `
        INSERT INTO device_metadata (
          device_id, asset_type, is_backup, backup_status,
          backup_original_segment_id, backup_original_segment_name, updated_by
        )
        VALUES ($1, 'ocs', TRUE, 'available', $2, $3, 'seed-admin')
        ON CONFLICT (device_id)
        DO UPDATE SET asset_type = COALESCE(device_metadata.asset_type, EXCLUDED.asset_type),
                      is_backup = TRUE,
                      backup_status = CASE
                        WHEN device_metadata.backup_status = 'in_use' THEN device_metadata.backup_status
                        ELSE 'available'
                      END,
                      backup_original_segment_id = COALESCE(device_metadata.backup_original_segment_id, EXCLUDED.backup_original_segment_id),
                      backup_original_segment_name = COALESCE(device_metadata.backup_original_segment_name, EXCLUDED.backup_original_segment_name),
                      updated_at = NOW()
      `,
      [backup.id, backup.segmentId, backup.segmentName]
    );
  }
}
