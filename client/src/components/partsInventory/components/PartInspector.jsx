import { useState } from "react";
import { X } from "lucide-react";
import { EMPTY_MOVEMENT, isHardwareDiscrepancy } from "../utils/partsModel.js";
import PartDiscrepancyPanel from "./PartDiscrepancyPanel.jsx";
import PartHistory from "./PartHistory.jsx";
import PartIdentity from "./PartIdentity.jsx";
import PartMovementForm from "./PartMovementForm.jsx";

export default function PartInspector({
  part,
  devices,
  serviceOrders,
  permissions,
  saving,
  onClose,
  onEdit,
  onMove,
  onOpenAsset,
  onReviewDiscrepancy
}) {
  const [movement, setMovement] = useState(EMPTY_MOVEMENT);
  const setField =
    (field, convert = String) =>
    (event) =>
      setMovement((current) => ({ ...current, [field]: convert(event.target.value) }));
  return (
    <aside className="part-inspector">
      <header>
        <div>
          <span>{part.category || "Peça"}</span>
          <h3>{part.name}</h3>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
          <X />
        </button>
      </header>
      <div className="part-inspector-body">
        {isHardwareDiscrepancy(part) ? (
          <PartDiscrepancyPanel
            part={part}
            permissions={permissions}
            saving={saving}
            onOpenAsset={onOpenAsset}
            onReviewDiscrepancy={onReviewDiscrepancy}
          />
        ) : null}
        <PartIdentity part={part} devices={devices} />
        {permissions.update && part.source !== "agent" ? (
          <button type="button" className="secondary-action" onClick={onEdit}>
            Editar cadastro
          </button>
        ) : null}
        {permissions.moveStock && part.inventoryState === "available" ? (
          <PartMovementForm
            movement={movement}
            setField={setField}
            devices={devices}
            serviceOrders={serviceOrders}
            saving={saving}
            onMove={onMove}
          />
        ) : null}
        <PartHistory part={part} devices={devices} />
      </div>
    </aside>
  );
}
