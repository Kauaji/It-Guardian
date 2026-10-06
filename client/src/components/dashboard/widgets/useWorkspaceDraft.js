import { useState } from "react";
import {
  buildWidgetFromCatalog,
  patchWidgetIn,
  removeWidgetFrom,
  replaceWidgetIn
} from "./workspaceModel.js";

/**
 * Estado de edição do dashboard: o modo edição opera sobre uma cópia local
 * (draft) dos widgets, só persistida em "Salvar"; "Cancelar" descarta o draft.
 */
export function useWorkspaceDraft({ layout, saveLayout, resetLayout, notify }) {
  const [editing, setEditing] = useState(false);
  const [draftWidgets, setDraftWidgets] = useState([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [configuringWidget, setConfiguringWidget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [arranging, setArranging] = useState(false);

  const activeWidgets = editing ? draftWidgets : layout?.widgets || [];

  function enterEditMode() {
    setDraftWidgets(layout?.widgets || []);
    setEditing(true);
    setArranging(false);
  }

  function cancelEditing() {
    setEditing(false);
    setDraftWidgets([]);
    setArranging(false);
  }

  async function persistDraft() {
    setSaving(true);
    try {
      await saveLayout({ widgets: draftWidgets });
      setLastLoadedAt(new Date().toISOString());
      setEditing(false);
      setArranging(false);
      notify?.("Layout do dashboard salvo.", "ok");
    } catch (saveError) {
      notify?.(saveError.message || "Não foi possível salvar o layout.", "danger");
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefault() {
    setSaving(true);
    try {
      const result = await resetLayout();
      setDraftWidgets(result.widgets);
      setLastLoadedAt(new Date().toISOString());
      notify?.("Layout restaurado para o padrão.", "ok");
    } catch (resetError) {
      notify?.(resetError.message || "Não foi possível restaurar o layout padrão.", "danger");
    } finally {
      setSaving(false);
    }
  }

  function addWidgetFromCatalog(catalogItem) {
    const newWidget = buildWidgetFromCatalog(catalogItem, draftWidgets.length);
    setDraftWidgets((current) => [...current, newWidget]);
    setCatalogOpen(false);
    if (catalogItem.requiresAssetConfig) setConfiguringWidget(newWidget);
  }

  function removeWidget(widgetId) {
    setDraftWidgets((current) => removeWidgetFrom(current, widgetId));
  }

  function resizeWidget(widgetId, sizePatch) {
    setDraftWidgets((current) => patchWidgetIn(current, widgetId, sizePatch));
  }

  function saveWidgetConfig(updatedWidget) {
    setDraftWidgets((current) => replaceWidgetIn(current, updatedWidget));
    setConfiguringWidget(null);
  }

  return {
    editing,
    draftWidgets,
    setDraftWidgets,
    catalogOpen,
    setCatalogOpen,
    configuringWidget,
    setConfiguringWidget,
    saving,
    lastLoadedAt,
    arranging,
    setArranging,
    activeWidgets,
    enterEditMode,
    cancelEditing,
    persistDraft,
    restoreDefault,
    addWidgetFromCatalog,
    removeWidget,
    resizeWidget,
    saveWidgetConfig
  };
}
