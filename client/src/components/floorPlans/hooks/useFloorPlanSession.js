import { useCallback, useEffect, useState } from "react";
import {
  createFloorPlan,
  deleteFloorPlan,
  duplicateFloorPlan,
  fetchFloorPlan,
  fetchFloorPlans,
  updateFloorPlan
} from "../../../api.js";
import { DEFAULT_PLAN_SIZE, normalizeResponsePlan } from "../utils/editorGeometry.js";
import { PLANS_LIST_PATH, buildPlanPath, parsePlanRoute, resolvePlanToOpen } from "../utils/planRoutes.js";

/** Plantas da aba de inventario: se nao ha nenhuma, adota a planta antiga sem aba (migracao). */
async function fetchPlansForTab({ token, activeTab, canUpdate }) {
  const payload = await fetchFloorPlans(token, activeTab?.id || "");
  const plans = payload.plans || [];
  if (plans.length || !activeTab?.id || !canUpdate) return plans;

  const legacyPayload = await fetchFloorPlans(token);
  const legacyPlan = (legacyPayload.plans || []).find((plan) => !plan.inventoryTabId);
  if (!legacyPlan) return plans;
  const claimedPayload = await updateFloorPlan(token, legacyPlan.id, {
    inventoryTabId: activeTab.id,
    name: `Planta ${activeTab.name || "principal"}`
  });
  const claimedEditor = normalizeResponsePlan(claimedPayload);
  return claimedEditor?.plan?.id ? [claimedEditor.plan] : [];
}

/** Mantem a URL (/plantas, /plantas/:id, /plantas/:id/editor) coerente com a tela. */
function useFloorPlanUrlSync({ view, editor, isEditing }) {
  useEffect(() => {
    if (view === "list") {
      if (!editor && parsePlanRoute(window.location.pathname)) return;
      window.history.replaceState(null, "", PLANS_LIST_PATH);
    } else if (editor?.plan?.id) {
      window.history.replaceState(null, "", buildPlanPath(editor.plan.id, isEditing));
    }
  }, [editor, isEditing, view]);
}

/**
 * Lista de plantas e navegacao entre lista e editor: carregar, abrir, criar,
 * duplicar e excluir. `doc`, `ui` e `tracker` sao zerados ao trocar de planta.
 */
export function useFloorPlanSession({ token, activeTab, permissions, notify, doc, ui, tracker }) {
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const [view, setView] = useState("list");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const { editor, setEditor, setActiveFloorId, loadEditor } = doc;
  const { setSelected, setSelectedObjectIds, setPlacement, setPaintDraft, setZoomMode } = ui;
  const { resetTracking } = tracker;

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setError("");
    try {
      setPlans(await fetchPlansForTab({ token, activeTab, canUpdate: permissions.update }));
    } catch (requestError) {
      setError(requestError.message);
      notify?.(requestError.message, "danger");
    } finally {
      setPlansLoading(false);
    }
  }, [activeTab?.id, activeTab?.name, notify, permissions.update, token]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    setPlans([]);
    setView("list");
    setIsEditing(false);
    setEditor(null);
    setSelected(null);
  }, [activeTab?.id]);

  useFloorPlanUrlSync({ view, editor, isEditing });

  const openPlan = useCallback(async (id, editing = false) => {
    setPlansLoading(true);
    setError("");
    try {
      const loaded = normalizeResponsePlan(await fetchFloorPlan(token, id));
      loadEditor(loaded);
      resetTracking();
      setSelected(null);
      setIsEditing(editing);
      setView("editor");
    } catch (requestError) {
      setError(requestError.message);
      notify?.(requestError.message, "danger");
    } finally {
      setPlansLoading(false);
    }
  }, [notify, token]);

  useEffect(() => {
    if (!plansLoading && view === "list" && plans.length > 0) {
      const target = resolvePlanToOpen(plans, window.location.pathname);
      openPlan(target.planId, target.editing);
    }
  }, [openPlan, plans, plansLoading, view]);

  const createNewPlan = useCallback(async () => {
    if (!permissions.create) return;
    setPlansLoading(true);
    try {
      const payload = await createFloorPlan(token, {
        name: `Planta ${activeTab?.name || "principal"}`,
        inventoryTabId: activeTab?.id || null,
        company: "IT Guardian",
        unit: "Unidade principal",
        floorLabel: "Planta 1",
        status: "draft",
        ...DEFAULT_PLAN_SIZE
      });
      const created = normalizeResponsePlan(payload);
      setPlans((current) => [created.plan, ...current]);
      setEditor(created);
      setActiveFloorId(created?.plan?.activeFloorId || created?.floors?.[0]?.id || "");
      setIsEditing(true);
      setView("editor");
      notify?.("Planta criada.", "ok");
    } catch (requestError) {
      notify?.(requestError.message, "danger");
    } finally {
      setPlansLoading(false);
    }
  }, [activeTab?.id, activeTab?.name, notify, permissions.create, token]);

  const duplicatePlan = useCallback(async (id) => {
    try {
      const duplicated = normalizeResponsePlan(await duplicateFloorPlan(token, id));
      setPlans((current) => [duplicated.plan, ...current]);
      notify?.("Planta duplicada.", "ok");
    } catch (requestError) {
      notify?.(requestError.message, "danger");
    }
  }, [notify, token]);

  const removePlan = useCallback(async (plan) => {
    if (!window.confirm(`Excluir a planta "${plan.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteFloorPlan(token, plan.id);
      setPlans((current) => current.filter((entry) => entry.id !== plan.id));
      if (editor?.plan?.id === plan.id) {
        setEditor(null);
        setSelected(null);
        setSelectedObjectIds([]);
        setPlacement(null);
        setPaintDraft(null);
        setZoomMode(false);
        setView("list");
      }
      notify?.("Planta removida.", "ok");
    } catch (requestError) {
      notify?.(requestError.message, "danger");
    }
  }, [editor?.plan?.id, notify, token]);

  /** Reflete na lista os dados atualizados de uma planta recem-salva. */
  const applySavedPlan = useCallback((updated) => {
    setPlans((current) => current.map((plan) => (plan.id === updated.plan.id ? { ...plan, ...updated.plan } : plan)));
  }, []);

  return {
    plans,
    plansLoading,
    listQuery,
    setListQuery,
    view,
    isEditing,
    setIsEditing,
    error,
    setError,
    loadPlans,
    openPlan,
    createNewPlan,
    duplicatePlan,
    removePlan,
    applySavedPlan
  };
}
