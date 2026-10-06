import { useState } from "react";
import { Check, Eraser, PaintBucket, Paintbrush, SlidersVertical, X } from "lucide-react";
import { filterCompatibleSegments } from "../utils/infrastructure.js";

function PaintModeSwitch({ mode, onChange }) {
  return (
    <div className="segmented-control compact floor-plan-paint-modes">
      <button className={mode === "brush" ? "active" : ""} type="button" onClick={() => onChange({ mode: "brush" })} title="Pincel"><Paintbrush size={16} /></button>
      <button className={mode === "bucket" ? "active" : ""} type="button" onClick={() => onChange({ mode: "bucket" })} title="Completar cômodo"><PaintBucket size={16} /></button>
      <button className={mode === "eraser" ? "active" : ""} type="button" onClick={() => onChange({ mode: "eraser" })} title="Borracha"><Eraser size={16} /></button>
    </div>
  );
}

function BrushSizeControl({ brushSize, open, onToggle, onChange }) {
  return (
    <div className="floor-plan-brush-size-control">
      <button
        className={`icon-button ${open ? "active" : ""}`}
        type="button"
        onClick={onToggle}
        title="Ajustar tamanho do pincel e da borracha"
        aria-label="Ajustar tamanho do pincel e da borracha"
        aria-expanded={open}
      >
        <SlidersVertical size={17} />
      </button>
      {open && (
        <div className="floor-plan-brush-size-popover">
          <span>Menor</span>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={brushSize}
            onChange={(event) => onChange({ brushSize: Number(event.target.value) })}
            aria-label="Tamanho do pincel e da borracha"
            orient="vertical"
          />
          <span>Maior</span>
        </div>
      )}
    </div>
  );
}

function SegmentFields({ draft, groupAreas, segments, onChange }) {
  const parentArea = groupAreas.find((area) => area.id === draft.parentAreaId) || null;
  const compatibleSegments = filterCompatibleSegments(segments, parentArea?.groupId);
  return (
    <>
      <label>
        Área de grupo
        <select value={draft.parentAreaId || ""} onChange={(event) => onChange({ parentAreaId: event.target.value, cells: [] })}>
          {groupAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
        </select>
      </label>
      <label>
        Segmento
        <select value={draft.segmentId || ""} onChange={(event) => onChange({ segmentId: event.target.value })}>
          <option value="">Selecione</option>
          {compatibleSegments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
        </select>
      </label>
    </>
  );
}

export default function PaintToolPanel({ draft, groups, segments, groupAreas, onChange, onConfirm, onCancel }) {
  const [sizeControlOpen, setSizeControlOpen] = useState(false);
  if (!draft) return null;
  const isSegment = draft.areaType === "segment";

  return (
    <section className="floor-plan-paint-panel" aria-label={isSegment ? "Pincel de segmento" : "Pincel de grupo"}>
      <div className="floor-plan-paint-panel-title">
        <Paintbrush size={18} />
        <div>
          <strong>{isSegment ? "Demarcar segmento" : "Demarcar grupo"}</strong>
          <span>{draft.cells.length} bloco(s) na demarcação temporária</span>
        </div>
      </div>
      <PaintModeSwitch mode={draft.mode} onChange={onChange} />
      <BrushSizeControl
        brushSize={draft.brushSize}
        open={sizeControlOpen}
        onToggle={() => setSizeControlOpen((open) => !open)}
        onChange={onChange}
      />
      {isSegment ? (
        <SegmentFields draft={draft} groupAreas={groupAreas} segments={segments} onChange={onChange} />
      ) : (
        <label>
          Grupo
          <select value={draft.groupId || ""} onChange={(event) => onChange({ groupId: event.target.value })}>
            <option value="">Selecione</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
      )}
      <div className="floor-plan-paint-actions">
        <button className="icon-button primary-action" type="button" onClick={onConfirm} title="Confirmar área" aria-label="Confirmar área">
          <Check size={18} />
        </button>
        <button className="icon-button secondary-action" type="button" onClick={onCancel} title="Cancelar área" aria-label="Cancelar área">
          <X size={18} />
        </button>
      </div>
    </section>
  );
}
