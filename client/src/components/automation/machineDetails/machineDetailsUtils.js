export function recurrenceOriginLabel(source) {
  if (source === "machine") return "Personalizada para esta máquina";
  if (source === "segment") return "Herdada do segmento";
  return "Herdada do plano";
}

// Valores derivados do plano selecionado e do detalhe carregado do servidor.
// Enquanto o detalhe nao chega, usa os dados do proprio plano como contingencia.
export function deriveMachineDetailView(selectedPlan, detail) {
  const displayedSchedule = detail?.schedule || selectedPlan;
  const hasCustomOverride = detail
    ? Boolean(detail.override && detail.override.active !== false)
    : Boolean(selectedPlan.hasCustomOverride);
  const isLastPlanAsset = Number(selectedPlan.assetCount || detail?.plan?.assetCount || 0) <= 1;
  const effectiveOrigin = displayedSchedule.recurrenceSource || (hasCustomOverride ? "machine" : "plan");

  return { displayedSchedule, hasCustomOverride, isLastPlanAsset, effectiveOrigin };
}
