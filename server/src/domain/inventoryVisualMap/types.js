// Tipos compartilhados do dominio do mapa visual do inventario (somente JSDoc, sem codigo).
// Os modulos desta pasta os consomem com a tag JSDoc @import apontando para este arquivo.

/** @typedef {"structure" | "assets" | "infrastructure" | "electrical"} VisualMapLayer */

/** @typedef {"infrastructure" | "electrical"} ConnectionLayer */

/**
 * Corpo cru de escrita (nao confiavel): aceita camelCase e snake_case; so as chaves
 * presentes valem e cada campo e validado pelas funcoes `normalize*Payload`.
 * @typedef {Record<string, unknown>} VisualMapPayload
 */

/**
 * Dimensoes (em metros), cor e rotulo padrao de um tipo de objeto.
 * @typedef {object} PresetDimensions
 * @property {number} width
 * @property {number} depth
 * @property {number} height
 * @property {string} color `#rrggbb`.
 * @property {string} label
 */

/**
 * Ponto 3D de uma conexao.
 * @typedef {object} VisualMapPoint
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * Mapa visual ja salvo (campos herdados ao editar parcialmente).
 * @typedef {object} VisualMap
 * @property {string} [name]
 * @property {string | null} [environmentId]
 * @property {string | null} [groupId]
 * @property {string | null} [segmentId]
 * @property {string | null} [floorLabel]
 * @property {number} [width]
 * @property {number} [depth]
 * @property {number} [scale]
 * @property {string | null} [notes]
 */

/**
 * Objeto do mapa (estrutura, ativo, infraestrutura ou eletrica) ja salvo.
 * @typedef {object} VisualMapObject
 * @property {string} [layer]
 * @property {string} [presetType]
 * @property {string} [label]
 * @property {string | null} [linkedAssetId]
 * @property {number} [positionX]
 * @property {number} [positionY]
 * @property {number} [positionZ]
 * @property {number} [rotationX]
 * @property {number} [rotationY]
 * @property {number} [rotationZ]
 * @property {number} [width]
 * @property {number} [depth]
 * @property {number} [height]
 * @property {string} [color]
 * @property {string | null} [notes]
 * @property {unknown} [metadata]
 */

/**
 * Conexao (cabo, linha eletrica) entre objetos ou ativos, ja salva.
 * @typedef {object} VisualMapConnection
 * @property {string} [layer]
 * @property {string} [connectionType]
 * @property {string | null} [label]
 * @property {string | null} [sourceObjectId]
 * @property {string | null} [targetObjectId]
 * @property {string | null} [sourceAssetId]
 * @property {string | null} [targetAssetId]
 * @property {unknown} [points]
 * @property {string} [color]
 * @property {number} [thickness]
 * @property {boolean} [dashed]
 * @property {string | null} [notes]
 * @property {unknown} [metadata]
 */

/**
 * @typedef {object} NormalizedVisualMap
 * @property {string} name
 * @property {string | null} environmentId
 * @property {string | null} groupId
 * @property {string | null} segmentId
 * @property {string | null} floorLabel
 * @property {number} width
 * @property {number} depth
 * @property {number} scale
 * @property {string | null} notes
 */

/**
 * @typedef {object} NormalizedVisualMapObject
 * @property {string} layer
 * @property {string} presetType
 * @property {string} label
 * @property {string | null} linkedAssetId
 * @property {number} positionX
 * @property {number} positionY
 * @property {number} positionZ
 * @property {number} rotationX
 * @property {number} rotationY
 * @property {number} rotationZ
 * @property {number} width
 * @property {number} depth
 * @property {number} height
 * @property {string} color
 * @property {string | null} notes
 * @property {Record<string, unknown>} metadata
 */

/**
 * @typedef {object} NormalizedVisualMapConnection
 * @property {string} layer
 * @property {string} connectionType
 * @property {string | null} label
 * @property {string | null} sourceObjectId
 * @property {string | null} targetObjectId
 * @property {string | null} sourceAssetId
 * @property {string | null} targetAssetId
 * @property {VisualMapPoint[]} points
 * @property {string} color
 * @property {number} thickness
 * @property {boolean} dashed
 * @property {string | null} notes
 * @property {Record<string, unknown>} metadata
 */

export {};
