/**
 * Contexto unico consumido por TopologyCanvasLevel: junta os resultados dos hooks do mapa
 * (dados, visibilidade, mutacoes, interacoes) com navegacao, selecao e permissoes.
 */
export function buildTopologyViewContext({
  mapData,
  visibility,
  mutations,
  interactions,
  nav,
  selection,
  layout,
  linkCreation,
  canvasRef,
  devicesById,
  displayNodes,
  segments,
  filters,
  setFilters,
  canManageMap,
  canLinkAssets,
  canEditMap,
  onOpenDetails
}) {
  const { dirtyPositions, saving, generatingLayout } = layout;
  return {
    ...mapData,
    ...visibility,
    ...mutations,
    ...interactions,
    nav,
    selection,
    layout,
    linkCreation,
    linkBusy: linkCreation.active || linkCreation.busy,
    layoutBusy: saving || generatingLayout,
    viewLevel: nav.viewLevel,
    canvasRef,
    devicesById,
    displayNodes,
    segments,
    filters,
    setFilters,
    dirtyPositions,
    saving,
    generatingLayout,
    editMode: selection.editMode,
    canManageMap,
    canLinkAssets,
    canEditMap,
    onOpenDetails
  };
}
