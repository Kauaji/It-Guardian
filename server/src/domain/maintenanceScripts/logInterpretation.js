/**
 * Interpretacao textual do log tecnico de uma execucao de script: detecta os
 * erros conhecidos e devolve causa provavel, solucao sugerida e metadados.
 * Modulo puro.
 */

const logErrorPatterns = [
  {
    type: "access_denied",
    patterns: [/access\s+denied/i, /acesso\s+negado/i, /permission\s+denied/i],
    summary: "O log indica acesso negado.",
    cause: "O script tentou acessar um recurso sem permissao suficiente.",
    solution: "Validar permissao administrativa, caminho acessado e credenciais do usuario."
  },
  {
    type: "file_not_found",
    patterns: [/file\s+not\s+found/i, /arquivo\s+n[aã]o\s+encontrado/i, /cannot\s+find/i],
    summary: "O arquivo ou recurso informado nao foi encontrado.",
    cause: "O caminho pode estar incorreto ou o arquivo nao existe no ativo.",
    solution: "Conferir caminho, nome do arquivo e existencia do recurso antes de tentar novamente."
  },
  {
    type: "invalid_path",
    patterns: [/invalid\s+path/i, /caminho\s+inv[aá]lido/i, /path\s+not\s+valid/i],
    summary: "O caminho informado parece invalido.",
    cause: "Variavel, unidade ou pasta informada nao foi resolvida corretamente.",
    solution: "Validar a unidade, remover caracteres invalidos e conferir variaveis do script."
  },
  {
    type: "insufficient_permission",
    patterns: [/insufficient\s+permission/i, /permiss[aã]o\s+insuficiente/i, /requires\s+elevation/i],
    summary: "Permissao insuficiente para concluir a acao.",
    cause: "A verificacao exigiria permissao elevada no ativo.",
    solution: "Registrar acao corretiva para revisar permissao, perfil do usuario ou agente seguro."
  },
  {
    type: "command_not_recognized",
    patterns: [/not\s+recognized/i, /n[aã]o\s+reconhecido/i, /command\s+not\s+found/i],
    summary: "Comando nao reconhecido no ambiente informado.",
    cause: "O comando pode nao existir no sistema operacional ou no PATH do ativo.",
    solution: "Validar tipo de script, shell alvo e comandos disponiveis no ativo."
  },
  {
    type: "timeout",
    patterns: [/timeout/i, /timed\s+out/i, /tempo\s+esgotado/i],
    summary: "A operacao atingiu o tempo limite.",
    cause: "O ativo pode estar indisponivel, lento ou sem resposta do agente.",
    solution: "Revisar conectividade, disponibilidade do agente e janela de execucao."
  },
  {
    type: "network_failure",
    patterns: [/network\s+failure/i, /falha\s+de\s+rede/i, /unreachable/i, /host\s+inacess/i],
    summary: "Falha de rede durante a verificacao.",
    cause: "O ativo, rota ou servico de rede pode estar indisponivel.",
    solution: "Validar conectividade, DNS, rota e disponibilidade do equipamento."
  },
  {
    type: "agent_unavailable",
    patterns: [/agent\s+unavailable/i, /agente\s+indispon/i, /agent\s+offline/i],
    summary: "Agente seguro indisponivel.",
    cause: "Nao ha agente conectado para executar ou coletar dados reais.",
    solution: "Manter a validacao como preparada e instalar/ativar agente seguro futuramente."
  },
  {
    type: "unresolved_variable",
    patterns: [/\{\{[A-Z0-9_]+\}\}/i, /unresolved\s+variable/i, /vari[aá]vel\s+n[aã]o\s+resolvida/i],
    summary: "Variavel do script nao foi resolvida.",
    cause: "O contexto do ativo nao forneceu uma das variaveis esperadas.",
    solution: "Conferir variaveis suportadas e dados cadastrados do ativo."
  },
  {
    type: "logged_user_not_detected",
    patterns: [/logged\s+user\s+not\s+detected/i, /usuario\s+logado\s+n[aã]o\s+detectado/i, /whoami.*failed/i],
    summary: "Usuario logado nao detectado.",
    cause: "A verificacao depende de sessao de usuario, mas o agente nao encontrou uma sessao ativa.",
    solution: "Confirmar se ha usuario logado no ativo ou ajustar o roteiro para contexto de sistema."
  }
];

