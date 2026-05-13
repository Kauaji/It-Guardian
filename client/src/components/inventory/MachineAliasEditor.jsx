import { Edit3, Save, X } from "lucide-react";
import { useState } from "react";

export default function MachineAliasEditor({ alias, originalName, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(alias || "");

  function save() {
    onSave(value.trim());
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="alias-editor editing">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Nome fantasia"
          autoFocus
        />
        <button type="button" onClick={save} title="Salvar nome fantasia">
          <Save size={14} />
        </button>
        <button type="button" onClick={() => { setValue(alias || ""); setEditing(false); }} title="Cancelar">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="alias-editor">
      <div>
        <span>Nome fantasia</span>
        <strong>{alias || originalName}</strong>
      </div>
      <button type="button" onClick={() => setEditing(true)} title="Editar nome fantasia">
        <Edit3 size={14} />
      </button>
    </div>
  );
}
