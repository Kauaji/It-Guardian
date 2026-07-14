import { getRoomInterior, getRoomMeasurements } from "../utils/roomGeometry.js";

function formatMeters(value) {
  return `${Number(value || 0).toFixed(1).replace(".", ",")} m`;
}

export default function RoomRenderer({ zone, selected, plan, onPointerDown, onSelect }) {
  const geometry = zone.geometry || {};
  const interior = getRoomInterior(zone);
  const measurements = getRoomMeasurements(zone, plan);

  return (
    <g
      className={`floor-plan-room ${selected ? "selected" : ""}`}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
    >
      <rect
        x={geometry.x || 0}
        y={geometry.y || 0}
        width={geometry.width || 180}
        height={geometry.height || 120}
        rx="10"
        fill={zone.color}
        opacity="0.14"
        stroke={zone.color}
        strokeWidth={selected ? 3.5 : 2}
      />
      <rect x={interior.x} y={interior.y} width={interior.width} height={interior.height} rx="4" fill="#f8fafc" opacity="0.68" />
      <text className="floor-plan-room-name" x={(geometry.x || 0) + 14} y={(geometry.y || 0) + 26}>{zone.name}</text>
      {selected && (
        <text className="floor-plan-room-dimensions" x={(geometry.x || 0) + 14} y={(geometry.y || 0) + (geometry.height || 120) - 14}>
          {formatMeters(measurements.widthMeters)} x {formatMeters(measurements.heightMeters)}
        </text>
      )}
    </g>
  );
}
