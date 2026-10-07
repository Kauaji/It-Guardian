import { query } from "../../database.js";
import { listSettingsRecords } from "../settingsRepository.js";

export async function findActiveSectorById(id) {
  const result = await query("SELECT id, name FROM sectors WHERE id = $1 AND active = TRUE LIMIT 1", [id]);
  return result.rows[0] || null;
}

export async function findActiveSectorByName(name) {
  const result = await query("SELECT id, name FROM sectors WHERE LOWER(name) = LOWER($1) AND active = TRUE LIMIT 1", [name]);
  return result.rows[0] || null;
}

/** Busca um servico ativo do catalogo por id, codigo ou nome (qualquer um que case). */
export async function findActiveCatalogService({ id, code, name }) {
  const clauses = [];
  const values = [];
  if (id) {
    values.push(id);
    clauses.push(`id = $${values.length}`);
  }
  if (code) {
    values.push(code);
    clauses.push(`LOWER(code) = LOWER($${values.length})`);
  }
  if (name) {
    values.push(name);
    clauses.push(`LOWER(name) = LOWER($${values.length})`);
  }

  const result = await query(
    `
      SELECT id, code, name, default_priority, default_value
      FROM service_catalog
      WHERE active = TRUE
        AND (${clauses.join(" OR ")})
      LIMIT 1
    `,
    values
  );
  return result.rows[0] || null;
}

export async function listPriorityRules() {
  return listSettingsRecords("priorityRules");
}
