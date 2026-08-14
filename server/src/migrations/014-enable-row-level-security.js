import { resolveDatabaseConfig } from "../config/environment.js";

/**
 * Liga Row Level Security em todas as tabelas do IT Guardian, sem nenhuma
 * politica. O backend se conecta ao Supabase/Postgres com um papel que tem
 * o atributo BYPASSRLS (confirmado: o papel "postgres" do Supabase sempre
 * tem esse atributo) -- RLS nunca filtra as proprias queries deste app,
 * entao ligar aqui nao muda nenhum comportamento observavel do IT Guardian.
 *
 * O que isso fecha de verdade: o Supabase expoe automaticamente toda tabela
 * do schema public via uma API REST propria (PostgREST) para os papeis
 * "anon"/"authenticated" -- o IT Guardian nunca pretendeu usar essa API (o
 * navegador so fala com o backend Express, nunca direto com o Supabase),
 * mas ela fica exposta por padrao mesmo assim. Sem RLS, qualquer pessoa com
 * a chave publica "anon" do projeto consegue ler ou escrever qualquer linha
 * de qualquer tabela por esse caminho, sem passar pela autenticacao do
 * proprio IT Guardian. RLS ligado e sem nenhuma politica bloqueia esse
 * acesso por padrao para "anon"/"authenticated", que e exatamente o
 * comportamento desejado aqui.
 *
 * Este projeto Supabase tambem hospeda tabelas de outro aplicativo
 * (prefixo "study_") sem nenhuma relacao com o IT Guardian -- essas ficam
 * de fora deliberadamente, porque nao ha visibilidade de como esse outro
 * app se conecta (se usa Auth/anon key do Supabase direto, ligar RLS sem
 * suas proprias politicas quebraria esse app).
 *
 * pg-mem (o backend "memory" usado no resto da suite de testes) nao
 * implementa a sintaxe ENABLE ROW LEVEL SECURITY -- esta migration so roda
 * de fato contra Postgres real.
 */
const tables = [
  "users",
  "audit_logs",
  "alert_acknowledgements",
  "inventory_segments",
  "segment_groups",
  "device_segments",
  "manual_network_assets",
  "device_metadata",
  "asset_history",
  "sectors",
  "service_orders",
  "app_settings",
  "service_order_history",
  "service_order_items",
  "clients",
  "products",
  "service_catalog",
  "technicians",
  "problem_types",
  "priority_rules",
  "service_order_settings",
  "service_order_statuses",
  "alert_rules",
  "alerts",
  "alert_comments",
  "service_order_suggestions",
  "maintenance_scripts",
  "script_execution_logs",
  "script_validation_runs",
  "preventive_plans",
  "preventive_plan_scripts",
  "preventive_plan_assets",
  "preventive_automation_plans",
  "preventive_automation_overrides",
  "preventive_automation_runs",
  "preventive_automation_asset_schedules",
  "schema_migrations",
  "user_preferences",
  "inventory_visual_maps",
  "inventory_visual_map_objects",
  "inventory_visual_map_connections",
  "floor_plans",
  "floor_plan_floors",
  "floor_plan_zones",
  "floor_plan_objects",
  "floor_plan_connection_points",
  "floor_plan_cable_routes",
  "agent_enrollments",
  "agent_assets",
  "agent_heartbeats",
  "integration_sync_state",
  "integration_assets",
  "integration_alerts",
  "integration_conflicts",
  "product_keys",
  "device_activations",
  "agent_script_jobs",
  "maintenance_records",
  "backup_assignments",
  "security_reauthentications",
  "security_reauthentication_attempts",
  "remote_assistance_sessions",
  "remote_assistance_events"
];

export const migration014EnableRowLevelSecurity = {
  id: "014-enable-row-level-security",
  async up(db) {
    if (resolveDatabaseConfig().mode !== "postgres") return;

    for (const table of tables) {
      await db(`ALTER TABLE IF EXISTS ${table} ENABLE ROW LEVEL SECURITY;`);
    }
  }
};
