import { query } from "../../database.js";
import { getPlanRowOrThrow } from "./floorPlanRowRepository.js";

/** Linhas cruas usadas pelos mapas de calor e pelo resumo da infraestrutura da planta. */
export async function loadInfrastructureRows(planId) {
  await getPlanRowOrThrow(planId);
  const [objects, assets, alerts, orders] = await Promise.all([
    query("SELECT id,label,linked_asset_id,group_id,segment_id,category,object_type FROM floor_plan_objects WHERE plan_id=$1", [planId]),
    query(
      "SELECT asset_id,hostname,machine_alias,cpu_usage_percent,memory_total_bytes,memory_used_bytes,disk_total_bytes,disk_free_bytes,last_seen_at,interval_seconds FROM agent_assets"
    ),
    query("SELECT asset_id,severity,status FROM alerts WHERE status='active'"),
    query("SELECT asset_id,status,priority,sla_due_at,created_at,closed_at FROM service_orders WHERE asset_id IS NOT NULL")
  ]);
  return { objects: objects.rows, assets: assets.rows, alerts: alerts.rows, orders: orders.rows };
}
