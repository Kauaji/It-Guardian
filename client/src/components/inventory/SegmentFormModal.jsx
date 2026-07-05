import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { hasDuplicateSegmentName } from "./inventoryUtils.js";
import { useModalLifecycle } from "../../hooks/useModalLifecycle.js";

export default function SegmentFormModal({
  mode,
  segment,
  segments,
  groups = [],
  selectedGroupId = "",
  saving,
  onClose,
  onSubmit
}) {
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const dialogRef = useModalLifecycle(Boolean(mode), onClose);

  useEffect(() => {
    setName(segment?.name || "");
    setGroupId(selectedGroupId || segment?.groupId || "");
  }, [segment, selectedGroupId]);

  const normalizedName = name.trim().toLowerCase();
  const selectedGroupForValidation = groupId || "";
  const duplicateName = useMemo(
    () => hasDuplicateSegmentName(segments, {
      name: normalizedName,
      groupId: selectedGroupForValidation,
      excludeId: segment?.id,
      groups
    }),
    [normalizedName, selectedGroupForValidation, segment?.id, groups, segments]
  );
  const isCreate = mode === "create";

  if (!mode) return null;

  function submit(event) {
    event.preventDefault();
    if (name.trim().length < 2 || duplicateName || saving) return;
    onSubmit(name.trim(), groupId);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form ref={dialogRef} className="modal-panel segment-form-modal" role="dialog" aria-modal="true" onSubmit={submit}>
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
        {duplicateName && <span className="form-error">Ja existe um segmento com esse nome neste grupo.</span>}

        <label>
          Grupo
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            <option value="">Sem grupo</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </label>

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
