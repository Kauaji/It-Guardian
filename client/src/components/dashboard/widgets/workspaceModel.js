// Regras puras do rascunho de layout do dashboard configurável.
import { reindexWidgetPositions } from "./widgetGridMath.js";

export const DEFAULT_SIZE = { w: "m", h: "s" };
export const DEFAULT_REFRESH_SECONDS = 60;
export const MAX_WIDGETS = 30;

export function createWidgetId() {
  return `widget-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Monta um widget novo (no fim da grade) a partir de um item do catálogo. */
export function buildWidgetFromCatalog(catalogItem, position) {
  return {
    id: createWidgetId(),
    type: catalogItem.type,
    x: 0,
    y: position,
    w: catalogItem.defaultSize?.w || DEFAULT_SIZE.w,
    h: catalogItem.defaultSize?.h || DEFAULT_SIZE.h,
    refreshIntervalSeconds: DEFAULT_REFRESH_SECONDS,
    config: catalogItem.config || {}
  };
}

export function removeWidgetFrom(widgets, widgetId) {
  return reindexWidgetPositions(widgets.filter((widget) => widget.id !== widgetId));
}

export function patchWidgetIn(widgets, widgetId, patch) {
  return widgets.map((widget) => (widget.id === widgetId ? { ...widget, ...patch } : widget));
}

export function replaceWidgetIn(widgets, updatedWidget) {
  return widgets.map((widget) => (widget.id === updatedWidget.id ? updatedWidget : widget));
}
