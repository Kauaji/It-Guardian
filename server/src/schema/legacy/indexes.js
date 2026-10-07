import { query } from "../../database.js";

async function ensureIndexesBatch1() {
  await query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON audit_logs (created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_alert_acknowledgements_acknowledged_at
    ON alert_acknowledgements (acknowledged_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_alerts_status
    ON alerts (status, last_seen_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_alert_rules_type
    ON alert_rules (type, enabled);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_alert_comments_alert
    ON alert_comments (alert_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_order_suggestions_status
    ON service_order_suggestions (status, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_maintenance_scripts_active
    ON maintenance_scripts (active, updated_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_script_execution_logs_script
    ON script_execution_logs (script_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_script_execution_logs_asset
    ON script_execution_logs (asset_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_script_execution_logs_suggestion
    ON script_execution_logs (suggestion_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_script_execution_logs_attention
    ON script_execution_logs (attention_required, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_script_validation_runs_suggestion
    ON script_validation_runs (suggestion_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_script_validation_runs_due
    ON script_validation_runs (status, validation_due_at);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_order_suggestions_ignored_until
    ON service_order_suggestions (ignored_until);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_plans_created_at
    ON preventive_plans (created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_plan_assets_asset
    ON preventive_plan_assets (asset_id);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_preventive_plans_service_order_unique
    ON preventive_plans (service_order_id);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_orders_preventive_plan_unique
    ON service_orders (preventive_plan_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_plans_active
    ON preventive_automation_plans (active, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_plans_active_deleted
    ON preventive_automation_plans (active, deleted_at);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_plans_deleted_at
    ON preventive_automation_plans (deleted_at);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_plans_due
    ON preventive_automation_plans (active, next_run_at);
  `);
}

async function ensureIndexesBatch2() {
  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_plans_preventive_plan
    ON preventive_automation_plans (preventive_plan_id);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_preventive_automation_plans_preventive_plan_unique
    ON preventive_automation_plans (preventive_plan_id)
    WHERE preventive_plan_id IS NOT NULL;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_overrides_plan
    ON preventive_automation_overrides (plan_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_overrides_plan_target
    ON preventive_automation_overrides (plan_id, target_key);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_preventive_automation_overrides_target
    ON preventive_automation_overrides (plan_id, target_key);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_runs_plan
    ON preventive_automation_runs (plan_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_runs_plan_asset_created
    ON preventive_automation_runs (plan_id, asset_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_preventive_automation_runs_asset
    ON preventive_automation_runs (asset_id, scheduled_for DESC);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_preventive_automation_run_unique
    ON preventive_automation_runs (plan_id, asset_id, scheduled_for);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_device_segments_segment_id
    ON device_segments (segment_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_inventory_segments_group_id
    ON inventory_segments (group_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_manual_network_assets_ip
    ON manual_network_assets (ip);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_asset_history_asset_id
    ON asset_history (asset_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_inventory_visual_maps_updated
    ON inventory_visual_maps (updated_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_inventory_visual_maps_scope
    ON inventory_visual_maps (environment_id, group_id, segment_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_inventory_visual_map_objects_map
    ON inventory_visual_map_objects (map_id, layer, created_at);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_inventory_visual_map_objects_asset
    ON inventory_visual_map_objects (linked_asset_id);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_visual_map_objects_unique_asset
    ON inventory_visual_map_objects (map_id, linked_asset_id)
    WHERE linked_asset_id IS NOT NULL;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_inventory_visual_map_objects_preset
    ON inventory_visual_map_objects (map_id, preset_type);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_inventory_visual_map_connections_map
    ON inventory_visual_map_connections (map_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_inventory_visual_map_connections_layer
    ON inventory_visual_map_connections (layer);
  `);
}

async function ensureIndexesBatch3() {
  await query(`
    CREATE INDEX IF NOT EXISTS idx_inventory_visual_map_connections_type
    ON inventory_visual_map_connections (connection_type);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_inventory_visual_map_connections_source_asset
    ON inventory_visual_map_connections (source_asset_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_inventory_visual_map_connections_target_asset
    ON inventory_visual_map_connections (target_asset_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_floor_plans_updated
    ON floor_plans (updated_at DESC);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_floor_plans_inventory_tab_unique
    ON floor_plans (inventory_tab_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_floor_plan_floors_plan
    ON floor_plan_floors (plan_id, level);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_floor_plan_zones_plan_floor
    ON floor_plan_zones (plan_id, floor_id, zone_type);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_floor_plan_zones_inventory
    ON floor_plan_zones (group_id, segment_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_floor_plan_objects_plan_floor
    ON floor_plan_objects (plan_id, floor_id, category);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_floor_plan_objects_asset
    ON floor_plan_objects (linked_asset_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_floor_plan_points_plan_floor
    ON floor_plan_connection_points (plan_id, floor_id, point_type);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_floor_plan_routes_plan_floor
    ON floor_plan_cable_routes (plan_id, floor_id, route_type);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_orders_status
    ON service_orders (status, created_at DESC);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_service_orders_number_unique
    ON service_orders (number);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_order_statuses_order
    ON service_order_statuses (sort_order, created_at);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_orders_asset_id
    ON service_orders (asset_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_orders_sector_id
    ON service_orders (sector_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_orders_service_id
    ON service_orders (service_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_order_history_order_id
    ON service_order_history (service_order_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_order_items_order_id
    ON service_order_items (service_order_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_clients_trade_name
    ON clients (lower(trade_name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_products_name
    ON products (lower(name));
  `);
}

async function ensureIndexesBatch4() {
  await query(`
    CREATE INDEX IF NOT EXISTS idx_products_internal_code
    ON products (lower(internal_code));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_catalog_name
    ON service_catalog (lower(name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_service_catalog_code
    ON service_catalog (lower(code));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_technicians_name
    ON technicians (lower(name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_problem_types_name
    ON problem_types (lower(name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_priority_rules_type
    ON priority_rules (rule_type, active);
  `);
}

export async function ensureIndexesSchema() {
  await ensureIndexesBatch1();
  await ensureIndexesBatch2();
  await ensureIndexesBatch3();
  await ensureIndexesBatch4();
}
