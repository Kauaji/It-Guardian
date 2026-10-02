import FloorPlanObjectGlyph from "../FloorPlanObjectGlyph.jsx";
import { isEditorObjectLocked, isTableObject } from "../utils/editorGeometry.js";
import { isMeasurementObject } from "../utils/measurementGeometry.js";
import { getHeatmapTitle } from "../utils/planPresentation.js";
import { isOpeningObject, isWallObject } from "../utils/wallGeometry.js";

function shouldHideLabel(object) {
  return isTableObject(object) || isWallObject(object) || isOpeningObject(object) || isMeasurementObject(object);
}

function getWallOpenings(object, objects) {
  if (!isWallObject(object)) return [];
  return objects.filter((candidate) => candidate.metadata?.parentObjectId === object.id && isOpeningObject(candidate));
}

function ObjectNode({ object, objects, state, plan, handlers }) {
  const { objectSelected, isNew, heatmap, heatmapMode } = state;
  const objectWidth = object.width || 80;
  const objectHeight = object.height || 56;
  const showHeatmap = heatmapMode.startsWith("heatmap-") && heatmap;
  return (
    <g
      className={`floor-plan-object${objectSelected ? " selected" : ""}${isEditorObjectLocked(object) ? " locked" : ""}${isNew ? " is-new" : ""}`}
      transform={`translate(${object.x || 0} ${object.y || 0})`}
      onPointerDown={(event) => handlers.onPointerDown(event, "object", object.id)}
      onClick={(event) => {
        event.stopPropagation();
        handlers.onSelect({ type: "object", id: object.id }, event);
      }}
    >
      <g transform={`rotate(${object.rotation || 0} ${objectWidth / 2} ${objectHeight / 2})`}>
        {showHeatmap ? <rect className={`floor-plan-heatmap-halo severity-${heatmap.severity}`} x="-12" y="-12" width={objectWidth + 24} height={objectHeight + 24} rx="18" /> : null}
        <rect
          className="floor-plan-object-hit-target"
          x="-3"
          y="-3"
          width={objectWidth + 6}
          height={objectHeight + 6}
          rx="5"
        />
        <FloorPlanObjectGlyph
          object={object}
          width={objectWidth}
          height={objectHeight}
          plan={plan}
          selected={objectSelected}
          openings={getWallOpenings(object, objects)}
        />
        {objectSelected ? <rect className="floor-plan-object-selection-outline" x="-3" y="-3" width={objectWidth + 6} height={objectHeight + 6} rx="5" /> : null}
      </g>
      {!shouldHideLabel(object) ? <text className="floor-plan-object-label" x={objectWidth / 2} y={objectHeight + 15} textAnchor="middle">{object.label}</text> : null}
      {showHeatmap ? <title>{getHeatmapTitle(heatmapMode, heatmap)}</title> : null}
    </g>
  );
}

/**
 * Objetos do pavimento. `view` reune a selecao, o objeto recem-criado e o mapa
 * de calor; `handlers` traz onPointerDown e onSelect.
 */
export default function ObjectLayer({ objects, plan, view, handlers }) {
  const { selected, selectedIdSet, justPlacedObjectId, heatmapByObject, heatmapMode } = view;
  return objects.map((object) => (
    <ObjectNode
      key={object.id}
      object={object}
      objects={objects}
      plan={plan}
      handlers={handlers}
      state={{
        objectSelected: selectedIdSet.has(object.id) || (selected?.type === "object" && selected.id === object.id),
        isNew: object.id === justPlacedObjectId,
        heatmap: heatmapByObject.get(object.id),
        heatmapMode
      }}
    />
  ));
}
