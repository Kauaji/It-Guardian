import { query } from "../../database.js";

export async function queryIgnoringDuplicateConstraint(text, params = []) {
  try {
    return await query(text, params);
  } catch (error) {
    if (error.code === "42710" || /already exists/i.test(error.message || "")) {
      return null;
    }

    throw error;
  }
}

export async function removeDuplicatePreventiveAutomationOverrides() {
  const result = await query(`
    SELECT id, plan_id, target_key, created_at, updated_at
    FROM preventive_automation_overrides
    WHERE target_key IS NOT NULL
    ORDER BY plan_id ASC, target_key ASC, updated_at DESC, created_at DESC, id DESC
  `);
  const seen = new Set();
  const duplicateIds = [];

  for (const row of result.rows) {
    const key = `${row.plan_id}:${row.target_key}`;
    if (seen.has(key)) {
      duplicateIds.push(row.id);
    } else {
      seen.add(key);
    }
  }

  for (const id of duplicateIds) {
    await query("DELETE FROM preventive_automation_overrides WHERE id = $1", [id]);
  }
}
