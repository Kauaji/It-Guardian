import { randomUUID } from "node:crypto";
import { query } from "../database.js";

export const DEFAULT_INVENTORY_TAB_ID = "tab-default";
export const DEFAULT_INVENTORY_TAB_NAME = "Novo ambiente";
export const DEFAULT_INVENTORY_TAB_COLOR = "#2563eb";

function normalizeColor(color) { return /^#[0-9a-f]{6}$/i.test(color || "") ? color : DEFAULT_INVENTORY_TAB_COLOR;
}

function normalizeName(name) {
  return String(name || "").trim();
}

function normalizeSortOrder(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function seedDefaultInventoryTab() {
  await query(
    `
      INSERT INTO inventory_tabs (id, name, color, sort_order, active, is_default)
      VALUES ($1, $2, $3, 0, TRUE, TRUE)
      ON CONFLICT (id) DO UPDATE
      SET name = inventory_tabs.name,
          color = inventory_tabs.color,
          active = TRUE,
          is_default = TRUE,
          updated_at = NOW()
    `,
    [DEFAULT_INVENTORY_TAB_ID, DEFAULT_INVENTORY_TAB_NAME, DEFAULT_INVENTORY_TAB_COLOR]
  );

  await query(
    `
      UPDATE inventory_tabs
      SET is_default = FALSE,
          updated_at = NOW()
      WHERE id <> $1
        AND is_default = TRUE
    `,
    [DEFAULT_INVENTORY_TAB_ID]
  );

  await query(
    `
      UPDATE segment_groups
      SET tab_id = $1,
          updated_at = NOW()
      WHERE tab_id IS NULL
    `,
    [DEFAULT_INVENTORY_TAB_ID]
  );

  await query(
    `
      UPDATE inventory_segments
      SET tab_id = $1,
          updated_at = NOW()
      WHERE tab_id IS NULL
        AND is_default = FALSE
    `,
    [DEFAULT_INVENTORY_TAB_ID]
  );
}

export async function listInventoryTabs({ includeInactive = false } = {}) {
  const result = await query(
    `
      SELECT id, name, color, sort_order, active, is_default, created_at, updated_at
      FROM inventory_tabs
      WHERE ($1::boolean = TRUE OR active = TRUE)
      ORDER BY sort_order ASC, created_at ASC
    `,
    [Boolean(includeInactive)]
  );

  return result.rows.map(fromRow);
}

export async function findInventoryTabById(id) {
  const result = await query(
    `
      SELECT id, name, color, sort_order, active, is_default, created_at, updated_at
      FROM inventory_tabs
      WHERE id = $1
    `,
    [id]
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function createInventoryTab({ id, name, color, sortOrder, userId }) {
  const cleanName = normalizeName(name);

  if (cleanName.length < 2) {
    const error = new Error("O nome da aba deve ter pelo menos 2 caracteres.");
    error.statusCode = 400;
    throw error;
  }

  await assertTabNameAvailable(cleanName);

  const result = await query(
    `
      INSERT INTO inventory_tabs (id, name, color, sort_order, active, created_by)
      VALUES ($1, $2, $3, $4, TRUE, $5)
      RETURNING id, name, color, sort_order, active, is_default, created_at, updated_at
    `,
    [id ? String(id) : randomUUID(),
      cleanName,
      normalizeColor(color),
      normalizeSortOrder(sortOrder, await nextSortOrder()),
      userId
    ]
  );

  return fromRow(result.rows[0]);
}

export async function updateInventoryTab({ id, name, color, sortOrder, active, isDefault }) {
  const existing = await findInventoryTabById(id);

  if (!existing) {
    const error = new Error("Aba não encontrada.");
    error.statusCode = 404;
    throw error;
  }
  const cleanName = name === undefined ? existing.name : normalizeName(name);
  if (cleanName.length < 2) {
    const error = new Error("O nome da aba deve ter pelo menos 2 caracteres.");
    error.statusCode = 400;
    throw error;
  }

  await assertTabNameAvailable(cleanName, id);
  const nextActive = active === undefined ? existing.active : Boolean(active);
  if (!nextActive) {
    await assertCanDeactivateTab(id);
  }

  if (isDefault === true) {
    await query(
      `
        UPDATE inventory_tabs
        SET is_default = FALSE,
            updated_at = NOW()
        WHERE id <> $1
      `,
      [id]
    );
  }

  const result = await query(
    `
      UPDATE inventory_tabs
      SET name = $2,
          color = $3,
          sort_order = $4,
          active = $5,
          is_default = $6,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, color, sort_order, active, is_default, created_at, updated_at
    `,
    [
      id,
      cleanName,
      normalizeColor(color || existing.color),
      sortOrder === undefined ? existing.order : normalizeSortOrder(sortOrder, existing.order),
      nextActive,
      isDefault === undefined ? existing.isDefault : Boolean(isDefault)
    ]
  );

  return fromRow(result.rows[0]);
}

export async function deleteInventoryTab(id) {
  const existing = await findInventoryTabById(id);

  if (!existing) {
    const error = new Error("Aba não encontrada.");
    error.statusCode = 404;
    throw error;
  }

  if (existing.isDefault) {
    const error = new Error("A aba padrão não pode ser excluída.");
    error.statusCode = 400;
    throw error;
  }

  await assertCanDeactivateTab(id);
  await assertTabHasNoInventory(id);

  await query("DELETE FROM inventory_tabs WHERE id = $1", [id]);
  await compactSortOrder();

  return existing;
}

export async function reorderInventoryTabs(tabIds) {
  const ids = Array.isArray(tabIds) ? tabIds.map((id) => String(id || "").trim()).filter(Boolean) : [];

  if (!ids.length) {
    const error = new Error("Informe a ordem das abas.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await listInventoryTabs();
  const existingIds = new Set(existing.map((tab) => tab.id));
  const unknown = ids.find((id) => !existingIds.has(id));

  if (unknown) {
    const error = new Error("A ordem contem uma aba inexistente.");
    error.statusCode = 400;
    throw error;
  }

  await Promise.all(
    ids.map((id, index) =>
      query(
        `
          UPDATE inventory_tabs
          SET sort_order = $2,
              updated_at = NOW()
          WHERE id = $1
        `,
        [id, index]
      )
    )
  );

  return listInventoryTabs();
}

async function nextSortOrder() {
  const result = await query("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM inventory_tabs");
  return Number(result.rows[0].next_order || 0);
}

async function compactSortOrder() { const tabs = await listInventoryTabs({ includeInactive: true });
  await Promise.all(
    tabs.map((tab, index) =>
      query(
        `
          UPDATE inventory_tabs
          SET sort_order = $2
          WHERE id = $1
        `,
        [tab.id, index]
      )
    )
  );
}

async function assertTabNameAvailable(name, ignoreId = null) {
  const result = await query(
    `
      SELECT id
      FROM inventory_tabs
      WHERE active = TRUE
        AND lower(name) = lower($1)
        AND ($2::text IS NULL OR id <> $2)
      LIMIT 1
    `,
    [name, ignoreId]
  );

  if (result.rows.length) {
    const error = new Error("Já existe uma aba com esse nome.");
    error.statusCode = 409;
    throw error;
  }
}

async function assertCanDeactivateTab(id) {
  const result = await query(
    `
      SELECT COUNT(*)::int AS active_count
      FROM inventory_tabs
      WHERE active = TRUE
        AND id <> $1
    `,
    [id]
  );

  if (Number(result.rows[0].active_count || 0) < 1) {
    const error = new Error("Mantenha pelo menos uma aba ativa no inventário.");
    error.statusCode = 400;
    throw error;
  }
}

async function assertTabHasNoInventory(id) {
  const result = await query(
    `
      SELECT
        (SELECT COUNT(*)::int FROM segment_groups WHERE tab_id = $1) AS group_count,
        (SELECT COUNT(*)::int FROM inventory_segments WHERE tab_id = $1) AS segment_count,
        (
          SELECT COUNT(*)::int
          FROM device_segments
          INNER JOIN inventory_segments ON inventory_segments.id = device_segments.segment_id
          WHERE inventory_segments.tab_id = $1
        ) AS machine_count
    `,
    [id]
  );

  const usage = result.rows[0] || {};
  const groupCount = Number(usage.group_count || 0);
  const segmentCount = Number(usage.segment_count || 0);
  const machineCount = Number(usage.machine_count || 0);

  if (groupCount || segmentCount || machineCount) {
    const error = new Error("Não é possível excluir uma aba com grupos, segmentos ou máquinas.");
    error.statusCode = 409;
    throw error;
  }
}

function fromRow(row) {
  return { id: row.id, name: row.name, color: row.color || DEFAULT_INVENTORY_TAB_COLOR, order: Number(row.sort_order || 0), active: row.active !== false, isDefault: Boolean(row.is_default), createdAt: row.created_at, updatedAt: row.updated_at
  };
}
