import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../database.js";
import { createAgentToken, hashAgentToken } from "../domain/agentToken.js";
import { assetFromRow, enrollmentFromRow } from "./agents/agentMappers.js";

/**
 * SQL de enrollments (tokens do agente) e dos ativos reportados pelos agentes.
 * O registro de inventario/heartbeat (recordAgentInventory) vive em
 * services/agentInventoryService.js.
 */

export async function createAgentEnrollment({ name, createdBy = null }) {
  const token = createAgentToken();
  const result = await query(
    `
      INSERT INTO agent_enrollments (id, name, token_hash, token_prefix, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [randomUUID(), name, hashAgentToken(token), token.slice(0, 12), createdBy]
  );

  return { enrollment: enrollmentFromRow(result.rows[0]), token };
}

export async function listAgentEnrollments() {
  const result = await query(`
    SELECT *
    FROM agent_enrollments
    ORDER BY created_at DESC
  `);
  return result.rows.map(enrollmentFromRow);
}

export async function revokeAgentEnrollment(id) {
  const result = await query(
    `
      UPDATE agent_enrollments
      SET active = FALSE, revoked_at = NOW()
      WHERE id = $1 AND active = TRUE
      RETURNING *
    `,
    [id]
  );
  return result.rows[0] ? enrollmentFromRow(result.rows[0]) : null;
}

export async function authenticateAgentToken(token) {
  if (!token) return null;
  const result = await query(
    `
      SELECT *
      FROM agent_enrollments
      WHERE token_hash = $1 AND active = TRUE
      LIMIT 1
    `,
    [hashAgentToken(token)]
  );
  return result.rows[0] ? enrollmentFromRow(result.rows[0]) : null;
}

export async function listAgentAssets() {
  const result = await query("SELECT * FROM agent_assets ORDER BY hostname");
  return result.rows.map(assetFromRow);
}

export async function findAgentAssetById(assetId) {
  const result = await query("SELECT * FROM agent_assets WHERE asset_id = $1 LIMIT 1", [assetId]);
  return result.rows[0] ? assetFromRow(result.rows[0]) : null;
}

// Unico ponto que decide "este ativo tem um agente com enrollment
// ativo" - reaproveitado tanto pelo enfileiramento real de scripts
// (agentScriptJobRepository.js) quanto pelo diagnostico somente-leitura,
// para as duas nocoes de "agente ativo" nunca divergirem entre si.
export async function findActiveAgentEnrollmentForAsset(assetId, db = query) {
  const result = await db(
    `
      SELECT assets.asset_id, assets.enrollment_id
      FROM agent_assets assets
      INNER JOIN agent_enrollments enrollments ON enrollments.id = assets.enrollment_id
      WHERE assets.asset_id = $1
        AND enrollments.active = TRUE
      LIMIT 1
    `,
    [assetId]
  );
  return result.rows[0]
    ? { assetId: result.rows[0].asset_id, enrollmentId: result.rows[0].enrollment_id }
    : null;
}

export async function findAgentAssetByEnrollmentId(enrollmentId) {
  const result = await query(
    `
      SELECT * FROM agent_assets
      WHERE enrollment_id = $1
      ORDER BY last_seen_at DESC
      LIMIT 1
    `,
    [enrollmentId]
  );
  return result.rows[0] ? assetFromRow(result.rows[0]) : null;
}

export async function findAgentAssetByActivationId(activationId) {
  const result = await query(
    `
      SELECT assets.*
      FROM agent_assets assets
      INNER JOIN agent_enrollments enrollments ON enrollments.id = assets.enrollment_id
      WHERE enrollments.activation_id = $1
      ORDER BY assets.last_seen_at DESC NULLS LAST
      LIMIT 1
    `,
    [activationId]
  );
  return result.rows[0] ? assetFromRow(result.rows[0]) : null;
}

export async function updateAgentAssetAlias({ assetId, alias }) {
  return withTransaction(async (db) => {
    const result = await db(
      `
        UPDATE agent_assets
        SET machine_alias = $2, updated_at = NOW()
        WHERE asset_id = $1
        RETURNING *
      `,
      [assetId, alias || null]
    );
    if (!result.rows[0]) return null;

    const enrollment = await db(
      "SELECT activation_id FROM agent_enrollments WHERE id = $1 LIMIT 1",
      [result.rows[0].enrollment_id]
    );
    if (enrollment.rows[0]?.activation_id) {
      await db(
        "UPDATE device_activations SET alias = $2, updated_at = NOW() WHERE id = $1",
        [enrollment.rows[0].activation_id, alias || null]
      );
    }
    return assetFromRow(result.rows[0]);
  });
}

/**
 * Grava o id do dispositivo RustDesk relatado pelo agente. O id em si nao e
 * segredo (equivalente a um numero de telefone no protocolo RustDesk); a
 * senha de conexao nunca passa por aqui nem por nenhuma tabela -- fica
 * somente no relay efemero da sessao (remoteAssistanceRelay.js).
 */
export async function setAgentAssetRustdeskId({ assetId, rustdeskId }) {
  const result = await query(
    `
      UPDATE agent_assets
      SET rustdesk_id = $2, rustdesk_id_updated_at = NOW(), updated_at = NOW()
      WHERE asset_id = $1
      RETURNING *
    `,
    [assetId, String(rustdeskId || "").trim().slice(0, 32) || null]
  );
  return result.rows[0] ? assetFromRow(result.rows[0]) : null;
}
