import { randomUUID } from "node:crypto";
import { query } from "../database.js";
import { conflict } from "../lib/errors.js";
import { buildOverrideTargetKey } from "../domain/preventiveAutomationNormalizers.js";
import { fromOverrideRow } from "./preventiveAutomationMappers.js";

/** SQL da tabela preventive_automation_overrides (recorrencia personalizada). */

function isDuplicateOverrideError(error) {
  return error?.code === "23505" || /idx_preventive_automation_overrides_target|preventive_automation_overrides.*unique/i.test(error?.message || "");
}

export async function listOverridesByPlan(planId, db = query) {
  const result = await db(
    `
      SELECT *
      FROM preventive_automation_overrides
      WHERE plan_id = $1
      ORDER BY created_at ASC
    `,
    [planId]
  );
  return result.rows.map(fromOverrideRow);
}

export async function listOverridesByPlanIds(planIds, db = query) {
  if (!planIds.length) return [];
  const placeholders = planIds.map((_, index) => `$${index + 1}`).join(", ");
  const result = await db(
    `SELECT * FROM preventive_automation_overrides WHERE plan_id IN (${placeholders}) ORDER BY created_at ASC`,
    planIds
  );
  return result.rows.map(fromOverrideRow);
}

export async function findLatestOverrideForAsset(planId, assetId, db = query) {
  const result = await db(
    `SELECT * FROM preventive_automation_overrides WHERE plan_id = $1 AND asset_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [planId, assetId]
  );
  return result.rows[0] ? fromOverrideRow(result.rows[0]) : null;
}

export async function deleteOverridesOfPlan(db, planId) {
  await db("DELETE FROM preventive_automation_overrides WHERE plan_id = $1", [planId]);
}

export async function deleteOverrideByTarget(db, planId, targetKey) {
  await db(
    `DELETE FROM preventive_automation_overrides WHERE plan_id = $1 AND target_key = $2`,
    [planId, targetKey]
  );
}

/** Insere o override; violacao da chave unica (plano + alvo) vira 409. */
export async function insertOverride(db, planId, override) {
  try {
    await db(
      `
        INSERT INTO preventive_automation_overrides (
          id, plan_id, asset_id, segment_id, target_key, recurrence_type,
          recurrence_interval, preferred_time, active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        randomUUID(),
        planId,
        override.assetId,
        override.segmentId,
        override.targetKey || buildOverrideTargetKey(override),
        override.recurrenceType,
        override.recurrenceInterval,
        override.preferredTime,
        override.active
      ]
    );
  } catch (error) {
    if (isDuplicateOverrideError(error)) {
      throw conflict("Este alvo já possui recorrência personalizada neste plano.");
    }
    throw error;
  }
}
