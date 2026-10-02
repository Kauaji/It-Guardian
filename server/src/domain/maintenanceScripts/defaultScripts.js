/** Scripts padrao semeados no catalogo quando a demonstracao esta habilitada. */

export const defaultMaintenanceScripts = [
  {
    id: "demo-script-network-diagnostics",
    name: "Diagnóstico básico de rede",
    description: "Roteiro seguro para registrar uma verificação de rede em atendimento.",
    type: "powershell",
    content: [
      "# Simulação de diagnóstico de rede",
      "hostname",
      "ipconfig /all",
      "Test-NetConnection"
    ].join("\n"),
    category: "Rede",
    riskLevel: "low",
    alertType: "ping_failure",
    problemType: "Internet lenta",
    tags: ["rede", "offline", "ping", "conectividade"],
    relatedAlertTypes: ["ping_failure", "network"],
    relatedProblemTypes: ["Internet lenta", "Maquina offline"],
    recommendedForCategories: ["Rede"]
  },
  {
    id: "demo-script-system-info",
    name: "Coleta básica do sistema",
    description: "Coleta textual de informações para triagem técnica.",
    type: "powershell",
    content: [
      "# Simulação de coleta de informações",
      "hostname",
      "whoami",
      "systeminfo"
    ].join("\n"),
    category: "Sistema",
    riskLevel: "low",
    alertType: "resource_threshold",
    problemType: "Sistema travando",
    tags: ["sistema", "cpu", "ram", "memoria", "desempenho"],
    relatedAlertTypes: ["resource_threshold", "cpu", "memory", "ram"],
    relatedProblemTypes: ["Sistema travando"],
    recommendedForCategories: ["Sistema", "Hardware"]
  },
  {
    id: "demo-script-printer-check",
    name: "Verificação de impressora",
    description: "Roteiro seguro para registrar checagem de impressora e fila.",
    type: "powershell",
    content: [
      "# Simulação de verificação de impressora",
      "Get-Printer",
      "Get-Service Spooler"
    ].join("\n"),
    category: "Impressora",
    riskLevel: "low",
    alertType: "recurring_failure",
    problemType: "Impressora não imprime"
  },
  {
    id: "demo-script-disk-check",
    name: "Verificação de disco",
    description: "Roteiro seguro para registrar avaliação inicial de disco.",
    type: "powershell",
    content: [
      "# Simulação de verificação de disco",
      "Get-Volume",
      "Get-PhysicalDisk"
    ].join("\n"),
    category: "Hardware",
    riskLevel: "medium",
    alertType: "disk_usage",
    problemType: "Disco acima do limite",
    tags: ["disco", "armazenamento", "hardware"],
    relatedAlertTypes: ["disk_usage", "disk"],
    relatedProblemTypes: ["Disco acima do limite"],
    recommendedForCategories: ["Hardware"]
  }
];
