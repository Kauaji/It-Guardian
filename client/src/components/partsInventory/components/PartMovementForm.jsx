import { ArrowDownToLine } from "lucide-react";
import { assetDisplayName, isOpenServiceOrder, MOVEMENT_LABELS } from "../utils/partsModel.js";

// O rascunho vive no inspetor (nao aqui) para sobreviver a troca de peca com o painel aberto.
export default function PartMovementForm({ movement, setField, devices, serviceOrders, saving, onMove }) {
  return (
    <form
      className="part-movement-form"
      onSubmit={(event) => {
        event.preventDefault();
        onMove(movement);
      }}
    >
      <h4>
        <ArrowDownToLine size={16} /> Movimentar estoque
      </h4>
      <div>
        <label>
          Operação
          <select value={movement.movementType} onChange={setField("movementType")}>
            {Object.entries(MOVEMENT_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantidade
          <input type="number" min="1" step="1" value={movement.quantity} onChange={setField("quantity", Number)} />
        </label>
      </div>
      <label>
        Ativo
        <select value={movement.assetId} onChange={setField("assetId")}>
          <option value="">Sem ativo</option>
          {devices.map((item) => (
            <option key={item.id} value={item.id}>
              {assetDisplayName(devices, item.id)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ordem de Serviço
        <select value={movement.serviceOrderId} onChange={setField("serviceOrderId")}>
          <option value="">Sem OS</option>
          {serviceOrders.filter(isOpenServiceOrder).map((item) => (
            <option key={item.id} value={item.id}>
              {item.number} · {item.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Observação
        <input value={movement.notes} onChange={setField("notes")} placeholder="Motivo, lote ou destino" />
      </label>
      <button type="submit" className="primary-action" disabled={saving}>
        {saving ? "Registrando..." : "Registrar movimentação"}
      </button>
    </form>
  );
}
