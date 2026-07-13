import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, RotateCw, Trash2 } from "lucide-react";
import { getRoomGeometry, getRoomMeasurements } from "../utils/roomGeometry.js";

function SvgIcon({ Icon, x, y, size = 18 }) {
  return (
    <foreignObject x={x - size / 2} y={y - size / 2} width={size} height={size}>
      <Icon size={size} />
    </foreignObject>
  );
}

function formatArea(value) {
  return `${Number(value || 0).toFixed(1).replace(".", ",")} m2`;
}

export default function RoomSelectionOverlay({ zone, plan, onResizeStart, onDuplicate, onDelete, onRotate }) {
  if (!zone) return null;
  const geometry = getRoomGeometry(zone);
  const measurements = getRoomMeasurements(zone, plan);
  const midX = geometry.x + geometry.width / 2;
  const midY = geometry.y + geometry.height / 2;
  const handles = [
    { side: "north", x: midX, y: geometry.y - 22, Icon: ArrowUp },
    { side: "east", x: geometry.x + geometry.width + 22, y: midY, Icon: ArrowRight },
    { side: "south", x: midX, y: geometry.y + geometry.height + 22, Icon: ArrowDown },
    { side: "west", x: geometry.x - 22, y: midY, Icon: ArrowLeft }
  ];
  const toolbarX = Math.max(8, Math.min(geometry.x + geometry.width - 132, geometry.x + 14));
  const toolbarY = Math.max(geometry.y - 48, 8);

  return (
    <g className="room-selection-overlay">
      {handles.map(({ side, x, y, Icon }) => (
        <g
          key={side}
          className="room-resize-handle"
          onPointerDown={(event) => onResizeStart(event, zone.id, side)}
          role="button"
          aria-label={`Redimensionar ${side}`}
        >
          <circle cx={x} cy={y} r="16" />
          <SvgIcon Icon={Icon} x={x} y={y} size={17} />
        </g>
      ))}

      <g className="room-floating-toolbar" transform={`translate(${toolbarX} ${toolbarY})`}>
        <rect width="132" height="36" rx="12" />
        <text x="10" y="23">{formatArea(measurements.areaMeters)}</text>
        <g onPointerDown={(event) => { event.stopPropagation(); onRotate?.(); }} transform="translate(62 8)">
          <rect width="22" height="22" rx="6" />
          <SvgIcon Icon={RotateCw} x={11} y={11} size={15} />
        </g>
        <g onPointerDown={(event) => { event.stopPropagation(); onDuplicate?.(); }} transform="translate(86 8)">
          <rect width="22" height="22" rx="6" />
          <SvgIcon Icon={Copy} x={11} y={11} size={15} />
        </g>
        <g onPointerDown={(event) => { event.stopPropagation(); onDelete?.(); }} transform="translate(110 8)">
          <rect width="22" height="22" rx="6" />
          <SvgIcon Icon={Trash2} x={11} y={11} size={15} />
        </g>
      </g>
    </g>
  );
}
