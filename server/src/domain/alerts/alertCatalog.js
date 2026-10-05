export const alertTypeLabels = {
  ram_high: "Memória RAM acima do limite",
  cpu_high: "CPU acima do limite",
  disk_high: "Disco acima do limite",
  disk_full: "Disco praticamente cheio",
  disk_health_low: "Saúde do disco abaixo do limite",
  machine_offline: "Máquina offline",
  network_high: "Alto uso de rede",
  temperature_high: "Temperatura alta",
  ping_failure: "Falha recorrente em ping",
  service_unavailable: "Serviço crítico indisponível"
};

export const compactAlertTypeLabels = {
  ram_high: "RAM alta",
  cpu_high: "CPU alta",
  disk_high: "Disco em alerta",
  disk_full: "Disco crítico",
  disk_health_low: "Saúde do disco baixa",
  machine_offline: "Máquina offline",
  network_high: "Rede em alerta",
  temperature_high: "Temperatura alta",
  ping_failure: "Falha de ping",
  service_unavailable: "Serviço indisponível"
};

const alertCategoryByType = {
  ram_high: "Desempenho",
  cpu_high: "Desempenho",
  disk_high: "Armazenamento",
  disk_full: "Armazenamento",
  disk_health_low: "Armazenamento",
  machine_offline: "Disponibilidade",
  network_high: "Segurança",
  temperature_high: "Ambiente físico",
  ping_failure: "Disponibilidade",
  service_unavailable: "Disponibilidade"
};

const alertOperationalImpact = {
  ram_high: "Pode causar lentidão, travamentos e perda de produtividade.",
  cpu_high: "Pode degradar o desempenho e deixar aplicações sem resposta.",
  disk_high: "Pode impedir gravações, atualizações e funcionamento de serviços.",
  disk_full: "Pode interromper gravações, atualizações e serviços por falta de espaço.",
  disk_health_low: "Pode indicar risco de falha física e perda de dados.",
  machine_offline: "Pode deixar usuário, setor ou serviço sem acesso ao equipamento.",
  network_high: "Pode indicar saturação, instabilidade ou tráfego incomum.",
  temperature_high: "Pode reduzir vida útil do equipamento e gerar desligamento inesperado.",
  ping_failure: "Pode indicar instabilidade de rede ou equipamento intermitente.",
  service_unavailable: "Pode interromper uma função crítica dependente do serviço."
};

const alertProbableCause = {
  ram_high: "Aplicação com alto consumo, carga acima do normal ou vazamento de memória.",
  cpu_high: "Processo travado, atualização em execução ou uso excessivo de processamento.",
  disk_high: "Logs, arquivos temporários, backup local ou armazenamento insuficiente.",
  disk_full: "Armazenamento esgotado por arquivos, logs, cache ou backups locais.",
  disk_health_low: "Desgaste do disco, setores instáveis ou falha iminente.",
  machine_offline: "Equipamento desligado, cabo desconectado, queda de rede ou IP indisponível.",
  network_high: "Backup, cópia de arquivos, atualização ou tráfego inesperado.",
  temperature_high: "Poeira, ventilação obstruída ou temperatura ambiente elevada.",
  ping_failure: "Oscilação de rede, conflito de IP ou equipamento instável.",
  service_unavailable: "Serviço parado, dependência indisponível ou erro de configuração."
};

const alertRecommendedAction = {
  ram_high: "Verificar processos com maior consumo e avaliar reinício controlado ou expansão de memória.",
  cpu_high: "Identificar processo com alto consumo e validar se há tarefa travada.",
  disk_high: "Liberar espaço, revisar logs e avaliar limpeza preventiva.",
  disk_full: "Liberar espaço imediatamente e identificar o crescimento antes de retomar serviços.",
  disk_health_low: "Priorizar backup dos dados e avaliar troca preventiva do disco.",
  machine_offline: "Confirmar energia, rede e disponibilidade do equipamento antes de abrir atendimento.",
  network_high: "Validar tráfego incomum, portas ativas e uso de banda no segmento.",
  temperature_high: "Verificar ventilação, limpeza física e temperatura do ambiente.",
  ping_failure: "Validar cabo, Wi-Fi, switch e estabilidade do endereço IP.",
  service_unavailable: "Verificar serviço, dependências e logs antes de acionar manutenção."
};

