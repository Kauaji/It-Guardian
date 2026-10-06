export default function SegmentTitleRow({
  isDefaultSegment, canManage, isSegmentDragging, dnd, displayName, machineCount, health, healthDescription,
  setActivePopoverId, onTitleClick
}) {
  const { dragAttributes, dragListeners, setDragNodeRef } = dnd;
  return (
    <div className="segment-title-row">
      <button
        type="button"
        ref={setDragNodeRef}
        className={`segment-title-drag-handle ${isSegmentDragging ? "dragging" : ""}`}
        title={isDefaultSegment ? "Segmento padrão não pode ser movido" : "Mover segmento"}
        disabled={isDefaultSegment || !canManage}
        {...dragAttributes}
        {...dragListeners}
        onClick={onTitleClick}
        onPointerDown={(event) => {
          setActivePopoverId?.(null);
          dragListeners?.onPointerDown?.(event);
        }}
      >
        <span className="segment-color-mark" aria-hidden="true" />
        <span className="segment-title-copy">
          <h3>{displayName}</h3>
          <span>{machineCount} {machineCount === 1 ? "máquina" : "máquinas"}</span>
        </span>
      </button>
      <span
        className={`segment-health-score ${health.classification}`}
        aria-label={`Nota de saúde do segmento ${displayName}: ${health.score ?? "sem dados"}`}
        title={healthDescription}
        tabIndex={0}
      >
        <span>Nota</span>
        <strong>{health.score ?? "—"}</strong>
      </span>
    </div>
  );
}
