import { Printer, Trash2, Undo2, X } from "lucide-react";
import RemoteAssistanceAction from "../../../remoteAssistance/RemoteAssistanceAction.jsx";
import { priorityLabels } from "../../serviceOrderBoardUtils.js";

// Titulo da OS e acoes do topo: reabrir, assistencia remota, situacao, excluir, imprimir e fechar.
export default function DetailsHeader({
  serviceOrder,
  asset,
  token,
  user,
  notify,
  saving,
  reopening,
  statusOptions,
  statusLabelMap,
  can,
  onReopen,
  onStatusChange,
  onDelete,
  onPrint,
  onClose
}) {
  return (
    <header className="asset-modal-header">
      <div>
        <span className="asset-eyebrow">Ordem de Serviço</span>
        <h2>
          {serviceOrder.number} - {serviceOrder.title}
          {serviceOrder.isDemo && <span className="demo-data-badge">Demo</span>}
        </h2>
        <p>
          {statusLabelMap[serviceOrder.status] || serviceOrder.status} - Prioridade {priorityLabels[serviceOrder.priority]}
        </p>
      </div>
      <div className="asset-modal-header-actions">
        {can.reopen && serviceOrder.closedAt && (
          <button type="button" className="icon-button" onClick={onReopen} disabled={reopening} title="Reabrir Ordem de Serviço">
            <Undo2 size={18} />
          </button>
        )}
        <RemoteAssistanceAction
          asset={asset}
          alias={asset?.alias}
          serviceOrder={serviceOrder}
          token={token}
          user={user}
          notify={notify}
          compact
        />
        <select
          className="service-order-status-select"
          aria-label="Situação da OS"
          value={serviceOrder.status}
          disabled={!can.changeStatus}
          onChange={(event) => onStatusChange(serviceOrder, event.target.value)}
        >
          {statusOptions.map((status) => (
            <option key={status.id} value={status.id} disabled={status.isFinal && !can.finish}>
              {status.name}
            </option>
          ))}
        </select>
        {can.edit && (
          <button
            type="button"
            className="icon-button danger service-order-delete-action"
            onClick={onDelete}
            disabled={saving}
            title="Excluir Ordem de Serviço"
          >
            <Trash2 size={18} />
          </button>
        )}
        {can.print && (
          <button type="button" className="icon-button" onClick={onPrint} title="Imprimir OS A4">
            <Printer size={18} />
          </button>
        )}
        <button type="button" className="icon-button" onClick={onClose} title="Fechar">
          <X size={18} />
        </button>
      </div>
    </header>
  );
}
