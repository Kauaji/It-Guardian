import { useEffect, useMemo, useState } from "react";
import { Pause, Pencil, Play, Save, Trash2, X } from "lucide-react";
import {
  automationDraftsEqual,
  automationTimezoneOptions,
  buildAutomationPlanDraft,
  validateAutomationPlanDraft
} from "./automationFormUtils.js";
import { formatAutomationDate, formatRecurrence, recurrenceLabels } from "./automationUtils.js";
import UnsavedChangesPrompt from "./UnsavedChangesPrompt.jsx";
import useUnsavedChanges from "./useUnsavedChanges.js";

const colorOptions = ["#1f7a61", "#2563eb", "#7c3aed", "#d97706", "#dc2626", "#0f766e"];

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
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [draft, setDraft] = useState(() => buildAutomationPlanDraft(plan));
  const [baseline, setBaseline] = useState(() => buildAutomationPlanDraft(plan));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const linkedScripts = useMemo(
    () => scripts.filter((script) => draft.defaultScriptIds.includes(script.id)),
    [draft.defaultScriptIds, scripts]
  );
  const isDirty = editing && !automationDraftsEqual(draft, baseline);
  const unsavedChanges = useUnsavedChanges(isDirty);

  useEffect(() => {
    const nextDraft = buildAutomationPlanDraft(plan);
    setDraft(nextDraft);
    setBaseline(nextDraft);
    setEditing(false);
    setConfirmingDelete(false);
    setConfirmingStatus(false);
    setDeleteConfirmation("");
    setErrors({});
  }, [plan?.id]);

  function requestClose() {
    unsavedChanges.requestAction(onClose);
  }

  useEffect(() => {
    if (!open) return undefined;
    function handleKeydown(event) {
      if (event.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open, isDirty]);

  if (!open || !plan) return null;
  const busy = saving || submitting;

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function toggleScript(scriptId) {
    setDraft((current) => ({
      ...current,
      defaultScriptIds: current.defaultScriptIds.includes(scriptId)
        ? current.defaultScriptIds.filter((id) => id !== scriptId)
        : [...current.defaultScriptIds, scriptId]
    }));
    setErrors((current) => ({ ...current, defaultScriptIds: undefined }));
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const nextErrors = validateAutomationPlanDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const savedPlan = await onSave(plan.id, draft);
      const nextBaseline = buildAutomationPlanDraft(savedPlan || draft);
      setDraft(nextBaseline);
      setBaseline(nextBaseline);
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus() {
    if (busy) return;
    setSubmitting(true);
    try {
      const savedPlan = await onSave(plan.id, { active: plan.active === false });
      const nextBaseline = buildAutomationPlanDraft(savedPlan || { ...plan, active: plan.active === false });
      setDraft(nextBaseline);
      setBaseline(nextBaseline);
      setConfirmingStatus(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop automation-management-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section className="modal-panel automation-plan-details" role="dialog" aria-modal="true" aria-labelledby="automation-plan-title">
        <header>
          <div>
            <span>Configuração geral do plano</span>
            <h2 id="automation-plan-title">{plan.name}</h2>
            <p>Estas configurações afetam todas as máquinas, exceto aquelas que possuem recorrência personalizada.</p>
          </div>
          <button type="button" className="icon-button" onClick={requestClose} aria-label="Fechar detalhes do plano">
            <X size={18} />
          </button>
        </header>

        {confirmingDelete ? (
          <section className="automation-delete-confirmation">
            <Trash2 size={24} />
            <h3>Excluir plano</h3>
            <p>
              Você está prestes a excluir o plano <strong>{plan.name}</strong>. Ele será removido de{" "}
              {plan.assetCount || plan.assetSchedules?.filter((item) => item.active !== false).length || 0} máquina(s).
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
                disabled={busy || deleteConfirmation !== plan.name}
                onClick={() => onDelete(plan)}
              >
                Excluir plano
              </button>
            </div>
          </section>
        ) : confirmingStatus ? (
          <section className="automation-status-confirmation">
            {plan.active === false ? <Play size={24} /> : <Pause size={24} />}
            <h3>{plan.active === false ? "Reativar automação" : "Pausar automação"}</h3>
            <p>
              {plan.active === false
                ? "As agendas vinculadas voltarão a ficar ativas e serão sincronizadas."
                : "As agendas vinculadas serão pausadas sem apagar o plano ou seu histórico."}
            </p>
            <div className="modal-actions">
              <button type="button" className="secondary-action compact-action" onClick={() => setConfirmingStatus(false)}>
                Cancelar
              </button>
              <button type="button" className="primary-action compact-action" disabled={busy} onClick={changeStatus}>
                {plan.active === false ? "Reativar automação" : "Pausar automação"}
              </button>
            </div>
          </section>
        ) : editing ? (
          <form className="automation-plan-edit-form" onSubmit={submit} noValidate>
            <div className="automation-plan-edit-grid">
              <label>
                Nome
                <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} />
                {errors.name && <small className="automation-field-error">{errors.name}</small>}
              </label>
              <label>
                Recorrência
                <select value={draft.recurrenceType} onChange={(event) => updateDraft("recurrenceType", event.target.value)}>
                  {Object.entries(recurrenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {errors.recurrenceType && <small className="automation-field-error">{errors.recurrenceType}</small>}
              </label>
              {draft.recurrenceType === "custom_days" && (
                <label>
                  Dias
                  <input type="number" min="1" max="365" value={draft.recurrenceIntervalDays} onChange={(event) => updateDraft("recurrenceIntervalDays", Number(event.target.value))} />
                  {errors.recurrenceIntervalDays && <small className="automation-field-error">{errors.recurrenceIntervalDays}</small>}
                </label>
              )}
              <label>
                Horário
                <input type="time" value={draft.preferredTime} onChange={(event) => updateDraft("preferredTime", event.target.value)} />
                {errors.preferredTime && <small className="automation-field-error">{errors.preferredTime}</small>}
              </label>
              <label>
                Fuso horário
                <select value={draft.timezone} onChange={(event) => updateDraft("timezone", event.target.value)}>
                  {automationTimezoneOptions.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
                </select>
                {errors.timezone && <small className="automation-field-error">{errors.timezone}</small>}
              </label>
              <label className="automation-plan-wide">Descrição<textarea value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} /></label>
              <label className="automation-plan-wide">Observações<textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} /></label>
              <fieldset className="automation-plan-wide automation-color-field">
                <legend>Cor de identificação</legend>
                <div>
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={draft.indicatorColor === color ? "selected" : ""}
                      style={{ backgroundColor: color }}
                      onClick={() => updateDraft("indicatorColor", color)}
                      aria-label={`Usar cor ${color}`}
                    />
                  ))}
                  <input value={draft.indicatorColor} onChange={(event) => updateDraft("indicatorColor", event.target.value)} />
                </div>
                {errors.indicatorColor && <small className="automation-field-error">{errors.indicatorColor}</small>}
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
              {errors.defaultScriptIds && <small className="automation-field-error">{errors.defaultScriptIds}</small>}
            </section>
            <footer>
              <button
                type="button"
                className="secondary-action compact-action"
                onClick={() => unsavedChanges.requestAction(() => {
                  setDraft(baseline);
                  setErrors({});
                  setEditing(false);
                })}
              >
                Cancelar
              </button>
              <button type="submit" className="primary-action compact-action" disabled={busy}>
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
              {(canDisable || canEdit) && (
                <button type="button" className="secondary-action compact-action" onClick={() => setConfirmingStatus(true)}>
                  {plan.active === false ? <Play size={15} /> : <Pause size={15} />}
                  {plan.active === false ? "Reativar automação" : "Pausar automação"}
                </button>
              )}
              {canDelete && <button type="button" className="danger-action compact-action" onClick={() => setConfirmingDelete(true)}><Trash2 size={15} /> Excluir plano</button>}
              <button type="button" className="primary-action compact-action" onClick={requestClose}>Fechar</button>
            </footer>
          </>
        )}

        <UnsavedChangesPrompt
          open={unsavedChanges.confirmationOpen}
          onContinueEditing={unsavedChanges.continueEditing}
          onDiscard={unsavedChanges.discardChanges}
        />
      </section>
    </div>
  );
}
