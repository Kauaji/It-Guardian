import FloorPlanObjectGlyph from "../FloorPlanObjectGlyph.jsx";
import { getObjectSize } from "../utils/editorGeometry.js";
import { parseTypedLengthBuffer, snapMeasurementEndPoint } from "../utils/measurementGeometry.js";
import { formatLength, pxToMeters } from "../utils/unitConversion.js";
import { snapWallEndPoint } from "../utils/wallGeometry.js";

export function WallPlacementPreview({ placement }) {
  if (placement?.kind !== "wall" || !placement.start || !placement.end) return null;
  const snappedEnd = snapWallEndPoint(placement.start, placement.end, placement.gridSize || 5);
  return (
    <g className="floor-plan-wall-preview" pointerEvents="none">
      <line x1={placement.start.x} y1={placement.start.y} x2={snappedEnd.x} y2={snappedEnd.y} />
      <circle cx={placement.start.x} cy={placement.start.y} r="7" />
      <circle cx={snappedEnd.x} cy={snappedEnd.y} r="7" />
      <text x={(placement.start.x + snappedEnd.x) / 2} y={(placement.start.y + snappedEnd.y) / 2 - 12} textAnchor="middle">
        {Math.round(snappedEnd.length)} px / {snappedEnd.angle} graus
      </text>
    </g>
  );
}

export function MeasurementPlacementPreview({ placement, plan }) {
  if (placement?.kind !== "measurement" || !placement.start || !placement.end) return null;
  const snappedEnd = snapMeasurementEndPoint(placement.start, placement.end, {
    constrainAngle: placement.constrainAngle,
    overrideLengthPx: parseTypedLengthBuffer(placement.lengthBuffer, plan)
  });
  const lengthLabel = formatLength(pxToMeters(snappedEnd.length, plan));
  const typedLabel = placement.lengthBuffer ? `Comprimento: ${placement.lengthBuffer}_` : null;
  return (
    <g className="floor-plan-measurement-preview" pointerEvents="none">
      <line x1={placement.start.x} y1={placement.start.y} x2={snappedEnd.x} y2={snappedEnd.y} />
      <circle cx={placement.start.x} cy={placement.start.y} r="6" />
      <circle cx={snappedEnd.x} cy={snappedEnd.y} r="6" />
      <text x={(placement.start.x + snappedEnd.x) / 2} y={(placement.start.y + snappedEnd.y) / 2 - 12} textAnchor="middle">
        {typedLabel || lengthLabel}
      </text>
    </g>
  );
}

function CatalogObjectPreview({ preview, tone }) {
  const object = preview.object;
  if (!object) return null;
  const { width, height } = getObjectSize(object);
  const centerX = Number(object.x || 0) + width / 2;
  const centerY = Number(object.y || 0) + height / 2;
  return (
    <g className={`floor-plan-catalog-placement-preview ${tone}`} pointerEvents="none" transform={`rotate(${Number(object.rotation || 0)} ${centerX} ${centerY})`}>
      <rect className="placement-outline" x={object.x - 5} y={object.y - 5} width={width + 10} height={height + 10} rx="9" />
      <g transform={`translate(${object.x} ${object.y})`} opacity="0.76">
        <FloorPlanObjectGlyph object={object} width={width} height={height} />
      </g>
      <title>{preview.reason || "Clique para posicionar"}</title>
    </g>
  );
}

export function CatalogPlacementPreview({ placement }) {
  const preview = placement?.kind === "catalog" ? placement.preview : null;
  if (!preview) return null;
  const tone = preview.valid ? "valid" : "invalid";

  if (preview.type === "point") {
    return (
      <g className={`floor-plan-catalog-placement-preview ${tone}`} pointerEvents="none">
        <circle cx={preview.point.x} cy={preview.point.y} r="13" />
        <circle cx={preview.point.x} cy={preview.point.y} r="4" fill={preview.color} />
        <title>{preview.reason || "Clique para posicionar"}</title>
      </g>
    );
  }

  if (preview.type === "route") {
    return (
      <g className={`floor-plan-catalog-placement-preview ${tone}`} pointerEvents="none">
        <polyline points={preview.path.map((point) => `${point.x},${point.y}`).join(" ")} />
        <title>{preview.reason || "Clique para posicionar"}</title>
      </g>
    );
  }

  return <CatalogObjectPreview preview={preview} tone={tone} />;
}