/** @type {Record<string, { code: string, category: string, severity: string, requiresAdmin: boolean, requiresLoggedUser: boolean }>} */
const logErrorMetadata = {
  access_denied: {
    code: "ACCESS_DENIED",
    category: "permissao",
    severity: "high",
    requiresAdmin: true,
    requiresLoggedUser: false
  },
  file_not_found: {
    code: "FILE_NOT_FOUND",
    category: "arquivo",
    severity: "medium",
    requiresAdmin: false,
    requiresLoggedUser: false
  },
  invalid_path: {
    code: "INVALID_PATH",
    category: "caminho",
    severity: "medium",
    requiresAdmin: false,
    requiresLoggedUser: false
  },
  insufficient_permission: {
    code: "INSUFFICIENT_PERMISSION",
    category: "permissao",
    severity: "high",
    requiresAdmin: true,
    requiresLoggedUser: false
  },
  command_not_recognized: {
    code: "COMMAND_NOT_RECOGNIZED",
    category: "ambiente",
    severity: "medium",
    requiresAdmin: false,
    requiresLoggedUser: false
  },
  timeout: {
    code: "TIMEOUT",
    category: "tempo_limite",
    severity: "medium",
    requiresAdmin: false,
    requiresLoggedUser: false
  },
  network_failure: {
    code: "NETWORK_FAILURE",
    category: "rede",
    severity: "high",
    requiresAdmin: false,
    requiresLoggedUser: false
  },
  agent_unavailable: {
    code: "AGENT_UNAVAILABLE",
    category: "agente",
    severity: "medium",
    requiresAdmin: false,
    requiresLoggedUser: false
  },
  unresolved_variable: {
    code: "UNRESOLVED_VARIABLE",
    category: "variavel",
    severity: "medium",
    requiresAdmin: false,
    requiresLoggedUser: false
  },
  logged_user_not_detected: {
    code: "LOGGED_USER_NOT_DETECTED",
    category: "sessao_usuario",
    severity: "medium",
    requiresAdmin: false,
    requiresLoggedUser: true
  }
};

/**
 * @param {unknown} [rawLog]
 * @param {string} [fallbackStatus]
 */
export function interpretScriptLogWithMetadata(rawLog = "", fallbackStatus = "registered") {
  const text = String(rawLog || "").trim();

  if (!text) {
    return {
      parsedSummary: "Nenhum log de script disponível.",
      errorDetected: false,
      errorType: "",
      errorCode: "",
      errorCategory: "",
      errorSeverity: "",
      probableCause: "",
      suggestedSolution: "",
      requiresAdmin: false,
      requiresLoggedUser: false,
      status: fallbackStatus
    };
  }

  for (const rule of logErrorPatterns) {
    if (!rule.patterns.some((pattern) => pattern.test(text))) continue;
    const metadata = logErrorMetadata[rule.type];

    return {
      parsedSummary: rule.summary,
      errorDetected: true,
      errorType: rule.type,
      errorCode: metadata?.code || "",
      errorCategory: metadata?.category || "",
      errorSeverity: metadata?.severity || "medium",
      probableCause: rule.cause,
      suggestedSolution: rule.solution,
      requiresAdmin: metadata?.requiresAdmin === true,
      requiresLoggedUser: metadata?.requiresLoggedUser === true,
      status: "error"
    };
  }

  return {
    parsedSummary: "Log registrado sem erro reconhecido.",
    errorDetected: false,
    errorType: "",
    errorCode: "",
    errorCategory: "",
    errorSeverity: "",
    probableCause: "",
    suggestedSolution: "",
    requiresAdmin: false,
    requiresLoggedUser: false,
    status: fallbackStatus === "error" ? "registered" : fallbackStatus
  };
}
