// Tipos compartilhados do dominio de plantas (somente JSDoc, sem codigo).
// Os modulos desta pasta os consomem com a tag JSDoc @import apontando para este arquivo.
//
// Corpos de requisicao (`FloorPlanPayload`, `RawEditorItem`) sao nao confiaveis: so as chaves
// presentes valem e cada campo e validado pelas funcoes `normalize*`. As linhas `*Row`
// descrevem colunas cruas do banco (snake_case); o driver devolve NUMERIC/BIGINT como texto.

/** @typedef {Record<string, unknown>} FloorPlanPayload */

/**
 * Item cru do editor (andar, zona, objeto, ponto ou rota) enviado pelo cliente.
 * @typedef {Record<string, unknown>} RawEditorItem
 */

/**
 * Planta ja salva ou normalizada (cabecalho; os andares e demais itens ficam em `EditorData`).
 * @typedef {object} FloorPlan
 * @property {string | null} inventoryTabId
 * @property {string} name
 * @property {string | null} company
 * @property {string | null} unit
 * @property {string | null} floorLabel
 * @property {string} status `draft`, `active` ou `archived`.
 * @property {number} width
 * @property {number} height
 * @property {number} gridSize
 * @property {number} snapSize
 * @property {string | null} activeFloorId
 */

/**
 * @typedef {object} Floor
 * @property {string} id
 * @property {string} name
 * @property {number} level
 * @property {number} width
 * @property {number} height
 * @property {string | null} backgroundUrl
 * @property {Record<string, unknown>} metadata
 */

/**
 * @typedef {object} FloorZone
 * @property {string} id
 * @property {string} planId
 * @property {string} floorId
 * @property {string} zoneType `room`, `group` ou `segment`.
 * @property {string | null} groupId
 * @property {string | null} segmentId
 * @property {string} name
 * @property {string} color `#rrggbb`.
 * @property {Record<string, unknown>} geometry
 * @property {number} orderIndex
 * @property {Record<string, unknown>} metadata
 */

/**
 * @typedef {object} FloorObject
 * @property {string} id
 * @property {string} planId
 * @property {string} floorId
 * @property {string} objectType
 * @property {string} category
 * @property {string} label
 * @property {string | null} linkedAssetId
 * @property {string | null} groupId
 * @property {string | null} segmentId
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} rotation
 * @property {number} z
 * @property {number} height3d
 * @property {string} color
 * @property {Record<string, unknown>} metadata
 */

/**
 * @typedef {object} ConnectionPoint
 * @property {string} id
 * @property {string} planId
 * @property {string} floorId
 * @property {string} pointType `network` ou `power`.
 * @property {string} label
 * @property {string | null} linkedObjectId
 * @property {number} x
 * @property {number} y
 * @property {Record<string, unknown>} metadata
 */

/**
 * @typedef {object} CableRoute
 * @property {string} id
 * @property {string} planId
 * @property {string} floorId
 * @property {string} routeType `network` ou `power`.
 * @property {string} label
 * @property {string | null} sourcePointId
 * @property {string | null} targetPointId
 * @property {{ x?: unknown, y?: unknown }[]} path
 * @property {string} color
 * @property {Record<string, unknown>} metadata
 */

/**
 * Dados do editor antes de normalizar os filhos: andares ja normalizados, o resto cru.
 * @typedef {object} EditorData
 * @property {Floor[]} floors
 * @property {(RawEditorItem | null)[]} [zones]
 * @property {(RawEditorItem | null)[]} [objects]
 * @property {(RawEditorItem | null)[]} [connectionPoints]
 * @property {(RawEditorItem | null)[]} [connection_points]
 * @property {(RawEditorItem | null)[]} [cableRoutes]
 * @property {(RawEditorItem | null)[]} [cable_routes]
 */

/**
 * Dados do editor com todos os filhos normalizados.
 * @typedef {object} NormalizedEditorChildren
 * @property {Floor[]} floors
 * @property {FloorZone[]} zones
 * @property {FloorObject[]} objects
 * @property {ConnectionPoint[]} connectionPoints
 * @property {CableRoute[]} cableRoutes
 * @property {string} fallbackFloorId
 */

/**
 * Registro de planta salvo (camelCase, mapeado pelo repositorio) com ids tipados;
 * os demais campos acompanham a copia.
 * @typedef {{ id: string, floorId?: string | null, [key: string]: unknown }} PlanRecord
 */

/**
 * Planta completa lida do banco, origem de uma copia.
 * @typedef {object} FloorPlanSource
 * @property {{ name: string, activeFloorId?: string | null }} plan
 * @property {{ id: string, [key: string]: unknown }[]} floors
 * @property {PlanRecord[]} zones
 * @property {PlanRecord[]} objects
 * @property {(PlanRecord & { linkedObjectId?: string | null })[]} connectionPoints
 * @property {(PlanRecord & { sourcePointId?: string | null, targetPointId?: string | null })[]} cableRoutes
 */

/** @typedef {{ groupId?: string | null, segmentId?: string | null }} HeatmapFilters */

/**
 * Linha de `floor_plan_objects` usada pelos mapas de calor.
 * @typedef {object} InfrastructureObjectRow
 * @property {string} id
 * @property {string} label
 * @property {string | null} linked_asset_id
 * @property {string | null} [group_id]
 * @property {string | null} [segment_id]
 * @property {string} [category]
 * @property {string} [object_type]
 */

/**
 * Objeto de planta com ativo vinculado (`linked_asset_id` preenchido).
 * @typedef {InfrastructureObjectRow & { linked_asset_id: string }} LinkedInfrastructureObject
 */

/**
 * Linha de `agent_assets` (ultima coleta do agente).
 * @typedef {object} InfrastructureAssetRow
 * @property {string} asset_id
 * @property {string | null} [hostname]
 * @property {string | null} [machine_alias]
 * @property {number | string | null} [cpu_usage_percent]
 * @property {number | string | null} [memory_total_bytes]
 * @property {number | string | null} [memory_used_bytes]
 * @property {number | string | null} [disk_total_bytes]
 * @property {number | string | null} [disk_free_bytes]
 * @property {string | Date | null} [last_seen_at]
 * @property {number | string | null} [interval_seconds]
 */

/**
 * @typedef {object} InfrastructureAlertRow
 * @property {string} asset_id
 * @property {string} severity
 * @property {string} [status]
 */

/**
 * @typedef {object} InfrastructureOrderRow
 * @property {string} asset_id
 * @property {string} [status]
 * @property {string} [priority]
 * @property {string | Date | null} [sla_due_at]
 * @property {string | Date} created_at
 * @property {string | Date | null} [closed_at]
 */

/**
 * Linhas lidas para os mapas de calor e o resumo de infraestrutura de uma planta.
 * @typedef {object} InfrastructureData
 * @property {InfrastructureObjectRow[]} objects
 * @property {InfrastructureAssetRow[]} assets
 * @property {InfrastructureAlertRow[]} alerts
 * @property {InfrastructureOrderRow[]} orders
 */

/**
 * Leitura resumida de um ativo vinculado a um componente da planta.
 * @typedef {object} AssetSnapshot
 * @property {"online" | "offline" | "no_agent"} status
 * @property {number | null} cpu
 * @property {number | null} ram
 * @property {number | null} disk
 * @property {string | Date | null | undefined} lastSeenAt
 * @property {string | null} [name]
 */

export {};
