import { CheckCircle2 } from "lucide-react";
import AssetTypeIcon from "./AssetTypeIcon.jsx";

export default function AssetDragCompactOverlay({
  asset,
  alias,
  selected = false,
  selectionCount = 0,
  segmentColor
}) {
  if (!asset) return null;

  const extraCount = selected && selectionCount > 1 ? selectionCount - 1 : 0;

  return (
    <div
      className="asset-drag-compact-overlay"
      style={{ "--overlay-segment-color": segmentColor || "#2563eb" }}
    >
      <span className="asset-drag-compact-icon">
        <AssetTypeIcon type={asset.assetType || asset.type} size={16} />
      </span>
      <strong>{alias || asset.name}</strong>
      {extraCount > 0 ? (
        <span className="asset-drag-count">+{extraCount} equipamentos</span>
      ) : selected ? (
        <CheckCircle2 className="asset-drag-check" size={16} />
      ) : null}
    </div>
  );
}
