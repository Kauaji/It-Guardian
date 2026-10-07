// Tipos compartilhados do dominio do mapa de rede (somente JSDoc, sem codigo).
// Os modulos desta pasta os consomem com a tag JSDoc @import apontando para este arquivo.

/**
 * Corpo cru de escrita (nao confiavel): aceita camelCase e snake_case; so as chaves
 * presentes valem e cada campo e validado pelas funcoes `normalize*Payload`.
 * @typedef {Record<string, unknown>} TopologyPayload
 */

/**
 * Mapa de rede ja salvo (campos que o dominio herda ao editar parcialmente).
 * @typedef {object} TopologyMap
 * @property {string} [name]
 * @property {string} [scopeType] `global`, `inventory_tab`, `group` ou `segment`.
 * @property {string | null} [scopeId]
 */

/**
 * No (ativo, segmento ou grupo) posicionado no mapa.
 * @typedef {object} TopologyNode
 * @property {string} [nodeType] `asset`, `segment` ou `group`.
 * @property {string | null} [assetId]
 * @property {string | null} [refId]
 * @property {number} [x]
 * @property {number} [y]
 * @property {boolean} [pinned]
 * @property {string | null} [labelOverride]
 */

/**
 * Conexao entre dois nos do mapa.
 * @typedef {object} TopologyLink
 * @property {string} [sourceType]
 * @property {string} [targetType]
 * @property {string | null} [sourceAssetId]
 * @property {string | null} [targetAssetId]
 * @property {string | null} [label]
 * @property {string} [type] `ethernet`, `wifi`, `fiber`, `logical` ou `unknown`.
 * @property {string | null} [statusOverride]
 * @property {string | null} [description]
 */

/**
 * @typedef {object} NormalizedTopologyMap
 * @property {string} name
 * @property {string} scopeType
 * @property {string | null} scopeId
 */

/**
 * @typedef {object} NormalizedTopologyNode
 * @property {string} nodeType
 * @property {string | null} assetId
 * @property {string | null} refId
 * @property {number} x
 * @property {number} y
 * @property {boolean} pinned
 * @property {string | null} labelOverride
 */

/**
 * @typedef {object} NormalizedTopologyLink
 * @property {string} sourceType
 * @property {string} targetType
 * @property {string} sourceAssetId
 * @property {string} targetAssetId
 * @property {string | null} label
 * @property {string} type
 * @property {string | null} statusOverride
 * @property {string | null} description
 */

export {};
