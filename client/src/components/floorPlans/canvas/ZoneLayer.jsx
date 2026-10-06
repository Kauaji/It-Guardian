import RoomRenderer from "../rooms/RoomRenderer.jsx";
import { isPaintAreaZone } from "../utils/paintAreaGeometry.js";
import { isRoomZone } from "../utils/roomGeometry.js";
import { PaintAreaShape } from "./PaintShapes.jsx";

function GenericZone({ zone, selected, onPointerDown, onSelect }) {
  const geometry = zone.geometry || {};
  return (
    <g
      className={`floor-plan-zone ${selected ? "selected" : ""}`}
      onPointerDown={(event) => onPointerDown(event, "zone", zone.id)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect({ type: "zone", id: zone.id });
      }}
    >
      <rect
        x={geometry.x || 0}
        y={geometry.y || 0}
        width={geometry.width || 180}
        height={geometry.height || 120}
        rx="8"
        fill={zone.color}
        opacity={zone.zoneType === "room" ? 0.16 : 0.22}
        stroke={zone.color}
        strokeDasharray={zone.zoneType === "segment" ? "8 7" : "0"}
        strokeWidth={selected ? 4 : 2}
      />
      <text x={(geometry.x || 0) + 12} y={(geometry.y || 0) + 24}>
        {zone.name}
      </text>
    </g>
  );
}

/** Comodos, areas demarcadas e zonas genericas (comodos primeiro). */
export default function ZoneLayer({ zones, selected, plan, onPointerDown, onSelect }) {
  return zones.map((zone) => {
    const zoneSelected = selected?.type === "zone" && selected.id === zone.id;
    if (isRoomZone(zone)) {
      return (
        <RoomRenderer
          key={zone.id}
          zone={zone}
          selected={zoneSelected}
          plan={plan}
          onPointerDown={(event) => onPointerDown(event, "zone", zone.id)}
          onSelect={() => onSelect({ type: "zone", id: zone.id })}
        />
      );
    }
    if (isPaintAreaZone(zone)) {
      return <PaintAreaShape key={zone.id} zone={zone} selected={zoneSelected} onSelect={() => onSelect({ type: "zone", id: zone.id })} />;
    }
    return <GenericZone key={zone.id} zone={zone} selected={zoneSelected} onPointerDown={onPointerDown} onSelect={onSelect} />;
  });
}
