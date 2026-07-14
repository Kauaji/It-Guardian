const DEFAULT_CELL_SIZE = 20;

function uniqueCells(cells = []) {
  return [...new Set(cells.filter(Boolean))].sort();
}

export function cellKey(column, row) {
  return `${column}:${row}`;
}

export function parseCellKey(key) {
  const [column, row] = String(key || "0:0").split(":").map(Number);
  return { column, row };
}

export function isPaintAreaZone(zone) {
  return zone?.geometry?.kind === "paint-mask" && ["group", "segment"].includes(zone?.zoneType);
}

export function getPaintCells(zone) {
  return uniqueCells(zone?.geometry?.cells || []);
}

export function getPaintCellSize(zoneOrDraft) {
  return Math.max(5, Number(zoneOrDraft?.geometry?.cellSize || zoneOrDraft?.cellSize || DEFAULT_CELL_SIZE));
}

export function getBrushCells(point, brushSize = 1, cellSize = DEFAULT_CELL_SIZE) {
  const size = Math.max(1, Number(brushSize || 1));
  const centerColumn = Math.floor(Number(point?.x || 0) / cellSize);
  const centerRow = Math.floor(Number(point?.y || 0) / cellSize);
  const radius = size - 1;
  const cells = [];
  for (let row = centerRow - radius; row <= centerRow + radius; row += 1) {
    for (let column = centerColumn - radius; column <= centerColumn + radius; column += 1) {
      if (Math.hypot(column - centerColumn, row - centerRow) <= radius + 0.45) cells.push(cellKey(column, row));
    }
  }
  return uniqueCells(cells.length ? cells : [cellKey(centerColumn, centerRow)]);
}

export function paintCells(current = [], next = [], allowedCells = null) {
  const allowed = allowedCells ? new Set(allowedCells) : null;
  return uniqueCells([...current, ...next.filter((cell) => !allowed || allowed.has(cell))]);
}

export function eraseCells(current = [], erased = []) {
  const blocked = new Set(erased);
  return current.filter((cell) => !blocked.has(cell));
}

export function fillRoomCells(room, cellSize = DEFAULT_CELL_SIZE, allowedCells = null) {
  const geometry = room?.geometry || {};
  const inset = Math.max(0, Number(room?.metadata?.room?.wallThickness || 10));
  const startColumn = Math.ceil((Number(geometry.x || 0) + inset) / cellSize);
  const endColumn = Math.floor((Number(geometry.x || 0) + Number(geometry.width || 0) - inset) / cellSize) - 1;
  const startRow = Math.ceil((Number(geometry.y || 0) + inset) / cellSize);
  const endRow = Math.floor((Number(geometry.y || 0) + Number(geometry.height || 0) - inset) / cellSize) - 1;
  const allowed = allowedCells ? new Set(allowedCells) : null;
  const cells = [];
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      const key = cellKey(column, row);
      if (!allowed || allowed.has(key)) cells.push(key);
    }
  }
  return uniqueCells(cells);
}

export function getPaintBounds(cells = [], cellSize = DEFAULT_CELL_SIZE) {
  if (!cells.length) return { x: 0, y: 0, width: 0, height: 0 };
  const parsed = cells.map(parseCellKey);
  const columns = parsed.map((cell) => cell.column);
  const rows = parsed.map((cell) => cell.row);
  const minColumn = Math.min(...columns);
  const maxColumn = Math.max(...columns);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  return {
    x: minColumn * cellSize,
    y: minRow * cellSize,
    width: (maxColumn - minColumn + 1) * cellSize,
    height: (maxRow - minRow + 1) * cellSize
  };
}

export function getPaintRuns(cells = []) {
  const rows = new Map();
  uniqueCells(cells).forEach((key) => {
    const { column, row } = parseCellKey(key);
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row).push(column);
  });
  const runs = [];
  [...rows.entries()].sort(([left], [right]) => left - right).forEach(([row, columns]) => {
    const sorted = [...new Set(columns)].sort((left, right) => left - right);
    let startColumn = sorted[0];
    let endColumn = sorted[0];
    sorted.slice(1).forEach((column) => {
      if (column === endColumn + 1) {
        endColumn = column;
        return;
      }
      runs.push({ row, startColumn, endColumn });
      startColumn = column;
      endColumn = column;
    });
    if (startColumn !== undefined) runs.push({ row, startColumn, endColumn });
  });
  return runs;
}

export function createPaintAreaZone({ id, planId, floorId, areaType, name, color, cells, cellSize = DEFAULT_CELL_SIZE, groupId = null, segmentId = null, parentAreaId = null }) {
  const normalizedCells = uniqueCells(cells);
  return {
    id,
    planId,
    floorId,
    zoneType: areaType,
    groupId: groupId || null,
    segmentId: segmentId || null,
    name,
    color,
    geometry: {
      kind: "paint-mask",
      cellSize,
      cells: normalizedCells,
      ...getPaintBounds(normalizedCells, cellSize)
    },
    orderIndex: 0,
    metadata: {
      paintArea: {
        version: 1,
        parentAreaId: parentAreaId || null
      }
    }
  };
}

export function findPaintAreaAtPoint(zones = [], point, areaType = null) {
  return zones.find((zone) => {
    if (!isPaintAreaZone(zone) || (areaType && zone.zoneType !== areaType)) return false;
    const size = getPaintCellSize(zone);
    return getPaintCells(zone).includes(cellKey(Math.floor(point.x / size), Math.floor(point.y / size)));
  }) || null;
}
