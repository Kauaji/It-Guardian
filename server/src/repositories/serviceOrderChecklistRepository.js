import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";

function makeHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

function fromTemplateRow(row) {
  return {
    id: row.id,
    name: row.name,
    problemTypeKey: row.problem_type_key,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fromTemplateItemRow(row) {
  return {
    id: row.id,
    templateId: row.template_id,
    label: row.label,
    description: row.description,
    required: row.required,
    orderIndex: row.order_index,
    active: row.active
  };
}

function fromResultRow(row) {
  return {
    id: row.id,
    serviceOrderId: row.service_order_id,
    templateItemId: row.template_item_id,
    label: row.label,
    description: row.description,
    required: row.required,
    orderIndex: row.order_index,
    checked: row.checked,
    notes: row.notes,
    checkedBy: row.checked_by,
    checkedAt: row.checked_at,
    createdAt: row.created_at
  };
}

async function listTemplateItems(templateId, db = query) {
  const result = await db(
    "SELECT * FROM service_order_checklist_template_items WHERE template_id = $1 ORDER BY order_index ASC",
    [templateId]
  );
  return result.rows.map(fromTemplateItemRow);
}

export async function listChecklistTemplates({ activeOnly = false } = {}) {
  const result = await query(
    activeOnly
      ? "SELECT * FROM service_order_checklist_templates WHERE active = TRUE ORDER BY name ASC"
      : "SELECT * FROM service_order_checklist_templates ORDER BY name ASC"
  );
  const templates = result.rows.map(fromTemplateRow);
  return Promise.all(
    templates.map(async (template) => ({ ...template, items: await listTemplateItems(template.id) }))
  );
}

export async function findChecklistTemplateById(id) {
  const result = await query("SELECT * FROM service_order_checklist_templates WHERE id = $1", [id]);
  if (!result.rows[0]) return null;
  const template = fromTemplateRow(result.rows[0]);
  return { ...template, items: await listTemplateItems(id) };
}

// Primeiro template ativo cuja problem_type_key bate com a chave ja
// resolvida (ver resolveProblemTypeKey em publicServiceOrderService.js) -
// se dois templates disputarem a mesma chave, o mais recente vence.
export async function findActiveChecklistTemplateByProblemTypeKey(problemTypeKey) {
  if (!problemTypeKey) return null;
  const result = await query(
    `
      SELECT * FROM service_order_checklist_templates
      WHERE active = TRUE AND problem_type_key = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [problemTypeKey]
  );
  if (!result.rows[0]) return null;
  const template = fromTemplateRow(result.rows[0]);
  return { ...template, items: await listTemplateItems(template.id) };
}

function normalizeTemplateItemsPayload(items = []) {
  return items
    .map((item, index) => ({
      id: item.id || null,
      label: String(item.label || "").trim(),
      description: item.description ? String(item.description).trim() : null,
      required: Boolean(item.required),
      orderIndex: Number.isFinite(Number(item.orderIndex)) ? Number(item.orderIndex) : index,
      active: item.active !== false
    }))
    .filter((item) => item.label.length > 0);
}

export async function createChecklistTemplate({ name, problemTypeKey, active = true, items = [] }) {
  const normalizedName = String(name || "").trim();
  if (normalizedName.length < 2) {
    throw makeHttpError("Informe um nome para o template de checklist.");
  }
  const normalizedItems = normalizeTemplateItemsPayload(items);
  if (!normalizedItems.length) {
    throw makeHttpError("Adicione ao menos um item ao checklist.");
  }

  return withTransaction(async (db) => {
    const id = randomUUID();
    await db(
      `
        INSERT INTO service_order_checklist_templates (id, name, problem_type_key, active)
        VALUES ($1, $2, $3, $4)
      `,
      [id, normalizedName, problemTypeKey || null, Boolean(active)]
    );

    for (const item of normalizedItems) {
      await db(
        `
          INSERT INTO service_order_checklist_template_items (
            id, template_id, label, description, required, order_index, active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [randomUUID(), id, item.label, item.description, item.required, item.orderIndex, item.active]
      );
    }

    const templateResult = await db("SELECT * FROM service_order_checklist_templates WHERE id = $1", [id]);
    const itemsResult = await db(
      "SELECT * FROM service_order_checklist_template_items WHERE template_id = $1 ORDER BY order_index ASC",
      [id]
    );
    return { ...fromTemplateRow(templateResult.rows[0]), items: itemsResult.rows.map(fromTemplateItemRow) };
  });
}

