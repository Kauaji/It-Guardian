import AssetTypeIcon from "../AssetTypeIcon.jsx";

export default function MachineCardHeader({ machine, alias, dragHandleProps, onDragPointerDown, setActivePopoverId }) {
  return (
    <div className="machine-card-header">
      <div>
        <button
          className="asset-drag-handle"
          type="button"
          {...dragHandleProps}
          title="Arrastar ativo"
          onPointerDown={(event) => {
            setActivePopoverId(null);
            onDragPointerDown?.(event);
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <AssetTypeIcon type={machine.assetType || machine.type} size={16} />
        </button>
        <strong>{alias || machine.name}</strong>
      </div>
    </div>
  );
}
