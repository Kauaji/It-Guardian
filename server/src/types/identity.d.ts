// Tipos do nucleo de identidade/sessao (usuarios, sessoes, MFA).
// As linhas `*Row` espelham as colunas cruas do banco (snake_case); os demais tipos sao os
// objetos que os repositorios mapeiam para os servicos (camelCase). Aliases de objeto (e nao
// `interface`) para valerem como `Row` de `query<Row extends Record<string, unknown>>`.

/** Instante como o driver devolve (`Date`) ou como chega serializado em testes e respostas. */
export type Timestamp = Date | string;

/** Contexto da requisicao anexado a auditoria e a abertura de sessao. */
export type RequestContext = {
  ip?: string | null;
  userAgent?: string | null;
};

/** Linha de `users` com o setor (`userSelect` em userRepository). */
export type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  active: boolean | null;
  sector_id: string | null;
  job_title: string | null;
  is_admin: boolean | null;
  permissions: unknown;
  created_at: Timestamp;
  updated_at: Timestamp;
  token_version: number | string | null;
  must_change_password: boolean | null;
  password_changed_at: Timestamp | null;
  failed_login_attempts: number | string | null;
  lockout_count: number | string | null;
  locked_until: Timestamp | null;
  last_login_at: Timestamp | null;
  mfa_enabled: boolean | null;
  sector_name: string | null;
  sector_permissions: unknown;
};

/** Usuario mapeado (`fromRow`), com hash de senha: nunca sai da camada de servico. */
export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  active: boolean;
  sectorId: string | null;
  sectorName: string | null;
  jobTitle: string | null;
  isAdmin: boolean;
  permissions: string[];
  sectorPermissions: string[];
  tokenVersion: number;
  mustChangePassword: boolean;
  passwordChangedAt: Timestamp | null;
  failedLoginAttempts: number;
  lockoutCount: number;
  lockedUntil: Timestamp | null;
  lastLoginAt: Timestamp | null;
  mfaEnabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /**
   * Lidos por `authMiddleware` ao montar `req.user`, mas que `fromRow` nao preenche
   * (nao ha colunas correspondentes): ficam sempre ausentes e viram `[]`/calculo por papel.
   */
  effectivePermissions?: string[];
  allowedEnvironmentIds?: unknown;
  allowedGroupIds?: unknown;
  allowedSegmentIds?: unknown;
};

/** Usuario sem segredos (`toPublicUser`): o que as respostas da API expoem. */
export type PublicUser = Omit<User, "passwordHash" | "tokenVersion" | "failedLoginAttempts" | "lockoutCount" | "lockedUntil"> & {
  effectivePermissions: string[];
};

/** Linha de `auth_sessions`. */
export type AuthSessionRow = {
  id: string;
  user_id: string;
  token_version: number | string | null;
  created_at: Timestamp;
  last_seen_at: Timestamp;
  absolute_expires_at: Timestamp;
  revoked_at: Timestamp | null;
  revoked_reason: string | null;
  ip: string | null;
  user_agent: string | null;
};

/** Sessao de login mapeada (`auth_sessions`). */
export type AuthSession = {
  id: string;
  userId: string;
  tokenVersion: number;
  createdAt: Timestamp;
  lastSeenAt: Timestamp;
  absoluteExpiresAt: Timestamp;
  revokedAt: Timestamp | null;
  revokedReason: string | null;
  ip: string | null;
  userAgent: string | null;
};

/** Colunas de seguranca de `users` lidas por `getSecurityState`. */
export type SecurityStateRow = Pick<
  UserRow,
  "token_version" | "failed_login_attempts" | "lockout_count" | "locked_until" | "must_change_password" | "mfa_enabled" | "password_changed_at"
> & {
  mfa_secret_encrypted: string | null;
  mfa_pending_secret_encrypted: string | null;
  mfa_last_used_step: number | string | null;
};

/** Estado de seguranca/MFA de um usuario. */
export type SecurityState = {
  tokenVersion: number;
  failedLoginAttempts: number;
  lockoutCount: number;
  lockedUntil: Timestamp | null;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  mfaSecretEncrypted: string | null;
  mfaPendingSecretEncrypted: string | null;
  mfaLastUsedStep: number | null;
  passwordChangedAt: Timestamp | null;
};

/** Corpo do JWT de sessao (`typ: "session"`) ou de desafio MFA (`typ: "mfa"`). */
export type SessionTokenPayload = {
  sub?: string;
  sid?: string;
  ver?: number;
  typ?: string;
  iat?: number;
  exp?: number;
};

/** `req.user`: usuario autenticado, ja com os escopos de cliente/ambiente carregados. */
export type RequestUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  sectorId: string | null;
  sectorName: string | null;
  jobTitle: string | null;
  isAdmin: boolean;
  permissions: string[];
  sectorPermissions: string[];
  /** Hoje sempre ausente (ver `User.effectivePermissions`): `hasPermission` calcula pelo papel. */
  effectivePermissions?: string[];
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  allowedClientIds: string[];
  allowedEnvironmentIds: string[];
  allowedGroupIds: string[];
  allowedSegmentIds: string[];
};

/** `req.auth`: credencial da requisicao autenticada. */
export type RequestAuth = {
  token: string;
  payload: SessionTokenPayload;
  session: AuthSession;
};
