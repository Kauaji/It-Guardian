import { getRoomWalls } from "../utils/roomGeometry.js";

export default function RoomThumbnail({ template }) {
  const zone = {
    zoneType: "room",
    color: template.color,
    geometry: { x: 0, y: 0, width: 120, height: 78 },
    metadata: { room: { wallThickness: 6 } }
  };
  const walls = getRoomWalls(zone);

  return (
    <svg className="room-template-thumbnail" viewBox="0 0 120 78" aria-hidden="true">
      <rect x="0" y="0" width="120" height="78" rx="8" fill={template.color} opacity="0.18" />
      {Object.values(walls).map((wall, index) => (
        <rect key={index} {...wall} fill="#ffffff" stroke={template.color} strokeWidth="1.5" />
      ))}
      {(template.objects || []).slice(0, 4).map((object, index) => (
        <rect
          key={`${object.type}-${index}`}
          x={Math.max(12, Math.min(95, (object.x / template.width) * 108))}
          y={Math.max(12, Math.min(56, (object.y / template.height) * 66))}
          width="13"
          height="10"
          rx="2"
          fill={object.color || "#64748b"}
          opacity="0.8"
        />
      ))}
    </svg>
  );
}
