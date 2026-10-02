// Regras puras de Ordem de Servico usadas pelos hooks do App.

export function getServiceOrderModeError(payload, systemMode) {
  const title = payload?.title?.trim() || "";
  const description = payload?.description?.trim() || "";
  const category = payload?.category?.trim() || "";
  const requesterName = payload?.requesterName?.trim() || "";

  if (title.length < 3) return "Informe um titulo com pelo menos 3 caracteres.";

  if (systemMode === "business") {
    if (!payload?.environmentId) {
      return "No modo Business, selecione um cliente para abrir a Ordem de Serviço.";
    }
    if (!payload?.assetId) return "No modo Business, vincule uma máquina/ativo à OS.";
    if (!requesterName) return "No modo Business, informe o solicitante.";
    if (!category) return "No modo Business, informe a categoria da OS.";
    if (!description) return "No modo Business, descreva a solicitacao.";
  }

  if (systemMode !== "business") {
    if (!description) return "Informe as observações do problema.";
    if (!category) return "Informe a categoria da OS.";
    if (!requesterName) return "Informe o solicitante.";
  }

  return "";
}

export function isMaintenanceServiceOrder(order) {
  return (
    Boolean(order?.assetId) &&
    String(order?.category || "").trim().toLowerCase() === "manutencao"
  );
}
