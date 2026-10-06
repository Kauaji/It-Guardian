// Regras puras do chamado público: opções padrão, leitura do contexto da máquina e formulário inicial.
import { honeypotFieldName } from "../publicSupportValidation.js";

export const fallbackCategories = [
  "Computador",
  "Notebook",
  "Servidor",
  "Impressora",
  "Teclado",
  "Mouse",
  "Monitor",
  "Rede",
  "Sistema",
  "Outro"
];

export const fallbackProblemTypes = [
  { id: "computer-power", name: "Computador não liga", category: "Computador", defaultPriority: "high" },
  { id: "printer", name: "Impressora não imprime", category: "Impressora", defaultPriority: "medium" },
  { id: "network", name: "Internet lenta", category: "Rede", defaultPriority: "medium" },
  { id: "system", name: "Sistema travando", category: "Sistema", defaultPriority: "medium" },
  { id: "monitor", name: "Monitor sem imagem", category: "Monitor", defaultPriority: "medium" },
  { id: "keyboard", name: "Teclado com defeito", category: "Teclado", defaultPriority: "low" },
  { id: "mouse", name: "Mouse com defeito", category: "Mouse", defaultPriority: "low" }
];

export function findProblemType(problemTypes, value) {
  return problemTypes.find(
    (problemType) => problemType.name === value || problemType.id === value
  );
}

export function getFirstProblemTypeForCategory(problemTypes, category) {
  return problemTypes.find((problemType) => !problemType.category || problemType.category === category) ||
    problemTypes[0];
}

/** Contexto da máquina vindo do link do instalador (query string) ou do que o navegador guardou. */
export function readMachineContext() {
  const params = new URLSearchParams(window.location.search);
  const stored = {
    machineName: localStorage.getItem("it_guardian_machine_name") || "",
    assetTag: localStorage.getItem("it_guardian_asset_tag") || "",
    environmentName: localStorage.getItem("it_guardian_environment_name") || ""
  };

  return {
    deviceToken: params.get("device") || "",
    machineName: params.get("machine") || params.get("hostname") || stored.machineName,
    assetTag: params.get("patrimonio") || params.get("assetTag") || stored.assetTag,
    environmentName: params.get("ambiente") || params.get("environment") || stored.environmentName
  };
}

export function buildRelatedAssetText(form) {
  return [
    form.machineName ? `Nome da máquina: ${form.machineName}` : "",
    form.assetTag ? `Patrimônio: ${form.assetTag}` : "",
    form.location ? `Localização: ${form.location}` : ""
  ].filter(Boolean).join(" | ");
}

export function buildInitialForm(machineContext) {
  return {
    title: "",
    description: "",
    category: fallbackCategories[0],
    problemType: fallbackProblemTypes[0].name,
    requesterName: "",
    contactInfo: "",
    department: "",
    extension: "",
    urgency: "normal",
    machineScope: "",
    deviceToken: machineContext.deviceToken,
    assetId: "",
    machineName: machineContext.machineName,
    assetTag: machineContext.assetTag,
    environmentName: machineContext.environmentName || "Não identificado",
    location: "",
    machineNotes: "",
    [honeypotFieldName]: ""
  };
}

/** Opções da API (ou padrão quando vazias) e o modo do sistema. */
export function resolveSupportOptions(data) {
  return {
    categories: data.categories?.length ? data.categories : fallbackCategories,
    problemTypes: data.problemTypes?.length ? data.problemTypes : fallbackProblemTypes,
    systemMode: data.systemMode === "business" ? "business" : "local"
  };
}

/** Mantém categoria/problema do formulário válidos para as opções recebidas. */
export function reconcileFormWithOptions(form, categories, problemTypes) {
  const category = categories.includes(form.category) ? form.category : categories[0] || "";
  return {
    ...form,
    category,
    problemType: findProblemType(problemTypes, form.problemType)?.name ||
      getFirstProblemTypeForCategory(
        problemTypes,
        categories.includes(form.category) ? form.category : categories[0]
      )?.name ||
      ""
  };
}
