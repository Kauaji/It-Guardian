// Tipos compartilhados do dominio de avisos/alertas (somente JSDoc, sem codigo).
// Os modulos desta pasta os consomem com a tag JSDoc @import apontando para este arquivo.
//
// Os formatos descrevem o que o dominio *le* dos objetos que os repositorios mapeiam
// (camelCase) ou das linhas cruas do banco (snake_case, `AlertRuleRow`).

/** @typedef {"low" | "medium" | "high" | "critical"} AlertPriority */

/**
 * Parte de um aviso (ou sugestao) que decide o tipo: o dominio aceita `type`,
 * `alertType` (sugestoes) ou `suggestedProblemTypeId`.
 * @typedef {object} AlertLike
 * @property {string} [type]
 * @property {string} [alertType]
 * @property {string} [suggestedProblemTypeId]
 * @property {string} [title]
 * @property {string} [severity]
 * @property {number | string | null} [occurrencesCount]
 */

/**
 * Aviso de monitoramento como lido do banco ou gerado a partir do agente.
 * @typedef {AlertLike & {
 *   id?: string,
 *   assetId?: string | null,
 *   hostId?: string | null,
 *   hostName?: string | null,
 *   metric?: string | null,
 *   description?: string,
 *   value?: number | string | null,
 *   threshold?: number | string | null,
 *   status?: string,
 *   firstSeenAt?: string | Date | null,
 *   lastSeenAt?: string | Date | null,
 *   updatedAt?: string | Date | null,
 *   source?: string
 * }} Alert
 */

/**
 * Ativo com agente como o dominio le a ultima coleta (campos do mapeador de ativos).
 * @typedef {object} AgentAlertAsset
 * @property {string} id
 * @property {string | null} [machineAlias]
 * @property {string | null} [hostname]
 * @property {string | Date | null} [lastSeenAt]
 * @property {string | Date | null} [collectedAt]
 * @property {number | string | null} [intervalSeconds]
 * @property {number | null} [cpuUsagePercent]
 * @property {number | string | null} [memoryUsedBytes]
 * @property {number | string | null} [memoryTotalBytes]
 * @property {number | string | null} [diskTotalBytes]
 * @property {number | string | null} [diskFreeBytes]
 */

/**
 * Regra de aviso padrao (camelCase) usada para semear `alert_rules`.
 * @typedef {object} AlertRuleDefinition
 * @property {string} id
 * @property {string} type
 * @property {string} metric
 * @property {number} threshold
 * @property {number} durationMinutes
 * @property {number} recurrenceCount
 * @property {string} recurrenceWindow
 * @property {string} suggestedPriority
 * @property {boolean} createsSuggestion
 * @property {boolean} enabled
 */

/**
 * Linha crua de `alert_rules` (`threshold` e NUMERIC: o driver devolve texto).
 * @typedef {object} AlertRuleRow
 * @property {string} [id]
 * @property {string} [type]
 * @property {number | string | null} threshold
 * @property {number} duration_minutes
 * @property {number} recurrence_count
 * @property {string | null} [recurrence_window]
 * @property {string | null} [suggested_priority]
 * @property {boolean} creates_suggestion
 * @property {boolean} enabled
 */

/**
 * Regra no formato do mapeador (so o que o dominio le).
 * @typedef {{ suggestedPriority?: string | null }} AlertRuleLike
 */

/**
 * Corpo parcial de atualizacao de regra.
 * @typedef {object} AlertRulePayload
 * @property {unknown} [threshold]
 * @property {unknown} [durationMinutes]
 * @property {unknown} [recurrenceCount]
 * @property {unknown} [recurrenceWindow]
 * @property {unknown} [suggestedPriority]
 * @property {unknown} [createsSuggestion]
 * @property {unknown} [enabled]
 */

/**
 * @typedef {object} AlertAutoPrioritySettings
 * @property {boolean} enabled
 * @property {number} lowToMediumHours
 * @property {number} mediumToHighHours
 * @property {number} highToCriticalHours
 */

/**
 * Configuracoes de avisos ja normalizadas.
 * @typedef {object} AlertSettings
 * @property {number} rejectedAlertSilenceHours
 * @property {number} recurrenceCounterResetHours
 * @property {number} inactiveAlertAutoResolveHours
 * @property {number} preventiveDueDays
 * @property {number} scriptValidationWindowMinutes
 * @property {AlertAutoPrioritySettings} autoPriority
 * @property {Record<string, string>} priorityColors
 */

