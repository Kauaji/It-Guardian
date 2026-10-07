// Tipos compartilhados do dominio de ordens de servico (somente JSDoc, sem codigo).
// Os modulos desta pasta os consomem com a tag JSDoc @import apontando para este arquivo.
//
// Os formatos descrevem o que o dominio *le*: o corpo da requisicao (`ServiceOrderPayload`,
// nao confiavel, validado campo a campo pelas funcoes puras) e a OS ja mapeada pelo repositorio
// (`ServiceOrder`, camelCase). Campos nao usados pelas regras ficam no index signature.

/** @import { PermissionUser } from "../../../../shared/permissions.js" */

/** @typedef {"low" | "medium" | "high" | "critical"} PriorityId */

/**
 * Status configuravel da OS (`id` estavel; exatamente um inicial e um final).
 * @typedef {object} ServiceOrderStatus
 * @property {string} id
 * @property {string} name
 * @property {string} color `#rrggbb`.
 * @property {number} order
 * @property {boolean} isInitial
 * @property {boolean} isFinal
 */

/**
 * Status como enviado/guardado (campos opcionais e apelidos `label`/`value`).
 * @typedef {object} ServiceOrderStatusInput
 * @property {string} [id]
 * @property {string} [value]
 * @property {string} [name]
 * @property {string} [label]
 * @property {string} [color]
 * @property {number | string} [order]
 * @property {boolean} [isInitial]
 * @property {boolean} [isFinal]
 */

/**
 * Metas de SLA em horas por prioridade e parametros de "proximo do prazo".
 * @typedef {object} SlaSettings
 * @property {number} low
 * @property {number} medium
 * @property {number} high
 * @property {number} critical
 * @property {number} nearDuePercent
 * @property {number} nearDueMinHours
 */

/**
 * @typedef {object} NumberFormatSettings
 * @property {string} prefix
 * @property {boolean} useYear
 * @property {boolean} useMonth
 * @property {number | null} nextNumber
 */

/**
 * @typedef {object} AutoPrioritySettings
 * @property {boolean} enabled
 * @property {number} lowToMediumHours
 * @property {number} mediumToHighHours
 * @property {number} highToCriticalHours
 */

/**
 * Configuracoes de OS ja normalizadas (`normalizeServiceOrderSettings`).
 * @typedef {object} ServiceOrderSettings
 * @property {NumberFormatSettings} numberFormat
 * @property {AutoPrioritySettings} autoPriority
 * @property {ServiceOrderStatus[]} statuses
 * @property {Record<string, string>} priorityColors
 * @property {string} boardLayout `horizontal` ou `vertical`.
 * @property {SlaSettings} sla
 * @property {boolean} requireChecklistBeforeFinish
 */

/**
 * Configuracoes parciais (JSON do banco ou corpo de atualizacao); tudo e opcional.
 * @typedef {object} ServiceOrderSettingsInput
 * @property {Partial<NumberFormatSettings>} [numberFormat]
 * @property {Partial<AutoPrioritySettings>} [autoPriority]
 * @property {ServiceOrderStatusInput[]} [statuses]
 * @property {Record<string, string>} [priorityColors]
 * @property {string} [boardLayout]
 * @property {Partial<SlaSettings>} [sla]
 * @property {unknown} [requireChecklistBeforeFinish]
 */

/**
 * Estado de SLA calculado na leitura (`calculateServiceOrderSla`).
 * @typedef {object} ServiceOrderSla
 * @property {string | Date | null} dueAt
 * @property {string} status
 * @property {number | null} remainingMinutes
 * @property {boolean} breached
 * @property {boolean} nearDue
 */

/**
 * Valores monetarios (em reais, arredondados em centavos) de uma OS.
 * @typedef {object} ServiceOrderMoney
 * @property {number} serviceValue
 * @property {number} totalPartsValue
 * @property {number} totalValue
 */

/**
 * Peca/item de uma OS apos a normalizacao.
 * @typedef {object} ServiceOrderItem
 * @property {string} id
 * @property {string | null} productId
 * @property {string} productName
 * @property {number} quantity
 * @property {number} unitPrice
 * @property {number} subtotal
 * @property {string} notes
 */

/**
 * Item como enviado pelo cliente ou lido do JSON do banco (camelCase ou snake_case).
 * @typedef {object} ServiceOrderItemInput
 * @property {string} [id]
 * @property {string | null} [productId]
 * @property {string | null} [product_id]
 * @property {string} [productName]
 * @property {string} [product_name]
 * @property {string} [name]
 * @property {unknown} [quantity]
 * @property {unknown} [unitPrice]
 * @property {unknown} [unit_price]
 * @property {unknown} [subtotal]
 * @property {unknown} [notes]
 */

/**
 * Setor resolvido de uma OS.
 * @typedef {object} ServiceOrderSector
 * @property {string | null} [sectorId]
 * @property {string | null} [sectorName]
 */

