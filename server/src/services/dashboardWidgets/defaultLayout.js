/**
 * Layout inicial para todo usuario sem preferencia salva. Mapeia as secoes
 * de hoje do DashboardPage.jsx fixo para widgets equivalentes -- KPI strip +
 * saude da infraestrutura -> status_overview, cards de resumo de ativos ->
 * asset_availability, os 6 graficos -> service_orders_by_status,
 * alerts_by_severity, as 5 listas de ranking -> top_assets_(cpu,ram,disk),
 * critical_assets, recent_events. Os widgets de metrica por ativo (grafico/gauge) exigem um
 * assetId especifico e por isso nao entram no padrao -- nao existe "o"
 * ativo universal para um layout que serve qualquer usuario.
 *
 * x/y sao apenas a ordem de exibicao (o grid do frontend empacota por
 * densidade a partir da largura de cada widget, nao de coordenadas livres
 * de pixel) -- por isso x fica sempre 0 e y e so o indice sequencial.
 */
const DEFAULT_WIDGETS = [
  { type: "status_overview", w: "l", h: "s" },
  { type: "asset_availability", w: "m", h: "s" },
  { type: "current_problems", w: "m", h: "m" },
  { type: "service_orders_overdue", w: "m", h: "m" },
  { type: "service_orders_by_status", w: "m", h: "m" },
  { type: "alerts_by_severity", w: "m", h: "s" },
  { type: "service_orders_sla", w: "m", h: "s" },
  { type: "top_assets_cpu", w: "m", h: "m" },
  { type: "top_assets_ram", w: "m", h: "m" },
  { type: "top_assets_disk", w: "m", h: "m" },
  { type: "critical_assets", w: "m", h: "m" },
  { type: "recent_events", w: "l", h: "m" }
];

const DEFAULT_REFRESH_SECONDS = 60;

export function getDefaultDashboardLayout() {
  return {
    widgets: DEFAULT_WIDGETS.map((widget, index) => ({
      id: `default-${widget.type}`,
      type: widget.type,
      x: 0,
      y: index,
      w: widget.w,
      h: widget.h,
      refreshIntervalSeconds: DEFAULT_REFRESH_SECONDS,
      config: {}
    }))
  };
}
