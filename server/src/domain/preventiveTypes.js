// Tipos compartilhados do dominio de preventivas/automacao (somente JSDoc, sem codigo).
// Os modulos do dominio os consomem com a tag JSDoc @import apontando para este arquivo.
//
// Os formatos descrevem o que o dominio *le* dos objetos mapeados pelos repositorios
// (camelCase); campos nao usados pelas regras ficam no index signature.

/** @typedef {"daily" | "weekly" | "biweekly" | "monthly" | "custom_days"} RecurrenceType */

/** Entrada heterogenea de agenda: aceita camelCase do plano e snake_case de linhas do banco. */
/** @typedef {Record<string, unknown>} ScheduleSource */

/**
 * Agenda normalizada (recorrencia + horario + fuso).
 * @typedef {object} NormalizedSchedule
 * @property {string} recurrenceType
 * @property {number} recurrenceIntervalDays
 * @property {string} preferredTime `HH:MM`.
 * @property {string} timezone Nome IANA.
 */

/**
 * Recorrencia efetiva de uma maquina (maquina > segmento > plano).
 * @typedef {NormalizedSchedule & { source: "machine" | "segment" | "plan" }} EffectiveRecurrence
 */

/**
 * Recorrencia personalizada (override) por maquina ou segmento.
 * @typedef {object} PlanOverride
 * @property {string | null} [assetId]
 * @property {string | null} [segmentId]
 * @property {string | null} [targetKey]
 * @property {boolean} [active]
 * @property {string} [recurrenceType]
 * @property {number} [recurrenceInterval]
 * @property {number} [recurrenceIntervalDays]
 * @property {string | null} [preferredTime]
 */

/**
 * Plano de automacao preventiva como lido do banco.
 * @typedef {object} AutomationPlan
 * @property {string} id
 * @property {string} [name]
 * @property {boolean} [active]
 * @property {string} [preventivePlanId]
 * @property {string} [preventivePlanName]
 * @property {string} [description]
 * @property {string} [notes]
 * @property {string} [indicatorColor]
 * @property {string} [recurrenceType]
 * @property {number} [recurrenceInterval]
 * @property {number} [recurrenceIntervalDays]
 * @property {string} [preferredTime]
 * @property {string} [timezone]
 * @property {string} [scopeType]
 * @property {string | null} [scopeId]
 * @property {string[]} [assetIds]
 * @property {string[]} [excludedAssetIds]
 * @property {string[]} [defaultScriptIds]
 * @property {string} [scheduleAnchorAt]
 * @property {string} [createdAt]
 * @property {PlanOverride[]} [overrides]
 */

/**
 * Agenda de uma maquina dentro de um plano.
 * @typedef {object} AssetSchedule
 * @property {string} [id]
 * @property {string} [planId]
 * @property {string} assetId
 * @property {boolean} [active]
 * @property {string} [recurrenceSource]
 * @property {string} [recurrenceType]
 * @property {number} [recurrenceIntervalDays]
 * @property {string} [preferredTime]
 * @property {string} [timezone]
 * @property {string | null} [nextRunAt]
 * @property {string | null} [lastScheduledAt]
 * @property {string | null} [lastPreparedAt]
 * @property {string} [createdAt]
 */

/**
 * Ultima execucao (run) de um plano em uma maquina.
 * @typedef {object} LatestRun
 * @property {string} [status]
 * @property {boolean} [errorDetected]
 * @property {string} [createdAt]
 */

/**
 * Ativo (maquina) como o dominio de automacao precisa dele.
 * @typedef {object} AssetLike
 * @property {string} id
 * @property {string} [name]
 * @property {string} [assetType]
 * @property {string} [type]
 * @property {string} [ip]
 * @property {string} [status]
 * @property {string} [statusLabel]
 * @property {string} [segmentId]
 * @property {string} [segmentName]
 * @property {string} [segmentGroupId]
 * @property {{ os?: string, loggedUser?: string }} [hardware]
 */

export {};
