import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, ExternalLink, Trash2, X } from "lucide-react";
import {
  automationDraftsEqual,
  buildAutomationOverrideDraft,
  validateAutomationOverrideDraft
} from "./automationFormUtils.js";
import { formatAutomationDate, formatRecurrence, recurrenceLabels } from "./automationUtils.js";
import UnsavedChangesPrompt from "./UnsavedChangesPrompt.jsx";
import useUnsavedChanges from "./useUnsavedChanges.js";

const emptyOverrideDraft = buildAutomationOverrideDraft();

function recurrenceOriginLabel(source) {
  if (source === "machine") return "Personalizada para esta máquina";
  if (source === "segment") return "Herdada do segmento";
  return "Herdada do plano";
}

export default function AutomationMachineDetails({
  machine,
  open,
  canManageOverride,
  canRemoveAsset,
  canDeletePlan,
  saving,
  onClose,
  onOpenPlan,
  onSaveOverride,
  onRemoveOverride,
  onRemoveAsset,
  onDeletePlan,
  onLoadDetails
}) {
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [editingOverride, setEditingOverride] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [overrideDraft, setOverrideDraft] = useState(emptyOverrideDraft);
  const [overrideBaseline, setOverrideBaseline] = useState(emptyOverrideDraft);
  const [overrideErrors, setOverrideErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const onLoadDetailsRef = useRef(onLoadDetails);

  useEffect(() => {
    onLoadDetailsRef.current = onLoadDetails;
  }, [onLoadDetails]);

  useEffect(() => {
    setSelectedPlanId(machine?.plans?.[0]?.id || "");
    setEditingOverride(false);
    setConfirmingRemoval(false);
    setDetail(null);
  }, [machine?.assetId]);

  const selectedPlan = useMemo(
    () => machine?.plans?.find((plan) => String(plan.id) === String(selectedPlanId)) || machine?.plans?.[0],
    [machine, selectedPlanId]
  );
  const isOverrideDirty = editingOverride && !automationDraftsEqual(overrideDraft, overrideBaseline);
  const unsavedChanges = useUnsavedChanges(isOverrideDirty);

  useEffect(() => {
    if (!open || !selectedPlan || !machine) return undefined;
    let cancelled = false;
    const fallbackDraft = buildAutomationOverrideDraft({ plan: selectedPlan });

    setDetail(null);
    setDetailLoading(Boolean(onLoadDetailsRef.current));
    setDetailError("");
    setEditingOverride(false);
    setConfirmingRemoval(false);
    setOverrideErrors({});
    setOverrideDraft(fallbackDraft);
    setOverrideBaseline(fallbackDraft);

    if (!onLoadDetailsRef.current) return undefined;

    onLoadDetailsRef.current(selectedPlan.id, machine.assetId)
      .then((response) => {
        if (cancelled) return;
        const loadedDraft = buildAutomationOverrideDraft({
          override: response?.override,
          schedule: response?.schedule,
          plan: response?.plan || selectedPlan
        });
        setDetail(response);
        setOverrideDraft(loadedDraft);
        setOverrideBaseline(loadedDraft);
      })
      .catch((error) => {
        if (!cancelled) {
          setDetailError(error.message || "Não foi possível carregar os detalhes desta máquina.");
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [machine?.assetId, open, selectedPlan?.id]);

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
  }, [open, isOverrideDirty]);

  if (!open || !machine || !selectedPlan) return null;

  const displayedSchedule = detail?.schedule || selectedPlan;
  const hasCustomOverride = detail
    ? Boolean(detail.override && detail.override.active !== false)
    : Boolean(selectedPlan.hasCustomOverride);
  const isLastPlanAsset = Number(selectedPlan.assetCount || detail?.plan?.assetCount || 0) <= 1;
  const busy = saving || submitting;
  const effectiveOrigin = displayedSchedule.recurrenceSource || (hasCustomOverride ? "machine" : "plan");

  function updateOverride(field, value) {
    setOverrideDraft((current) => ({ ...current, [field]: value }));
    setOverrideErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submitOverride(event) {
    event.preventDefault();
    if (busy) return;
    const errors = validateAutomationOverrideDraft(overrideDraft);
    setOverrideErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      const response = await onSaveOverride(selectedPlan.id, machine.assetId, overrideDraft);
      if (response) {
        const nextDraft = buildAutomationOverrideDraft({
          override: response.override,
          schedule: response.schedule,
          plan: response.plan || selectedPlan
        });
        setDetail(response);
        setOverrideDraft(nextDraft);
        setOverrideBaseline(nextDraft);
      }
      setEditingOverride(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function removeOverride() {
    if (busy) return;
    setSubmitting(true);
    try {
      const response = await onRemoveOverride(selectedPlan.id, machine.assetId);
      if (response) {
        const nextDraft = buildAutomationOverrideDraft({
          override: response.override,
          schedule: response.schedule,
          plan: response.plan || selectedPlan
        });
        setDetail(response);
        setOverrideDraft(nextDraft);
        setOverrideBaseline(nextDraft);
      }
      setEditingOverride(false);
    } finally {
      setSubmitting(false);
    }
  }

  function switchPlan(planId) {
    unsavedChanges.requestAction(() => {
      setSelectedPlanId(planId);
      setDetail(null);
      setEditingOverride(false);
    });
  }

  return (
    <div
      className="modal-backdrop automation-management-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section className="modal-panel automation-machine-details" role="dialog" aria-modal="true" aria-labelledby="automation-machine-title">
        <header>
          <div>
            <span>Configuração desta máquina</span>
            <h2 id="automation-machine-title">{machine.assetName}</h2>
            <p>Alterações nesta tela afetam somente esta máquina.</p>
          </div>
          <button type="button" className="icon-button" onClick={requestClose} aria-label="Fechar ações da máquina"><X size={18} /></button>
        </header>

        {machine.plans.length > 1 && (
          <label className="automation-machine-plan-select">
            Plano que deseja gerenciar
            <select value={selectedPlan.id} onChange={(event) => switchPlan(event.target.value)}>
              {machine.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.planName || plan.name}</option>)}
            </select>
          </label>
        )}

        {detailLoading && <p className="automation-machine-detail-status">Carregando detalhes da agenda...</p>}
        {detailError && <p className="automation-machine-detail-status error">{detailError}</p>}

        {confirmingRemoval ? (
          <section className="automation-remove-confirmation">
            <Trash2 size={24} />
            <h3>Remover plano da máquina</h3>
            <p>
              A máquina <strong>{machine.assetName}</strong> será removida do plano <strong>{selectedPlan.planName || selectedPlan.name}</strong>.
              A agenda futura desta máquina será desativada e o histórico será preservado.
            </p>
            {isLastPlanAsset ? (
              <p className="warning">
                Esta é a última máquina ativa do plano. Você pode manter o plano inativo ou excluí-lo definitivamente da listagem.
              </p>
            ) : (
              <p>As outras máquinas continuarão vinculadas ao plano.</p>
            )}
            <div className="modal-actions">
              <button type="button" className="secondary-action compact-action" onClick={() => setConfirmingRemoval(false)}>Cancelar</button>
              {isLastPlanAsset && canDeletePlan && (
                <button type="button" className="danger-action compact-action" disabled={busy} onClick={() => onDeletePlan(selectedPlan)}>
                  Excluir plano
                </button>
              )}
              <button type="button" className="danger-action compact-action" disabled={busy} onClick={() => onRemoveAsset(selectedPlan.id, machine.assetId)}>
                {isLastPlanAsset ? "Manter plano inativo" : "Remover plano da máquina"}
              </button>
            </div>
          </section>
        ) : editingOverride ? (
          <form className="automation-override-form" onSubmit={submitOverride} noValidate>
            <h3>Configuração desta máquina</h3>
            <p>Esta recorrência substitui a configuração herdada apenas para {machine.assetName}.</p>
            <label>
              Recorrência
              <select value={overrideDraft.recurrenceType} onChange={(event) => updateOverride("recurrenceType", event.target.value)}>
                {Object.entries(recurrenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {overrideErrors.recurrenceType && <small className="automation-field-error">{overrideErrors.recurrenceType}</small>}
            </label>
            {overrideDraft.recurrenceType === "custom_days" && (
              <label>
                Dias
                <input type="number" min="1" max="365" value={overrideDraft.recurrenceIntervalDays} onChange={(event) => updateOverride("recurrenceIntervalDays", Number(event.target.value))} />
                {overrideErrors.recurrenceIntervalDays && <small className="automation-field-error">{overrideErrors.recurrenceIntervalDays}</small>}
              </label>
            )}
            <label>
              Horário
              <input type="time" value={overrideDraft.preferredTime} onChange={(event) => updateOverride("preferredTime", event.target.value)} />
              {overrideErrors.preferredTime && <small className="automation-field-error">{overrideErrors.preferredTime}</small>}
            </label>
            <footer>
              {hasCustomOverride && (
                <button
                  type="button"
                  className="secondary-action compact-action"
                  disabled={busy}
                  onClick={() => unsavedChanges.requestAction(removeOverride)}
                >
                  Usar recorrência herdada
                </button>
              )}
              <button
                type="button"
                className="secondary-action compact-action"
                onClick={() => unsavedChanges.requestAction(() => {
                  setOverrideDraft(overrideBaseline);
                  setOverrideErrors({});
                  setEditingOverride(false);
                })}
              >
                Cancelar
              </button>
              <button type="submit" className="primary-action compact-action" disabled={busy}>Salvar recorrência</button>
            </footer>
          </form>
        ) : (
          <>
            <section className="automation-machine-plan-heading">
              <i style={{ backgroundColor: selectedPlan.indicatorColor }} />
              <div>
                <strong>{selectedPlan.planName || selectedPlan.name}</strong>
                <small>{selectedPlan.active ? "Agenda ativa" : "Agenda inativa"}</small>
              </div>
              <span className={`pill automation-recurrence-origin ${effectiveOrigin === "machine" ? "personalized" : ""}`}>
                {recurrenceOriginLabel(effectiveOrigin)}
              </span>
            </section>
            <section className="automation-machine-overview">
              <div><span>Recorrência geral</span><strong>{formatRecurrence(selectedPlan)}</strong></div>
              <div><span>Recorrência efetiva</span><strong>{formatRecurrence(displayedSchedule)}</strong></div>
              <div><span>Origem</span><strong>{recurrenceOriginLabel(effectiveOrigin)}</strong></div>
              <div><span>Próxima preparação</span><strong>{formatAutomationDate(displayedSchedule.nextRunAt)}</strong></div>
              <div><span>Última preparação</span><strong>{formatAutomationDate(displayedSchedule.lastPreparedAt, "Ainda não preparada")}</strong></div>
              <div><span>Último resultado</span><strong>{displayedSchedule.latestRun?.status || "Sem execução registrada"}</strong></div>
              <div><span>Horário</span><strong>{displayedSchedule.preferredTime}</strong></div>
              <div><span>Fuso</span><strong>{displayedSchedule.timezone}</strong></div>
              <div><span>Scripts</span><strong>{selectedPlan.scriptCount || 0}</strong></div>
            </section>
            {detail?.history?.length > 0 && (
              <section className="automation-machine-history">
                <h3>Histórico recente</h3>
                {detail.history.map((item) => (
                  <article key={item.id}>
                    <strong>{item.message}</strong>
                    <small>{formatAutomationDate(item.createdAt)} • {item.userName || "Sistema"}</small>
                  </article>
                ))}
              </section>
            )}
            <section className="automation-machine-script-list">
              <h3>Scripts vinculados</h3>
              {(selectedPlan.scripts || []).map((script) => <span key={script.id}>{script.name}</span>)}
              {!selectedPlan.scripts?.length && <p>Nenhum script identificado.</p>}
            </section>
            <footer>
              <button
                type="button"
                className="secondary-action compact-action"
                onClick={() => unsavedChanges.requestAction(() => onOpenPlan(selectedPlan, machine))}
              >
                <ExternalLink size={15} /> Ver detalhes do plano
              </button>
              {canManageOverride && (
                <button type="button" className="secondary-action compact-action" disabled={detailLoading} onClick={() => setEditingOverride(true)}>
                  <CalendarClock size={15} /> Definir recorrência personalizada
                </button>
              )}
              {canRemoveAsset && (
                <button type="button" className="danger-action compact-action" onClick={() => setConfirmingRemoval(true)}>
                  Remover plano da máquina
                </button>
              )}
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
