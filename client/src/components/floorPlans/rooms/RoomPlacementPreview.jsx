import RoomRenderer from "./RoomRenderer.jsx";

export default function RoomPlacementPreview({ preview, plan }) {
  if (!preview?.zone) return null;
  return (
    <g className={`room-placement-preview ${preview.valid ? "valid" : "invalid"}`}>
      <RoomRenderer zone={preview.zone} selected={false} plan={plan} />
      <text x={preview.zone.geometry.x + 12} y={preview.zone.geometry.y - 12}>
        {preview.valid ? "Clique para posicionar" : "Area indisponivel"}
      </text>
    </g>
  );
}