/**
 * Configuracoes parciais (JSON do banco ou corpo de atualizacao); tudo e opcional.
 * @typedef {object} AlertSettingsInput
 * @property {unknown} [rejectedAlertSilenceHours]
 * @property {unknown} [rejectionSilenceHours]
 * @property {unknown} [recurrenceCounterResetHours]
 * @property {unknown} [recurrenceCounterWindow]
 * @property {unknown} [inactiveAlertAutoResolveHours]
 * @property {unknown} [preventiveDueDays]
 * @property {unknown} [scriptValidationWindowMinutes]
 * @property {Partial<Record<keyof AlertAutoPrioritySettings, unknown>>} [autoPriority]
 * @property {Record<string, unknown>} [priorityColors]
 */

/**
 * OS como o dominio de avisos a le para relacionar avisos e ativos.
 * @typedef {object} AlertServiceOrder
 * @property {string} [id]
 * @property {string} [number]
 * @property {string} [status]
 * @property {string} [priority]
 * @property {string | null} [assetId]
 * @property {string | null} [relatedAssetText]
 * @property {string | null} [problemType]
 * @property {string | null} [category]
 * @property {string | null} [description]
 * @property {string | Date | null} [closedAt]
 */

/**
 * Sugestao de OS gerada a partir de um aviso.
 * @typedef {AlertLike & {
 *   id?: string,
 *   alertId?: string,
 *   assetId?: string | null,
 *   status?: string,
 *   suggestedPriority?: string | null,
 *   alertFirstSeenAt?: string | Date | null,
 *   alertLastSeenAt?: string | Date | null,
 *   alertSeverity?: string | null,
 *   createdAt?: string | Date | null,
 *   updatedAt?: string | Date | null
 * }} AlertSuggestion
 */

/**
 * Linha crua de `alert_suggestions` lida por `decideSuggestionRefresh`.
 * @typedef {object} SuggestionRefreshRow
 * @property {string} status
 * @property {string | Date | null} [rejection_silence_until]
 * @property {string | Date | null} [ignored_until]
 */

/**
 * Segmento (e seu grupo) de um ativo, indexado por id do ativo.
 * @typedef {object} AlertSegmentInfo
 * @property {string | null} [segmentId]
 * @property {string | null} [segmentName]
 * @property {string | null} [segmentGroupId]
 */

/**
 * Localizacao (grupo e segmento) de um aviso.
 * @typedef {object} AlertLocation
 * @property {string | null} groupId
 * @property {string} groupName
 * @property {string | null} segmentId
 * @property {string} segmentName
 */

/**
 * Contexto de enriquecimento montado pelo servico (dados ja lidos).
 * @typedef {object} AlertEnrichmentContext
 * @property {AlertServiceOrder[]} [serviceOrders]
 * @property {Map<string, AlertSegmentInfo>} [segmentMap]
 * @property {Map<string, { id?: string, name?: string }>} [groupMap]
 * @property {AlertSuggestion[]} [suggestions]
 */

/**
 * Insight de recorrencia depois de uma OS fechada.
 * @typedef {object} RecurrenceInsight
 * @property {"post_service_order_recurrence"} type
 * @property {string} summary
 * @property {string | undefined} serviceOrderId
 * @property {string | undefined} serviceOrderNumber
 * @property {string} qualityHint
 */

/**
 * @typedef {object} FalsePositiveInsight
 * @property {"possible_false_positive"} type
 * @property {string} summary
 * @property {string} recommendation
 */

/**
 * @typedef {object} CapacityForecast
 * @property {boolean} available
 * @property {string} summary
 * @property {string | null} [metric]
 * @property {number} [currentValue]
 * @property {number} [threshold]
 */

/**
 * @typedef {object} RelatedServiceOrderSummary
 * @property {string | undefined} id
 * @property {string | undefined} number
 * @property {string | undefined} status
 * @property {string | undefined} priority
 * @property {string | Date | null | undefined} closedAt
 */

/**
 * Aviso enriquecido com classificacao, justificativas, insights, localizacao e comentarios.
 * @typedef {Alert & {
 *   typeLabel: string,
 *   category: string,
 *   operationalImpact: string,
 *   probableCause: string,
 *   recommendedAction: string,
 *   checklist: string[],
 *   confidenceLevel: string,
 *   trend: string,
 *   priorityReason: string,
 *   recurrenceScore: number,
 *   capacityForecast: CapacityForecast,
 *   recurrenceInsight: RecurrenceInsight | null,
 *   falsePositiveInsight: FalsePositiveInsight | null,
 *   location: AlertLocation,
 *   relatedServiceOrders: RelatedServiceOrderSummary[],
 *   comments: unknown[],
 *   commentCount: number
 * }} EnrichedAlert
 */

export {};
