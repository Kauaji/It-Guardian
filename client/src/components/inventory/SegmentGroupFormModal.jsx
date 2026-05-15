import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import ColorPickerSegment from "./ColorPickerSegment.jsx";

const fallbackGroupColor = "#2563eb";

export default function SegmentGroupFormModal({
  mode,
  group,
  groups,
  saving,
  onClose,
  onSubmit
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("");

  useEffect(() => {
    setName(group?.name || "");
    setColor(group?.color || "");
  }, [group]);

  const normalizedName = name.trim().toLowerCase();
  const duplicateName = useMemo(
    () =>
      Boolean(normalizedName) &&
      groups.some((item) => item.id !== group?.id && item.name.trim().toLowerCase() === normalizedName),
    [normalizedName, group?.id, groups]
  );
  const isCreate = mode === "create";

  if (!mode) return null;

  function submit(event) {
    event.preventDefault();
    if (name.trim().length < 2 || duplicateName || saving) return;
    onSubmit(name.trim(), color || undefined);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal-panel segment-form-modal" role="dialog" aria-modal="true" onSubmit={submit}>
        <header>
          <div>
            <h2>{isCreate ? "Novo grupo" : "Renomear grupo"}</h2>
            <p>
              {isCreate
                ? "Crie um agrupador para organizar segmentos relacionados."
                : "Atualize o nome do agrupador de segmentos."}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Fechar">
            <X size={18} />
          </button>
        </header>

        <label>
          Nome do grupo
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: Administrativo"
          />
        </label>
        {duplicateName && <span className="form-error">Ja existe um grupo com esse nome.</span>}

        <div className="group-color-field">
          <span>Cor do grupo</span>
          <ColorPickerSegment
            color={color || fallbackGroupColor}
            disabled={saving}
            onChange={setColor}
            title="Alterar cor do grupo"
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-action" onClick={onClose}>Cancelar</button>
          <button className="primary-action compact-action" disabled={saving || name.trim().length < 2 || duplicateName}>
            {saving ? "Salvando..." : isCreate ? "Criar grupo" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
