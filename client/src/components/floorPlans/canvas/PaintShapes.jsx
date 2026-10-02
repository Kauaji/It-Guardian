import { getPaintCellSize, getPaintCells, parseCellKey } from "../utils/paintAreaGeometry.js";

export function paintCellsPath(cells, cellSize) {
  return cells.map((key) => {
    const { column, row } = parseCellKey(key);
    const x = column * cellSize;
    const y = row * cellSize;
    return `M${x} ${y}h${cellSize}v${cellSize}h-${cellSize}Z`;
  }).join(" ");
}

function getPaintLabelPosition(cells, cellSize) {
  const parsedCells = cells.map(parseCellKey);
  const columns = parsedCells.map((cell) => cell.column);
  const rows = parsedCells.map((cell) => cell.row);
  return {
    x: ((Math.min(...columns) + Math.max(...columns) + 1) * cellSize) / 2,
    y: ((Math.min(...rows) + Math.max(...rows) + 1) * cellSize) / 2
  };
}

/** Area de grupo/segmento ja salva, desenhada como mascara de celulas. */
export function PaintAreaShape({ zone, selected, onSelect }) {
  const cells = getPaintCells(zone);
  const cellSize = getPaintCellSize(zone);
  if (!cells.length) return null;
  const label = getPaintLabelPosition(cells, cellSize);
  return (
    <g className={`floor-plan-paint-area ${zone.zoneType} ${selected ? "selected" : ""}`}>
      <path
        d={paintCellsPath(cells, cellSize)}
        fill={zone.color || (zone.zoneType === "segment" ? "#22c55e" : "#8b5cf6")}
        fillOpacity={zone.zoneType === "segment" ? 0.32 : 0.2}
        stroke={zone.color || "#8b5cf6"}
        strokeWidth={selected ? 3 : 1.5}
        strokeDasharray={zone.zoneType === "segment" ? "6 4" : undefined}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.();
        }}
      />
      <text className="floor-plan-paint-area-label" x={label.x} y={label.y} textAnchor="middle">
        {zone.name}
      </text>
      <title>{zone.name}</title>
    </g>
  );
}

/** Demarcacao temporaria (ainda nao confirmada) do pincel. */
export function PaintDraftOverlay({ paintDraft }) {
  return (
    <path
      className="floor-plan-paint-draft"
      d={paintCellsPath(paintDraft.cells, paintDraft.cellSize)}
      fill={paintDraft.color}
      fillOpacity={paintDraft.areaType === "segment" ? 0.38 : 0.26}
      stroke={paintDraft.color}
      strokeDasharray="6 4"
      strokeWidth="2"
      pointerEvents="none"
    />
  );
}