export async function updateChecklistTemplate(id, { name, problemTypeKey, active, items }) {
  return withTransaction(async (db) => {
    const existingResult = await db("SELECT * FROM service_order_checklist_templates WHERE id = $1", [id]);
    if (!existingResult.rows[0]) return null;
    const existing = fromTemplateRow(existingResult.rows[0]);

    const normalizedName = name !== undefined ? String(name || "").trim() || existing.name : existing.name;
    const normalizedProblemTypeKey = problemTypeKey !== undefined ? (problemTypeKey || null) : existing.problemTypeKey;
    const normalizedActive = active !== undefined ? Boolean(active) : existing.active;

    await db(
      `
        UPDATE service_order_checklist_templates
        SET name = $2, problem_type_key = $3, active = $4, updated_at = NOW()
        WHERE id = $1
      `,
      [id, normalizedName, normalizedProblemTypeKey, normalizedActive]
    );

    if (items !== undefined) {
      const normalizedItems = normalizeTemplateItemsPayload(items);
      if (!normalizedItems.length) {
        throw makeHttpError("Adicione ao menos um item ao checklist.");
      }
      await db("DELETE FROM service_order_checklist_template_items WHERE template_id = $1", [id]);
      for (const item of normalizedItems) {
        await db(
          `
            INSERT INTO service_order_checklist_template_items (
              id, template_id, label, description, required, order_index, active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [randomUUID(), id, item.label, item.description, item.required, item.orderIndex, item.active]
        );
      }
    }

    const templateResult = await db("SELECT * FROM service_order_checklist_templates WHERE id = $1", [id]);
    const itemsResult = await db(
      "SELECT * FROM service_order_checklist_template_items WHERE template_id = $1 ORDER BY order_index ASC",
      [id]
    );
    return { ...fromTemplateRow(templateResult.rows[0]), items: itemsResult.rows.map(fromTemplateItemRow) };
  });
}

export async function deleteChecklistTemplate(id) {
  const result = await query("DELETE FROM service_order_checklist_templates WHERE id = $1 RETURNING id", [id]);
  return Boolean(result.rows[0]);
}

export async function listChecklistResults(serviceOrderId) {
  const result = await query(
    "SELECT * FROM service_order_checklist_results WHERE service_order_id = $1 ORDER BY order_index ASC",
    [serviceOrderId]
  );
  return result.rows.map(fromResultRow);
}

// Copia os itens do template pra service_order_checklist_results no
// momento da criacao da OS - snapshot independente do template (editar ou
// remover o template depois nao afeta OS ja criadas).
export async function applyChecklistTemplateToOrder(serviceOrderId, template, db = query) {
  if (!template?.items?.length) return [];
  const created = [];
  for (const item of template.items.filter((entry) => entry.active !== false)) {
    const id = randomUUID();
    const result = await db(
      `
        INSERT INTO service_order_checklist_results (
          id, service_order_id, template_item_id, label, description, required, order_index
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [id, serviceOrderId, item.id, item.label, item.description, item.required, item.orderIndex]
    );
    created.push(fromResultRow(result.rows[0]));
  }
  return created;
}

export async function updateChecklistResultItem(serviceOrderId, resultId, { checked, notes, user }) {
  const result = await query(
    `
      UPDATE service_order_checklist_results
      SET checked = $3,
          notes = $4,
          checked_by = CASE WHEN $3 THEN $5 ELSE NULL END,
          checked_at = CASE WHEN $3 THEN NOW() ELSE NULL END
      WHERE id = $1 AND service_order_id = $2
      RETURNING *
    `,
    [resultId, serviceOrderId, Boolean(checked), notes ?? null, user?.id || null]
  );
  return result.rows[0] ? fromResultRow(result.rows[0]) : null;
}

export async function hasIncompleteRequiredChecklistItems(serviceOrderId) {
  const result = await query(
    `
      SELECT COUNT(*)::int AS total
      FROM service_order_checklist_results
      WHERE service_order_id = $1 AND required = TRUE AND checked = FALSE
    `,
    [serviceOrderId]
  );
  return Number(result.rows[0]?.total || 0) > 0;
}
