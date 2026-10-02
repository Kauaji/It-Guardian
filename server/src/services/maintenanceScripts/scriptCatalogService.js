import { randomUUID } from "node:crypto";
import { analyzeMaintenanceScriptContent } from "../../domain/maintenanceScripts/contentAnalysis.js";
import { defaultMaintenanceScripts } from "../../domain/maintenanceScripts/defaultScripts.js";
import { normalizeScriptPayload } from "../../domain/maintenanceScripts/scriptPayload.js";
import {
  deactivateMaintenanceScript,
  findMaintenanceScriptById,
  insertDefaultMaintenanceScript,
  insertMaintenanceScript,
  listMaintenanceScripts,
  maintenanceScriptExists,
  updateDefaultMaintenanceScript,
  updateMaintenanceScriptById
} from "../../repositories/maintenanceScripts/scriptCatalogRepository.js";

/**
 * Regras do catalogo de scripts de manutencao: todo cadastro/edicao passa por
 * normalizeScriptPayload (bloqueio de conteudo perigoso, variaveis permitidas,
 * limites) antes de qualquer gravacao. O SQL fica em
 * repositories/maintenanceScripts/scriptCatalogRepository.js.
 */

export { deactivateMaintenanceScript, findMaintenanceScriptById, listMaintenanceScripts };

export async function createMaintenanceScript(payload = {}, user = null) {
  const script = normalizeScriptPayload(payload);
  return insertMaintenanceScript({
    id: randomUUID(),
    script,
    createdBy: user?.id || null,
    contentUpdatedBy: user?.id || null
  });
}

/** Atualiza o script mesclando o payload sobre o cadastro atual; devolve null se o id nao existe. */
export async function updateMaintenanceScript(id, payload = {}, user = null) {
  const current = await findMaintenanceScriptById(id);
  if (!current) return null;
  const script = normalizeScriptPayload(payload, current);

  return updateMaintenanceScriptById({
    id,
    script,
    contentUpdatedBy: user?.id || current.contentUpdatedBy || null
  });
}

/** Semeia (ou restaura) os scripts padrao do catalogo de demonstracao, de forma idempotente. */
export async function seedDefaultMaintenanceScripts() {
  for (const defaultScript of defaultMaintenanceScripts) {
    const analysis = analyzeMaintenanceScriptContent(defaultScript.content);
    const script = normalizeScriptPayload({
      ...defaultScript,
      estimatedSummary: analysis.estimatedSummary,
      suggestedRiskLevel: analysis.suggestedRiskLevel,
      requiresConfirmation: true,
      active: true
    });

    if (await maintenanceScriptExists(defaultScript.id)) {
      await updateDefaultMaintenanceScript(defaultScript.id, script);
    } else {
      await insertDefaultMaintenanceScript(defaultScript.id, script);
    }
  }
}
