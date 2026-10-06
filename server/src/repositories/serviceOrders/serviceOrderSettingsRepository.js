import { query } from "../../database.js";
import {
  defaultPriorityColors,
  defaultServiceOrderSettings,
  defaultSlaSettings,
  isDefaultSettings,
  mergeServiceOrderSettingsUpdate,
  normalizeServiceOrderSettings
} from "../../domain/serviceOrders/serviceOrderSettings.js";
import { parseJsonObject } from "../../domain/serviceOrders/serviceOrderText.js";

const serviceOrderSettingsKey = "service_orders";

const serviceOrderSettingsRowId = "default";

function settingsFromDedicatedRow(row, statuses = []) {
  if (!row) return null;

  return normalizeServiceOrderSettings({
    numberFormat: {
      prefix: row.number_prefix,
      useYear: row.use_year,
      useMonth: row.use_month,
      nextNumber: row.next_number
    },
    autoPriority: {
      enabled: row.auto_priority_enabled,
      lowToMediumHours: row.low_to_medium_hours,
      mediumToHighHours: row.medium_to_high_hours,
      highToCriticalHours: row.high_to_critical_hours
    },
    statuses,
    priorityColors: parseJsonObject(row.priority_colors, defaultPriorityColors),
    boardLayout: row.board_layout,
    sla: parseJsonObject(row.sla, defaultSlaSettings),
    requireChecklistBeforeFinish: row.require_checklist_before_finish
  });
}

async function readDedicatedServiceOrderSettings() {
  const settingsResult = await query("SELECT * FROM service_order_settings WHERE id = $1", [serviceOrderSettingsRowId]);
  const statusesResult = await query(
    `
      SELECT id, name, color, sort_order, is_initial, is_final
      FROM service_order_statuses
      WHERE active = TRUE
      ORDER BY sort_order ASC, created_at ASC
    `
  );

  const statuses = statusesResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    order: row.sort_order,
    isInitial: row.is_initial,
    isFinal: row.is_final
  }));

  return settingsFromDedicatedRow(settingsResult.rows[0], statuses);
}

async function readLegacyServiceOrderSettings() {
  const result = await query("SELECT value FROM app_settings WHERE key = $1", [serviceOrderSettingsKey]);
  return result.rows[0]?.value ? normalizeServiceOrderSettings(result.rows[0].value) : null;
}

async function persistServiceOrderSettings(settings) {
  const normalized = normalizeServiceOrderSettings(settings);

  await query(
    `
      INSERT INTO service_order_settings (
        id, number_prefix, use_year, use_month, next_number,
        auto_priority_enabled, low_to_medium_hours, medium_to_high_hours,
        high_to_critical_hours, priority_colors, board_layout,
        sla, require_checklist_before_finish, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        number_prefix = EXCLUDED.number_prefix,
        use_year = EXCLUDED.use_year,
        use_month = EXCLUDED.use_month,
        next_number = EXCLUDED.next_number,
        auto_priority_enabled = EXCLUDED.auto_priority_enabled,
        low_to_medium_hours = EXCLUDED.low_to_medium_hours,
        medium_to_high_hours = EXCLUDED.medium_to_high_hours,
        high_to_critical_hours = EXCLUDED.high_to_critical_hours,
        priority_colors = EXCLUDED.priority_colors,
        board_layout = EXCLUDED.board_layout,
        sla = EXCLUDED.sla,
        require_checklist_before_finish = EXCLUDED.require_checklist_before_finish,
        updated_at = NOW()
    `,
    [
      serviceOrderSettingsRowId,
      normalized.numberFormat.prefix,
      normalized.numberFormat.useYear,
      normalized.numberFormat.useMonth,
      normalized.numberFormat.nextNumber,
      normalized.autoPriority.enabled,
      normalized.autoPriority.lowToMediumHours,
      normalized.autoPriority.mediumToHighHours,
      normalized.autoPriority.highToCriticalHours,
      JSON.stringify(normalized.priorityColors),
      normalized.boardLayout,
      JSON.stringify(normalized.sla),
      normalized.requireChecklistBeforeFinish
    ]
  );

  const statusIds = normalized.statuses.map((status) => status.id);
  const placeholders = statusIds.map((_, index) => `$${index + 1}`).join(", ");
  await query(`DELETE FROM service_order_statuses WHERE id NOT IN (${placeholders})`, statusIds);

  for (const status of normalized.statuses) {
    await query(
      `
        INSERT INTO service_order_statuses (
          id, name, color, sort_order, is_initial, is_final, active, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          name = EXCLUDED.name,
          color = EXCLUDED.color,
          sort_order = EXCLUDED.sort_order,
          is_initial = EXCLUDED.is_initial,
          is_final = EXCLUDED.is_final,
          active = TRUE,
          updated_at = NOW()
      `,
      [status.id, status.name, status.color, status.order, status.isInitial, status.isFinal]
    );
  }

  await query(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [serviceOrderSettingsKey, JSON.stringify(normalized)]
  );

  return normalized;
}

async function assertRemovedStatusesAreUnused(currentStatuses = [], nextStatuses = []) {
  const nextIds = new Set(nextStatuses.map((status) => status.id));
  const removedIds = currentStatuses.map((status) => status.id).filter((id) => !nextIds.has(id));

  if (!removedIds.length) return;

  const placeholders = removedIds.map((_, index) => `$${index + 1}`).join(", ");
  const result = await query(
    `SELECT status, COUNT(*)::int AS total FROM service_orders WHERE status IN (${placeholders}) GROUP BY status`,
    removedIds
  );

  if (result.rows.length) {
    const error = new Error("Mova as OS dos status removidos antes de salvar as configuracoes.");
    error.statusCode = 400;
    throw error;
  }
}

export async function getServiceOrderSettings() {
  const dedicated = await readDedicatedServiceOrderSettings();
  const legacy = await readLegacyServiceOrderSettings();

  if (legacy && (!dedicated || (isDefaultSettings(dedicated) && !isDefaultSettings(legacy)))) {
    return persistServiceOrderSettings(legacy);
  }

  if (dedicated) return dedicated;

  return persistServiceOrderSettings(legacy || defaultServiceOrderSettings);
}

export async function updateServiceOrderSettings(payload = {}) {
  const current = await getServiceOrderSettings();
  const normalized = mergeServiceOrderSettingsUpdate(current, payload);

  if (Array.isArray(payload.statuses)) {
    await assertRemovedStatusesAreUnused(current.statuses, normalized.statuses);
  }

  return persistServiceOrderSettings(normalized);
}
