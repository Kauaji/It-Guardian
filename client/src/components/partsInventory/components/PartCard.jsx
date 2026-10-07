import { ShieldAlert } from "lucide-react";
import { resolvePartFamily } from "../partFamilies.js";
import { familyIcon } from "../utils/partIcons.js";
import { INVENTORY_LABELS, isHardwareDiscrepancy, stockCaption } from "../utils/partsModel.js";

export default function PartCard({ part, onOpen }) {
  const family = resolvePartFamily(part);
  const Icon = familyIcon(family.id);
  const discrepancy = isHardwareDiscrepancy(part);
  return (
    <button
      type="button"
      className={`part-card stock-${part.stockStatus} state-${part.inventoryState} ${discrepancy ? "has-discrepancy" : ""}`}
      style={{ "--family-color": family.color }}
      onClick={() => onOpen(part)}
    >
      <span className="part-card-icon">
        <Icon />
      </span>
      <div>
        <span className="part-card-kicker">
          <small>{part.category || "Diversos"}</small>
          <b>{INVENTORY_LABELS[part.inventoryState] || "Disponível"}</b>
        </span>
        <strong>{part.name}</strong>
        <em>{[part.brand, part.model].filter(Boolean).join(" · ") || part.internalCode || "Cadastro técnico"}</em>
        {discrepancy ? (
          <span className="part-card-warning">
            <ShieldAlert size={13} /> Conferência necessária
          </span>
        ) : null}
      </div>
      <span className="part-stock">
        <strong>{part.quantity}</strong>
        {part.unit}
        <small>{stockCaption(part, discrepancy)}</small>
      </span>
    </button>
  );
}
