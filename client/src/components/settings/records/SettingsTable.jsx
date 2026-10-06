import { Pencil, Trash2 } from "lucide-react";
import { renderCell } from "./settingsCells.jsx";

export default function SettingsTable({ columns, records, onEdit, onRemove }) {
  const tableColumns = `repeat(${columns.length}, minmax(120px, 1fr)) 120px`;
  return (
    <div className="settings-table">
      <div className="settings-table-head" style={{ gridTemplateColumns: tableColumns }}>
        {columns.map((column) => (
          <span key={column.key}>{column.label}</span>
        ))}
        <span className="settings-actions-heading" aria-hidden="true" />
      </div>
      {records.length ? (
        records.map((record) => (
          <article key={record.id} className="settings-table-row" style={{ gridTemplateColumns: tableColumns }}>
            {columns.map((column) => (
              <span key={column.key}>{renderCell(record, column)}</span>
            ))}
            <div className="settings-row-actions">
              <button type="button" className="icon-button" onClick={() => onEdit(record)} title="Editar">
                <Pencil size={16} />
              </button>
              <button type="button" className="icon-button danger" onClick={() => onRemove(record)} title="Excluir">
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))
      ) : (
        <p className="empty settings-empty">Nenhum cadastro encontrado.</p>
      )}
    </div>
  );
}
