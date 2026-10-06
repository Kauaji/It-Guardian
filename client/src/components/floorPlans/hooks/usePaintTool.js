import { useMemo, useRef } from "react";
import { createId } from "../utils/ids.js";
import { isPaintAreaZone } from "../utils/paintAreaGeometry.js";
import {
  addPaintAreaToDraft,
  applyPaintAtPoint,
  createGroupPaintDraft,
  createSegmentPaintDraft,
  reducePaintDraftPatch,
  resolvePaintConfirmation
} from "../utils/paintDraft.js";

/**
 * Ferramentas de pincel de grupo e de segmento: rascunho da demarcacao,
 * pincel/borracha/balde e confirmacao da area.
 */
export function usePaintTool({ doc, ui, groups, segments, notify }) {
  const { editor, activeFloorId, commitEditor } = doc;
  const {
    paintDraft, setPaintDraft, setSelectedTool, setSelected, setSelectedObjectIds,
    setSelectionBox, setPlacement, setMode, setActiveCatalog
  } = ui;
  const paintPointerRef = useRef(false);

  const savedGroupAreas = useMemo(() => (editor?.zones || []).filter((zone) => (
    zone.floorId === activeFloorId && zone.zoneType === "group" && isPaintAreaZone(zone)
  )), [activeFloorId, editor?.zones]);

  const stopPainting = () => {
    setPaintDraft(null);
    paintPointerRef.current = false;
  };

  const startGroupBrush = () => {
    setMode("2d");
    setPaintDraft(createGroupPaintDraft(groups));
  };

  /** Retorna false quando nao ha area de grupo onde demarcar segmentos. */
  const startSegmentBrush = () => {
    const parentArea = savedGroupAreas[0] || null;
    if (!parentArea) {
      notify?.("Crie uma área de grupo antes de demarcar segmentos.", "warning");
      setSelectedTool("select");
      setPaintDraft(null);
      return false;
    }
    setMode("2d");
    setPaintDraft(createSegmentPaintDraft(parentArea, segments));
    return true;
  };

  /** Troca a ferramenta ativa (selecionar, excluir, pincel de grupo/segmento). */
  const handleToolChange = (tool) => {
    setPlacement(null);
    setSelectionBox(null);
    setSelectedObjectIds([]);
    const isBrush = tool === "group-brush" || tool === "segment-brush";
    if (isBrush) setSelected(null);
    if (tool === "group-brush") {
      startGroupBrush();
    } else if (tool === "segment-brush") {
      if (!startSegmentBrush()) return;
    } else {
      stopPainting();
    }
    setSelectedTool(tool);
    if (isBrush) setActiveCatalog("brushes");
  };

  const updatePaintDraft = (patch) => {
    setPaintDraft((current) => (
      current ? reducePaintDraftPatch(current, patch, { groups, segments, savedGroupAreas }) : current
    ));
  };

  const applyPaint = (point) => {
    setPaintDraft((current) => {
      if (!current) return current;
      const { draft, warning } = applyPaintAtPoint(current, point, {
        savedGroupAreas,
        zones: editor?.zones,
        activeFloorId
      });
      if (warning) notify?.(warning, "warning");
      return draft;
    });
  };

  const confirmPaintArea = () => {
    const resolved = resolvePaintConfirmation(paintDraft, { groups, segments, savedGroupAreas });
    if (resolved.error) {
      notify?.(resolved.error, "warning");
      return;
    }
    let createdAreaId = null;
    commitEditor((draft) => {
      createdAreaId = addPaintAreaToDraft({ draft, paintDraft, activeFloorId, resolved, createId });
      return draft;
    });
    setPaintDraft(null);
    setSelectedTool("select");
    if (createdAreaId) setSelected({ type: "zone", id: createdAreaId });
    notify?.("Área demarcada e vinculada com sucesso.", "ok");
  };

  const cancelPaintArea = () => {
    if (paintDraft?.cells?.length && !window.confirm("Cancelar demarcação atual?")) return;
    stopPainting();
    setSelectedTool("select");
  };

  return {
    paintDraft,
    paintPointerRef,
    savedGroupAreas,
    handleToolChange,
    updatePaintDraft,
    applyPaint,
    confirmPaintArea,
    cancelPaintArea
  };
}