const alertChecklist = {
  ram_high: [
    "Verificar processos com maior consumo.",
    "Conferir inicialização e serviços em segundo plano.",
    "Investigar malware ou aplicação travada.",
    "Avaliar upgrade de memória se recorrente."
  ],
  cpu_high: [
    "Identificar processo com alto consumo.",
    "Verificar atualizações em execução.",
    "Conferir serviços travados.",
    "Registrar evidências antes de reiniciar."
  ],
  disk_high: [
    "Verificar arquivos temporários.",
    "Conferir logs acumulados.",
    "Validar backups locais.",
    "Avaliar expansão ou limpeza de disco."
  ],
  disk_full: [
    "Confirmar o volume e o espaço livre.",
    "Remover somente temporários e dados autorizados.",
    "Revisar logs, cache e backups locais.",
    "Avaliar expansão do armazenamento."
  ],
  disk_health_low: [
    "Realizar backup dos dados críticos.",
    "Conferir saúde do disco.",
    "Registrar evidências do alerta.",
    "Planejar troca preventiva."
  ],
  machine_offline: [
    "Verificar energia.",
    "Verificar cabo de rede ou Wi-Fi.",
    "Conferir porta do switch.",
    "Validar IP e manutenção programada."
  ],
  network_high: [
    "Identificar origem do tráfego.",
    "Validar backup ou cópia em andamento.",
    "Conferir portas e equipamentos do segmento.",
    "Registrar horário e impacto."
  ],
  temperature_high: [
    "Verificar ventilação.",
    "Limpar poeira e obstruções.",
    "Conferir temperatura ambiente.",
    "Avaliar manutenção preventiva."
  ],
  ping_failure: [
    "Verificar conectividade física.",
    "Testar rota de rede.",
    "Conferir conflito de IP.",
    "Validar estabilidade do equipamento."
  ],
  service_unavailable: [
    "Verificar se o serviço está parado.",
    "Conferir dependências.",
    "Analisar logs do serviço.",
    "Registrar impacto ao usuário."
  ]
};

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function suggestedPriority(alert = {}, rule = null) {
  if (rule?.suggestedPriority) return rule.suggestedPriority;
  if (["disk_health_low", "disk_full"].includes(alert.type) || alert.severity === "critical") return "critical";
  if (["ram_high", "cpu_high", "disk_high", "machine_offline", "ping_failure"].includes(alert.type)) return "high";
  return alert.severity === "warning" ? "medium" : "low";
}

export function getAlertTypeLabel(alert = {}) {
  const type = alert.type || alert.alertType || alert.suggestedProblemTypeId;
  return alertTypeLabels[type] || alert.title || "Aviso de monitoramento";
}

export function getAlertCategory(alert = {}) {
  const type = alert.type || alert.alertType || alert.suggestedProblemTypeId;
  return alertCategoryByType[type] || "Operacional";
}

export function getAlertCompactLabel(alert = {}) {
  const type = alert.type || alert.alertType || alert.suggestedProblemTypeId;
  return compactAlertTypeLabels[type] || getAlertTypeLabel(alert);
}

export function getAlertImpact(alert = {}) {
  const type = alert.type || alert.alertType || alert.suggestedProblemTypeId;
  return alertOperationalImpact[type] || "Pode gerar impacto operacional se o aviso se repetir.";
}

export function getAlertProbableCause(alert = {}) {
  const type = alert.type || alert.alertType || alert.suggestedProblemTypeId;
  return alertProbableCause[type] || "Causa ainda não determinada com os dados disponíveis.";
}

export function getAlertRecommendedAction(alert = {}) {
  const type = alert.type || alert.alertType || alert.suggestedProblemTypeId;
  return alertRecommendedAction[type] || "Registrar evidências e validar o ativo antes de abrir atendimento.";
}

export function getAlertChecklist(alert = {}) {
  const type = alert.type || alert.alertType || alert.suggestedProblemTypeId;
  return alertChecklist[type] || [
    "Validar o ativo afetado.",
    "Conferir se o aviso se repetiu no período.",
    "Registrar evidências.",
    "Abrir OS somente se houver impacto confirmado."
  ];
}

export function getAlertConfidence(alert = {}) {
  const occurrences = Number(alert.occurrencesCount || 1);
  if (alert.severity === "critical" && occurrences >= 3) return "Alta";
  if (occurrences >= 3) return "Média";
  return "Baixa";
}

export function getAlertTrend(alert = {}) {
  const occurrences = Number(alert.occurrencesCount || 1);
  if (occurrences >= 4) return "Em alta";
  if (occurrences >= 2) return "Recorrente";
  return "Pontual";
}

export function getPriorityLabel(priority) {
  const labels = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    critical: "Crítica"
  };
  return labels[priority] || labels.medium;
}
