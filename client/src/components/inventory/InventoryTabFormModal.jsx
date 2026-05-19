import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

export default function InventoryTabFormModal({ tab, tabs = [], onClose, onSubmit }) {
  const [name, setName] = useState("");

  useEffect(() => {
    setName(tab?.name || "");
  }, [tab]);

  const cleanName = name.trim();
  const duplicateName = useMemo(
    () =>
      Boolean(cleanName) &&
      tabs.some(
        (item) =>
          item.id !== tab?.id &&
          item.name.trim().toLowerCase() === cleanName.toLowerCase()
      ),
    [cleanName, tab?.id, tabs]
  );

  if (!tab) return null;

  function submit(event) {
    event.preventDefault();
    if (cleanName.length < 2 || duplicateName) return;
    onSubmit(cleanName);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-panel segment-form-modal" role="dialog" aria-modal="true" onSubmit={submit}>
        <header>
          <div>
            <h2>Renomear ambiente</h2>
            <p>Atualize o nome da aba do inventario.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>

        <label>
          Nome da aba
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: Cacau Center"
          />
        </label>
        {duplicateName && <span className="form-error">Ja existe uma aba com esse nome.</span>}

        <div className="modal-actions">
          <button type="button" className="ghost-action" onClick={onClose}>Cancelar</button>
          <button className="primary-action compact-action" disabled={cleanName.length < 2 || duplicateName}>
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
