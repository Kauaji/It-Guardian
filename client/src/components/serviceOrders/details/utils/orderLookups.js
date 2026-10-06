// Rotulos de situacao e setores disponiveis para a OS.

export const fallbackStatusLabels = {
  open: "Aberta",
  in_progress: "Em atendimento",
  waiting: "Aguardando",
  closed: "Finalizada"
};

export const GENERAL_SECTOR_ID = "sector-geral";

export function buildStatusOptions(statuses) {
  return statuses.length ? statuses : Object.entries(fallbackStatusLabels).map(([id, name]) => ({ id, name }));
}

export function buildStatusLabelMap(statusOptions) {
  return {
    ...fallbackStatusLabels,
    ...Object.fromEntries(statusOptions.map((status) => [status.id, status.name]))
  };
}

export function buildAvailableSectors(sectors) {
  const byId = new Map([[GENERAL_SECTOR_ID, { id: GENERAL_SECTOR_ID, name: "Geral", active: true }]]);
  for (const sector of sectors) {
    if (sector?.id && sector.active !== false) byId.set(sector.id, sector);
  }
  return [...byId.values()];
}

/** Setor escolhido (ou o Geral quando o id nao existe) no formato enviado a OS. */
export function resolveSectorUpdate(availableSectors, sectorId) {
  const sector = availableSectors.find((item) => item.id === sectorId) || availableSectors.find((item) => item.id === GENERAL_SECTOR_ID);
  return {
    sectorId: sector?.id || GENERAL_SECTOR_ID,
    sectorName: sector?.name || "Geral"
  };
}

export function buildDeleteMessage(serviceOrder) {
  const baseMessage = "Tem certeza que deseja excluir esta Ordem de Serviço? Essa ação não poderá ser desfeita.";
  const inProgressMessage = serviceOrder.closedAt ? "" : "\n\nEsta OS ainda não foi finalizada. Deseja excluir mesmo assim?";
  return `${baseMessage}${inProgressMessage}`;
}
