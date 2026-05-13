import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

export default function SegmentFormModal({
  mode,
  segment,
  segments,
  saving,
  onClose,
  onSubmit
}) {
  const [name, setName] = useState("");

  useEffect(() => {
    setName(segment?.name || "");
  }, [segment]);

  const normalizedName = name.trim().toLowerCase();
  const duplicateName = useMemo(
    () =>
      Boolean(normalizedName) &&
      segments.some((item) => item.id !== segment?.id && item.name.trim().toLowerCase() === normalizedName),
    [normalizedName, segment?.id, segments]
  );
  const isCreate = mode === "create";

  if (!mode) return null;

  function submit(event) {
    event.preventDefault();
    if (name.trim().length < 2 || duplicateName || saving) return;
    onSubmit(name.trim());
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-panel segment-form-modal" role="dialog" aria-modal="true" onSubmit={submit}>
        <header>
          <div>
            <h2>{isCreate ? "Novo segmento" : "Renomear segmento"}</h2>
            <p>{isCreate ? "Crie uma categoria vazia para organizar maquinas." : "Atualize o nome da categoria."}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>

        <label>
          Nome do segmento
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: Servidores"
          />
        </label>
        {duplicateName && <span className="form-error">Ja existe um segmento com esse nome.</span>}

        <div className="modal-actions">
          <button type="button" className="ghost-action" onClick={onClose}>Cancelar</button>
          <button className="primary-action compact-action" disabled={saving || name.trim().length < 2 || duplicateName}>
            {saving ? "Salvando..." : isCreate ? "Criar segmento" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
