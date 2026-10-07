import { ArrowDown, ArrowUp, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { maxServiceOrderStatuses } from "../../../serviceOrderBoardUtils.js";
import { MIN_STATUSES } from "../../utils/settingsEditing.js";

function StatusRow({ status, index, total, editor }) {
  return (
    <article className="service-order-status-row" style={{ "--status-color": status.color }}>
      <span className="service-order-status-dot" />
      <input
        value={status.name}
        onChange={(event) => editor.updateStatus(status.id, { name: event.target.value })}
        aria-label="Nome do status"
      />
      <input
        type="color"
        value={status.color}
        onChange={(event) => editor.updateStatus(status.id, { color: event.target.value })}
        aria-label={`Cor do status ${status.name}`}
      />
      <label>
        <input
          type="checkbox"
          checked={status.isInitial}
          onChange={(event) => event.target.checked && editor.setStatusRole(status.id, "initial")}
        />
        Usar como abertura
      </label>
      <label>
        <input
          type="checkbox"
          checked={status.isFinal}
          onChange={(event) => event.target.checked && editor.setStatusRole(status.id, "final")}
        />
        Usar como finalização
      </label>
      <div className="service-order-status-row-actions">
        <button type="button" className="icon-button" onClick={() => editor.moveStatus(status.id, -1)} disabled={index === 0} title="Subir">
          <ArrowUp size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => editor.moveStatus(status.id, 1)}
          disabled={index === total - 1}
          title="Descer"
        >
          <ArrowDown size={16} />
        </button>
        <button
          type="button"
          className="icon-button danger"
          onClick={() => editor.deleteStatus(status.id)}
          disabled={total <= MIN_STATUSES}
          title="Excluir status"
        >
          <Trash2 size={16} />
        </button>
        {(status.isInitial || status.isFinal) && <CheckCircle2 size={18} className="service-order-status-special-icon" />}
      </div>
    </article>
  );
}

// Lista de status do painel: contagem, novo status e linhas editaveis (nome, cor, papel, ordem).
export default function StatusSettings({ editor }) {
  const { configuredStatuses } = editor;
  return (
    <>
      <div className="service-order-status-header-actions service-order-status-header-inline">
        <span>
          {configuredStatuses.length}/{maxServiceOrderStatuses} status
        </span>
        <button
          type="button"
          className="secondary-action compact-action"
          onClick={editor.addStatus}
          disabled={configuredStatuses.length >= maxServiceOrderStatuses}
        >
          <Plus size={16} />
          Novo status
        </button>
      </div>
      <div className="service-order-status-settings">
        {configuredStatuses.map((status, index) => (
          <StatusRow key={status.id} status={status} index={index} total={configuredStatuses.length} editor={editor} />
        ))}
      </div>
    </>
  );
}