/**
 * Servico do catalogo resolvido para uma OS (campos `service*` da OS).
 * @typedef {object} ServiceOrderService
 * @property {string | null} [serviceId]
 * @property {string | null} [serviceCode]
 * @property {string | null} [serviceName]
 * @property {unknown} [defaultValue]
 * @property {string | null} [defaultPriority]
 */

/**
 * Regra de prioridade automatica configurada.
 * @typedef {object} PriorityRule
 * @property {boolean} [active]
 * @property {string} ruleType `client`, `sector`, `problem_type`, `service`, `category` ou `equipment_category`.
 * @property {unknown} targetValue
 * @property {string} priority
 */

/**
 * Corpo de criacao/atualizacao de OS (nao confiavel: so as chaves presentes valem).
 * @typedef {object} ServiceOrderPayload
 * @property {string} [title]
 * @property {string} [description]
 * @property {string} [status]
 * @property {string} [priority]
 * @property {string} [category]
 * @property {string} [problemType]
 * @property {string | null} [assetId]
 * @property {string | null} [backupAssetId]
 * @property {string | null} [environmentId]
 * @property {string | null} [environmentName]
 * @property {string | null} [requesterName]
 * @property {string | null} [contactInfo]
 * @property {string | null} [requesterDepartment]
 * @property {string | null} [requesterExtension]
 * @property {string | null} [relatedAssetText]
 * @property {string | null} [machineScope]
 * @property {string | null} [location]
 * @property {string | null} [source]
 * @property {string[]} [assignedTechnicianNames]
 * @property {string} [assignedTechnicianName]
 * @property {boolean} [autoPriorityEnabled]
 * @property {string | null} [workNotes]
 * @property {string | null} [diagnosis]
 * @property {string | null} [solution]
 * @property {string | null} [partsUsed]
 * @property {string | null} [notes]
 * @property {string | null} [servicePerformed]
 * @property {string | null} [attendanceNotes]
 * @property {string | null} [preventivePlanId]
 * @property {unknown} [serviceValue]
 * @property {string | null} [serviceId]
 * @property {string | null} [serviceCode]
 * @property {string | null} [serviceName]
 * @property {ServiceOrderItemInput[]} [items]
 * @property {ServiceOrderItemInput[]} [serviceItems]
 */

/**
 * OS como lida do banco e mapeada pelo repositorio (camelCase).
 * @typedef {object} ServiceOrder
 * @property {string} [id]
 * @property {string} [number]
 * @property {string} [title]
 * @property {string | null} [description]
 * @property {string} status
 * @property {string} priority
 * @property {string | null} [category]
 * @property {string | null} [problemType]
 * @property {string | null} [assetId]
 * @property {string | null} [backupAssetId]
 * @property {string | null} [environmentId]
 * @property {string | null} [environmentName]
 * @property {string | null} [requesterName]
 * @property {string | null} [contactInfo]
 * @property {string | null} [requesterDepartment]
 * @property {string | null} [requesterExtension]
 * @property {string | null} [relatedAssetText]
 * @property {string | null} [machineScope]
 * @property {string | null} [location]
 * @property {string | null} [source]
 * @property {string[]} [assignedTechnicianNames]
 * @property {string | null} [assignedTechnicianName]
 * @property {boolean} [autoPriorityEnabled]
 * @property {string | null} [workNotes]
 * @property {string | null} [diagnosis]
 * @property {string | null} [solution]
 * @property {string | null} [partsUsed]
 * @property {string | null} [notes]
 * @property {string | null} [servicePerformed]
 * @property {string | null} [attendanceNotes]
 * @property {number | string | null} [serviceValue]
 * @property {string | null} [sectorId]
 * @property {string | null} [sectorName]
 * @property {string | null} [serviceId]
 * @property {string | null} [serviceCode]
 * @property {string | null} [serviceName]
 * @property {string | Date | null} [closedAt]
 * @property {string | Date | null} [slaDueAt]
 * @property {string | Date | null} [slaBreachedAt]
 * @property {string | null} [createdBy]
 */

/**
 * Usuario como o dominio de OS o le (visibilidade por setor/cliente).
 * @typedef {PermissionUser & {
 *   id?: string | null,
 *   name?: string | null,
 *   email?: string | null,
 *   sectorId?: string | null,
 *   sectorName?: string | null,
 *   allowedClientIds?: string[] | null
 * }} ServiceOrderUser
 */

/**
 * Linha de OS (snake_case) minima para calcular a prioridade por tempo.
 * @typedef {object} PriorityRow
 * @property {string} priority
 * @property {string} status
 * @property {boolean | null} [auto_priority_enabled]
 * @property {string | number | Date} created_at
 */

/**
 * Alteracao comparavel de uma atualizacao: [tipoDoEvento, mensagem, valorAntigo, valorNovo].
 * @typedef {[string, string, unknown, unknown]} ServiceOrderChange
 */

export {};
