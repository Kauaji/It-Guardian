// Modelo puro do formulario de nova OS: valores iniciais, validacao e payload.

export const priorities = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" }
];

export const GENERAL_SECTOR_ID = "sector-geral";
export const defaultSectors = [{ id: GENERAL_SECTOR_ID, name: "Geral" }];

export function getDeviceContext(device) {
  const groupName = device.groupName || device.segmentGroupName || device.segmentGroup || device.group?.name || "";
  const segmentName = device.segmentName || device.segment?.name || "";
  return [groupName, segmentName].filter(Boolean).join(" / ");
}

/** Campos que voltam ao valor inicial sempre que o formulario abre. */
export function buildResetFields({ businessMode, activeTab, serviceOrderSettings }) {
  return {
    environmentId: businessMode ? "" : activeTab?.id || "",
    title: "",
    description: "",
    priority: "medium",
    assetId: "",
    requesterName: "",
    assignedTechnicianName: "",
    assignedTechnicianNames: [],
    sectorId: GENERAL_SECTOR_ID,
    autoPriorityEnabled: Boolean(serviceOrderSettings?.autoPriority?.enabled),
    category: ""
  };
}

export function buildInitialForm(serviceOrderSettings) {
  return {
    title: "",
    description: "",
    priority: "medium",
    assetId: "",
    environmentId: "",
    requesterName: "",
    assignedTechnicianName: "",
    assignedTechnicianNames: [],
    sectorId: GENERAL_SECTOR_ID,
    autoPriorityEnabled: Boolean(serviceOrderSettings?.autoPriority?.enabled),
    category: ""
  };
}

/** Inclui ou remove um tecnico; o primeiro da lista passa a ser o principal. */
export function toggleTechnician(form, name) {
  const selected = form.assignedTechnicianNames || [];
  const assignedTechnicianNames = selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name];
  return { ...form, assignedTechnicianNames, assignedTechnicianName: assignedTechnicianNames[0] || "" };
}

export function resolveSector(availableSectors, sectorId) {
  return (
    availableSectors.find((sector) => sector.id === sectorId) ||
    availableSectors.find((sector) => sector.name === "Geral") ||
    availableSectors[0]
  );
}

/** Mensagem do primeiro campo invalido, ou "" quando o formulario pode ser enviado. */
export function validateServiceOrderForm({ title, description, requesterName, category, assetId, businessMode, selectedClient }) {
  if (title.length < 3) return "Informe um título com pelo menos 3 caracteres.";

  if (businessMode) {
    if (!selectedClient) return "No modo Business, selecione um cliente para abrir a Ordem de Serviço.";
    if (!assetId) return "No modo Business, vincule uma máquina/ativo à OS.";
    if (!requesterName) return "No modo Business, informe o solicitante.";
    if (!category) return "No modo Business, informe a categoria da OS.";
    if (!description) return "No modo Business, descreva a solicitação.";
    return "";
  }

  if (!description || !category || !requesterName) return "Informe descrição, categoria e solicitante para criar a OS.";
  return "";
}

export function buildSubmitPayload({ form, fields, businessMode, selectedClient, selectedEnvironment, selectedSector }) {
  return {
    ...form,
    title: fields.title,
    description: fields.description,
    requesterName: fields.requesterName,
    assignedTechnicianName: form.assignedTechnicianNames[0] || "",
    assignedTechnicianNames: form.assignedTechnicianNames,
    category: fields.category,
    notes: "",
    sectorId: selectedSector?.id || GENERAL_SECTOR_ID,
    sectorName: selectedSector?.name || "Geral",
    environmentName: businessMode ? selectedClient?.tradeName || selectedClient?.legalName || "" : selectedEnvironment?.name || ""
  };
}
