import useVisualMapScene from "./visualMapScene/useVisualMapScene.js";

export default function InventoryVisualMapScene({
  map,
  objects,
  connections = [],
  selectedObjectId,
  selectedConnectionId,
  layers,
  showGrid,
  cameraAction,
  onSelectObject,
  onSelectConnection
}) {
  const hostRef = useVisualMapScene({
    map,
    objects,
    connections,
    selectedObjectId,
    selectedConnectionId,
    layers,
    showGrid,
    cameraAction,
    onSelectObject,
    onSelectConnection
  });

  if (!map) {
    return (
      <div key="empty" className="inventory-visual-map-canvas empty">
        <strong>Nenhum mapa selecionado.</strong>
      </div>
    );
  }

  return (
    <div
      key="canvas"
      className="inventory-visual-map-canvas"
      ref={hostRef}
      role="img"
      aria-label={`Cena 3D do mapa ${map.name || "sem nome"}. Arraste para orbitar e use a roda do mouse para aproximar.`}
      tabIndex={0}
    />
  );
}
