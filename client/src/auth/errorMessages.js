// Mensagens em portugues para cada codigo estavel devolvido pelo backend em
// `body.code`. Os textos dos erros de login sao genericos de proposito: nada
// aqui revela se um e-mail existe ou nao.
export const identityMessages = {
  INVALID_CREDENTIALS: "E-mail ou senha inválidos.",
  ACCOUNT_LOCKED: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  MFA_CODE_INVALID: "Código inválido. Confira o aplicativo autenticador e tente novamente.",
  MFA_CHALLENGE_INVALID: "A verificação expirou. Informe e-mail e senha novamente.",
  PASSWORD_CHANGE_REQUIRED: "Troque a senha para continuar.",
  MFA_ENROLLMENT_REQUIRED: "Cadastre a verificação em duas etapas para continuar.",
  CURRENT_PASSWORD_INVALID: "A senha atual está incorreta.",
  PASSWORD_REUSED: "A nova senha precisa ser diferente da atual.",
  SETUP_DISABLED:
    "O cadastro inicial pela internet está desativado. Peça a um administrador ou crie o primeiro acesso pelo servidor.",
  SETUP_TOKEN_INVALID: "Token de configuração inicial inválido.",
  MFA_REQUIRED: "A verificação em duas etapas é obrigatória para administradores.",
  MFA_ALREADY_ENABLED: "A verificação em duas etapas já está ativa.",
  MFA_NOT_ENABLED: "A verificação em duas etapas não está ativa.",
  MFA_SETUP_NOT_STARTED: "A configuração expirou. Comece de novo.",
  NETWORK_ERROR: "Não foi possível conectar ao servidor. Verifique a conexão e tente novamente."
};

/**
 * Texto para mostrar a uma pessoa a partir de um erro de API. Prefere o codigo
 * estavel; sem codigo conhecido, 429 vira o aviso de excesso de tentativas e o
 * resto cai na mensagem do servidor (ja em portugues) ou no `fallback`.
 * Para senha fraca (WEAK_PASSWORD) devolve a primeira regra violada.
 */
export function describeIdentityError(error, fallback = "Não foi possível concluir a operação. Tente novamente.") {
  if (error?.code === "WEAK_PASSWORD" && error.details?.length) return error.details[0];
  if (error?.code && identityMessages[error.code]) return identityMessages[error.code];
  if (error?.statusCode === 429) return identityMessages.ACCOUNT_LOCKED;
  if (error?.statusCode >= 500) return fallback;
  return error?.message || fallback;
}

/** Todas as regras violadas (lista) quando o servidor recusa a senha por politica. */
export function weakPasswordDetails(error) {
  return error?.code === "WEAK_PASSWORD" && Array.isArray(error.details) ? error.details : [];
}
