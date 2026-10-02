import { getObjectSize, isEditorObjectLocked } from "../utils/editorGeometry.js";
import { getObjectResizeHandles } from "../utils/selectionHandles.js";
import { getWallSegment, isWallObject } from "../utils/wallGeometry.js";

function WallEndpointHandles({ object, onResizeStart }) {
  const segment = getWallSegment(object);
  return (
    <g className="floor-plan-object-resize-overlay wall-endpoints">
      {[{ side: "wall-start", ...segment.start }, { side: "wall-end", ...segment.end }].map((handle) => (
        <g key={handle.side} className="floor-plan-object-resize-handle" onPointerDown={(event) => onResizeStart(event, object.id, handle.side)}>
          <circle cx={handle.x} cy={handle.y} r="10" />
        </g>
      ))}
    </g>
  );
}

/** Contorno e alcas de redimensionamento do objeto selecionado (nada se estiver travado). */
export default function ObjectSelectionOverlay({ object, onResizeStart }) {
  if (!object) return null;
  if (isEditorObjectLocked(object)) return null;
  if (isWallObject(object)) return <WallEndpointHandles object={object} onResizeStart={onResizeStart} />;
  const { width, height } = getObjectSize(object);
  const x = Number(object.x || 0);
  const y = Number(object.y || 0);
  return (
    <g className="floor-plan-object-resize-overlay" transform={`rotate(${Number(object.rotation || 0)} ${x + width / 2} ${y + height / 2})`}>
      <rect x={x - 3} y={y - 3} width={width + 6} height={height + 6} rx="10" />
      {getObjectResizeHandles(object).map((handle) => (
        <g
          className={`floor-plan-object-resize-handle ${handle.side}`}
          key={handle.side}
          onPointerDown={(event) => onResizeStart(event, object.id, handle.side)}
          aria-label={handle.label}
        >
          <circle cx={handle.x} cy={handle.y} r={7} />
        </g>
      ))}
    </g>
  );
}
