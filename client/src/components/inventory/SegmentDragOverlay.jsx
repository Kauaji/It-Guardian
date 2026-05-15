export default function SegmentDragOverlay({ segment, count = 0, groupName = "" }) {
  if (!segment) return null;

  const machineLabel = count === 1 ? "maquina" : "maquinas";

  return (
    <div
      className="segment-drag-overlay"
      style={{ "--segment-color": segment.color || "#1f7a61" }}
    >
      <span className="segment-drag-overlay-dot" aria-hidden="true" />
      <strong>{segment.name}</strong>
      <small>{count} {machineLabel}</small>
      {groupName && <em>{groupName}</em>}
    </div>
  );
}
