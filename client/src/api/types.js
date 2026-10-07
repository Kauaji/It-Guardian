// Tipos compartilhados da camada de API do cliente (somente JSDoc, sem codigo em runtime).
//
// Uso nos modulos: `@returns {Promise<import("./types.js").DeviceResponse>}`.
// Os formatos abaixo descrevem os campos principais devolvidos pelo servidor; campos
// adicionais passam pelo index signature (`[key: string]: unknown`) e devem ser
// promovidos a propriedade nomeada conforme os componentes passarem a usa-los.

/** Identificador de entidade: o servidor devolve strings (uuid/slug) ou numeros. */
/** @typedef {string | number} EntityId */

/** Token de sessao enviado como `Authorization: Bearer`. Vazio em chamadas publicas/por cookie. */
/** @typedef {string | null | undefined} AuthToken */

/** Corpo JSON generico de uma requisicao de escrita. */
/** @typedef {Record<string, unknown>} Payload */

/** Objeto JSON generico de resposta ainda nao modelado em detalhe. */
/** @typedef {Record<string, unknown>} ApiObject */

/** Parametros de query string; valores nulos/indefinidos viram "null"/"undefined" se nao filtrados. */
/** @typedef {Record<string, string | number | boolean | null | undefined>} QueryParams */

/**
 * Erro lancado por `apiFetch` quando a resposta nao e 2xx.
 * `statusCode` fica ausente quando a falha foi de rede (sem resposta).
 * @typedef {Error & { statusCode?: number }} ApiError
 */

/**
 * Opcoes de `apiFetch`: o `RequestInit` do fetch com `token` e `headers` simples.
 * @typedef {Omit<RequestInit, "headers"> & { token?: AuthToken, headers?: Record<string, string> }} ApiFetchOptions
 */

/**
 * Usuario publico (`toPublicUser` no servidor).
 * @typedef {object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} role
 * @property {boolean} active
 * @property {string | null} [sectorId]
 * @property {string | null} [sectorName]
 * @property {string | null} [jobTitle]
 * @property {boolean} isAdmin
 * @property {string[]} [permissions]
 * @property {string[]} [sectorPermissions]
 * @property {string[]} effectivePermissions
 * @property {boolean} mfaEnabled
 * @property {boolean} mustChangePassword
 * @property {string | null} [passwordChangedAt]
 * @property {string | null} [lastLoginAt]
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

/**
 * Janela de validade da sessao devolvida por `/auth/me` e pelo login.
 * @typedef {object} Session
 * @property {string} expiresAt
 * @property {string} absoluteExpiresAt
 */

/**
 * Resposta de login/registro/`/auth/me` quando a sessao foi estabelecida.
 * @typedef {object} SessionResponse
 * @property {User} user
 * @property {string} token
 * @property {Session} session
 */

/**
 * Login com MFA pendente: nao ha sessao ate o segundo fator.
 * @typedef {object} MfaChallengeResponse
 * @property {true} mfaRequired
 * @property {string} mfaToken
 */

/** @typedef {SessionResponse | MfaChallengeResponse} LoginResponse */

/** @typedef {{ users: User[] }} UserListResponse */
/** @typedef {{ user: User }} UserResponse */

/**
 * Setor da empresa.
 * @typedef {object} Sector
 * @property {string} id
 * @property {string} name
 * @property {string[]} [permissions]
 */
/** @typedef {{ sectors: Sector[] }} SectorListResponse */
/** @typedef {{ sector: Sector }} SectorResponse */

/**
 * Ativo (maquina monitorada, ativo manual ou agente) como listado no inventario.
 * @typedef {object} Device
 * @property {string} id
 * @property {string} name
 * @property {string} [status]
 * @property {string} [type]
 * @property {string} [ip]
 * @property {string | null} [segmentId]
 * @property {string} [alias]
 * @property {{ [key: string]: unknown }} [details]
 */
/** @typedef {{ device: Device }} DeviceResponse */
/** @typedef {{ summary: ApiObject, devices: Device[] }} DeviceListResponse */

/**
 * Segmento de rede.
 * @typedef {object} Segment
 * @property {string} id
 * @property {string} name
 * @property {string | null} [groupId]
 */
/** @typedef {{ segments: Segment[] }} SegmentListResponse */

/**
 * Item de historico de uma ordem de servico.
 * @typedef {object} ServiceOrderHistoryEntry
 * @property {string} id
 * @property {string} [type]
 * @property {string} [message]
 * @property {string} [createdAt]
 */

/**
 * Ordem de servico (`fromOrderRow` no servidor).
 * @typedef {object} ServiceOrder
 * @property {string} id
 * @property {boolean} [isDemo]
 * @property {string | number} number
 * @property {string} title
 * @property {string | null} [description]
 * @property {string} status
 * @property {string} priority
 * @property {string | null} [assetId]
 * @property {string | null} [sectorId]
 * @property {string | null} [sectorName]
 * @property {string | null} [serviceId]
 * @property {string | null} [requesterName]
 * @property {string[]} [assignedTechnicianNames]
 * @property {number} [totalValue]
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 * @property {string | null} [closedAt]
 * @property {string | null} [slaDueAt]
 * @property {ServiceOrderHistoryEntry[]} [history]
 * @property {unknown[]} [items]
 */
/** @typedef {{ serviceOrders: ServiceOrder[] }} ServiceOrderListResponse */
/** @typedef {{ serviceOrder: ServiceOrder }} ServiceOrderResponse */

/**
 * Alerta de infraestrutura (`fromAlertRow` no servidor).
 * @typedef {object} Alert
 * @property {string} id
 * @property {string | null} [assetId]
 * @property {string | null} [hostName]
 * @property {string} [type]
 * @property {string} [metric]
 * @property {string} title
 * @property {string | null} [description]
 * @property {"critical" | "high" | "medium" | "low" | "info" | string} severity
 * @property {number | null} [value]
 * @property {number | null} [threshold]
 * @property {string} status
 * @property {string} [firstSeenAt]
 * @property {string} [lastSeenAt]
 * @property {string | null} [resolvedAt]
 * @property {number} [occurrencesCount]
 */
/** @typedef {{ alerts: Alert[] }} AlertListResponse */
/** @typedef {{ alert: Alert }} AlertResponse */

export {};
