import { query } from "../../database.js";

export async function floorExistsInPlan(planId, floorId) {
  const floor = await query("SELECT id FROM floor_plan_floors WHERE id=$1 AND plan_id=$2", [floorId, planId]);
  return Boolean(floor.rowCount);
}

export async function upsertFloorPlanBackground({ id, planId, floorId, fileName, mimeType, buffer, sha256, userId }) {
  await query(
    `INSERT INTO floor_plan_backgrounds (id,plan_id,floor_id,file_name,mime_type,byte_size,sha256,file_data,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (floor_id) DO UPDATE SET file_name=EXCLUDED.file_name,mime_type=EXCLUDED.mime_type,byte_size=EXCLUDED.byte_size,sha256=EXCLUDED.sha256,file_data=EXCLUDED.file_data,created_by=EXCLUDED.created_by,updated_at=NOW()`,
    [id, planId, floorId, fileName, mimeType, buffer.length, sha256, buffer, userId]
  );
}

export async function setFloorBackgroundUrl(floorId, backgroundUrl) {
  await query("UPDATE floor_plan_floors SET background_url=$2, updated_at=NOW() WHERE id=$1", [floorId, backgroundUrl]);
}

export async function findFloorPlanBackground(planId, floorId) {
  const result = await query(
    "SELECT file_name,mime_type,byte_size,sha256,file_data,updated_at FROM floor_plan_backgrounds WHERE plan_id=$1 AND floor_id=$2",
    [planId, floorId]
  );
  return result.rows[0] || null;
}

export async function deleteFloorPlanBackground(planId, floorId) {
  const result = await query("DELETE FROM floor_plan_backgrounds WHERE plan_id=$1 AND floor_id=$2 RETURNING floor_id", [planId, floorId]);
  return Boolean(result.rowCount);
}

export async function clearFloorBackgroundUrl(planId, floorId) {
  await query("UPDATE floor_plan_floors SET background_url=NULL, updated_at=NOW() WHERE id=$1 AND plan_id=$2", [floorId, planId]);
}
