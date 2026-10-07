import { History } from "lucide-react";
import { assetDisplayName, isCreditMovement, MOVEMENT_LABELS } from "../utils/partsModel.js";

export default function PartHistory({ part, devices }) {
  return (
    <section className="part-history">
      <h4>
        <History size={16} /> Histórico da peça
      </h4>
      {part.movements?.length ? (
        <ol>
          {part.movements.map((item) => (
            <li key={item.id}>
              <span className={`movement-icon type-${item.movementType}`}>{isCreditMovement(item.movementType) ? "+" : "−"}</span>
              <div>
                <strong>
                  {MOVEMENT_LABELS[item.movementType] || item.movementType} · {item.quantity} {part.unit}
                </strong>
                <small>
                  {new Date(item.createdAt).toLocaleString("pt-BR")} · saldo {item.previousQuantity} → {item.resultingQuantity}
                </small>
                {item.serviceOrderNumber ? <em>OS {item.serviceOrderNumber}</em> : null}
                {item.assetId ? <em>{assetDisplayName(devices, item.assetId)}</em> : null}
                {item.notes ? <p>{item.notes}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p>Nenhuma movimentação registrada.</p>
      )}
    </section>
  );
}
