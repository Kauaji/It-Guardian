import { useEffect, useMemo, useState } from "react";
import { Pencil, Power, Save, Trash2, X } from "lucide-react";
import { formatAutomationDate, formatRecurrence, recurrenceLabels } from "./automationUtils.js";

const colorOptions = ["#1f7a61", "#2563eb", "#7c3aed", "#d97706", "#dc2626", "#0f766e"];
const timezoneOptions = ["America/Sao_Paulo", "America/Manaus", "America/Recife", "UTC"];

function buildDraft(plan) {
  return {
    name: plan?.name || "",
    description: plan?.description || "",
    notes: plan?.notes || "",
    active: plan?.active !== false,
    recurrenceType: plan?.recurrenceType || "monthly",
    recurrenceIntervalDays: plan?.recurrenceIntervalDays || plan?.recurrenceInterval || 30,
    preferredTime: plan?.preferredTime || "08:00",
    timezone: plan?.timezone || "America/Sao_Paulo",
    indicatorColor: plan?.indicatorColor || "#1f7a61",
    defaultScriptIds: plan?.defaultScriptIds || []
  };
}

export default function AutomationPlanDetails({
  plan,
  scripts = [],
  open,
  canEdit,
  canDisable,
  canDelete,
  saving,
  onClose,
  onSave,
  onDelete
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [draft, setDraft] = useState(() => buildDraft(plan));
  const linkedScripts = useMemo(
    () => scripts.filter((script) => draft.defaultScriptIds.includes(script.id)),
    [draft.defaultScriptIds, scripts]
  );

  useEffect(() => {
    setDraft(buildDraft(plan));
    setEditing(false);
    setConfirmingDelete(false);
    setDeleteConfirmation("");
  }, [plan]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeydown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [onClose, open]);

  if (!open || !plan) return null;

  function toggleScript(scriptId) {
    setDraft((current) => ({
      ...current,
      defaultScriptIds: current.defaultScriptIds.includes(scriptId)
        ? current.defaultScriptIds.filter((id) => id !== scriptId)
        : [...current.defaultScriptIds, scriptId]
    }));
  }

  async function submit(event) {
    event.preventDefault();
    await onSave(plan.id, draft);
    setEditing(false);
  }

  return (
    <div className="modal-backdrop automation-management-backdrop" role="presentation">
      <section className="modal-panel automation-plan-details" role="dialog" aria-modal="true" aria-labelledby="automation-plan-title">
        <header>
          <div>
            <span>Plano de automação</span>
            <h2 id="automation-plan-title">{plan.name}</h2>
            <p>Informações gerais compartilhadas por todas as máquinas vinculadas.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar detalhes do plano">
            <X size={18} />
          </button>
        </header>

        {confirmingDelete ? (
          <section className="automation-delete-confirmation">
            <Trash2 size={24} />
            <h3>Excluir plano</h3>
            <p>
              Você está prestes a excluir o plano <strong>{plan.name}</strong>. Ele será removido de
              {" "}{plan.assetCount || plan.assetSchedules?.filter((item) => item.active !== false).length || 0} máquina(s).
              Agendas futuras serão desativadas e o histórico será preservado.
            </p>
            <label>
              Digite o nome do plano para confirmar
              <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-action compact-action" onClick={() => setConfirmingDelete(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="danger-action compact-action"
                disabled={saving || deleteConfirmation !== plan.name}
                onClick={() => onDelete(plan)}
              >
                Excluir plano
              </button>
            </div>
          </section>
        ) : editing ? (
          <form className="automation-plan-edit-form" onSubmit={submit}>
            <div className="automation-plan-edit-grid">
              <label>Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label>
                Recorrência
                <select value={draft.recurrenceType} onChange={(event) => setDraft({ ...draft, recurrenceType: event.target.value })}>
                  {Object.entries(recurrenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              {draft.recurrenceType === "custom_days" && (
                <label>Dias<input type="number" min="1" max="365" value={draft.recurrenceIntervalDays} onChange={(event) => setDraft({ ...draft, recurrenceIntervalDays: Number(event.target.value) })} /></label>
              )}
              <label>Horário<input type="time" value={draft.preferredTime} onChange={(event) => setDraft({ ...draft, preferredTime: event.target.value })} /></label>
              <label>
                Fuso horário
                <select value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}>
                  {timezoneOptions.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
                </select>
              </label>
              <label className="automation-plan-wide">Descrição<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
              <label className="automation-plan-wide">Observações<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
              <fieldset className="automation-plan-wide automation-color-field">
                <legend>Cor de identificação</legend>
                <div>
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={draft.indicatorColor === color ? "selected" : ""}
                      style={{ backgroundColor: color }}
                      onClick={() => setDraft({ ...draft, indicatorColor: color })}
                      aria-label={`Usar cor ${color}`}
                    />
                  ))}
                  <input value={draft.indicatorColor} onChange={(event) => setDraft({ ...draft, indicatorColor: event.target.value })} />
                </div>
              </fieldset>
            </div>
            <section className="automation-plan-script-picker">
              <h3>Scripts vinculados</h3>
              <div>
                {scripts.map((script) => (
                  <label key={script.id}>
                    <input type="checkbox" checked={draft.defaultScriptIds.includes(script.id)} onChange={() => toggleScript(script.id)} />
                    <span><strong>{script.name}</strong><small>{script.category || "Sem categoria"}</small></span>
                  </label>
                ))}
              </div>
            </section>
            <label className="automation-active-toggle">
              <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
              Plano ativo
            </label>
            <footer>
              <button type="button" className="secondary-action compact-action" onClick={() => setEditing(false)}>Cancelar</button>
              <button type="submit" className="primary-action compact-action" disabled={saving || !draft.name.trim() || !draft.defaultScriptIds.length}>
                <Save size={15} /> Salvar alterações
              </button>
            </footer>
          </form>
        ) : (
          <>
            <section className="automation-plan-overview">
              <div><span>Status</span><strong>{plan.active === false ? "Inativo" : "Ativo"}</strong></div>
              <div><span>Recorrência geral</span><strong>{formatRecurrence(plan)}</strong></div>
              <div><span>Horário e fuso</span><strong>{plan.preferredTime} • {plan.timezone}</strong></div>
              <div><span>Próxima preparação</span><strong>{formatAutomationDate(plan.nextRunAt)}</strong></div>
              <div><span>Última preparação</span><strong>{formatAutomationDate(plan.lastPreparedAt, "Ainda não preparada")}</strong></div>
              <div><span>Máquinas vinculadas</span><strong>{plan.assetCount ?? plan.assetSchedules?.filter((item) => item.active !== false).length ?? 0}</strong></div>
              <div><span>Scripts</span><strong>{plan.scriptCount ?? plan.defaultScriptIds?.length ?? 0}</strong></div>
              <div><span>Recorrências personalizadas</span><strong>{plan.overrideCount ?? plan.overrides?.length ?? 0}</strong></div>
              <div><span>Criado por</span><strong>{plan.createdByName || "Sistema"}</strong></div>
              <div><span>Criado em</span><strong>{formatAutomationDate(plan.createdAt)}</strong></div>
              <div><span>Plano preventivo</span><strong>{plan.preventivePlanName || "Não vinculado"}</strong></div>
              <div className="automation-plan-color-preview"><span>Cor</span><strong><i style={{ backgroundColor: plan.indicatorColor }} />{plan.indicatorColor}</strong></div>
            </section>
            {(plan.description || plan.notes) && (
              <section className="automation-plan-copy">
                {plan.description && <div><strong>Descrição</strong><p>{plan.description}</p></div>}
                {plan.notes && <div><strong>Observações</strong><p>{plan.notes}</p></div>}
              </section>
            )}
            <section className="automation-plan-linked-scripts">
              <h3>Scripts vinculados</h3>
              {linkedScripts.length ? linkedScripts.map((script) => <span key={script.id}>{script.name}</span>) : <p>Nenhum script identificado.</p>}
            </section>
            <footer>
              {canEdit && <button type="button" className="secondary-action compact-action" onClick={() => setEditing(true)}><Pencil size={15} /> Editar</button>}
              {canDisable && plan.active !== false && (
                <button type="button" className="secondary-action compact-action" onClick={() => onSave(plan.id, { active: false })}>
                  <Power size={15} /> Desativar
                </button>
              )}
              {canDelete && <button type="button" className="danger-action compact-action" onClick={() => setConfirmingDelete(true)}><Trash2 size={15} /> Excluir plano</button>}
              <button type="button" className="primary-action compact-action" onClick={onClose}>Fechar</button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
