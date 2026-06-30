import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ExternalLink, Trash2, X } from "lucide-react";
import { formatAutomationDate, formatRecurrence, recurrenceLabels } from "./automationUtils.js";

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
  const [overrideDraft, setOverrideDraft] = useState({
    recurrenceType: "monthly",
    recurrenceIntervalDays: 30,
    preferredTime: "08:00",
    active: true
  });

  useEffect(() => {
    setSelectedPlanId(machine?.plans?.[0]?.id || "");
    setEditingOverride(false);
    setConfirmingRemoval(false);
  }, [machine]);

  const selectedPlan = useMemo(
    () => machine?.plans?.find((plan) => String(plan.id) === String(selectedPlanId)) || machine?.plans?.[0],
    [machine, selectedPlanId]
  );

  useEffect(() => {
    if (!selectedPlan) return;
    setOverrideDraft({
      recurrenceType: selectedPlan.recurrenceType || "monthly",
      recurrenceIntervalDays: selectedPlan.recurrenceIntervalDays || 30,
      preferredTime: selectedPlan.preferredTime || "08:00",
      active: true
    });
  }, [selectedPlan]);

  useEffect(() => {
    if (!open || !selectedPlan || !machine || !onLoadDetails) return undefined;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    onLoadDetails(selectedPlan.id, machine.assetId)
      .then((response) => {
        if (!cancelled) setDetail(response);
      })
      .catch((error) => {
        if (!cancelled) setDetailError(error.message || "Não foi possível carregar os detalhes desta máquina.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [machine, onLoadDetails, open, selectedPlan]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeydown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [onClose, open]);

  if (!open || !machine || !selectedPlan) return null;
  const displayedSchedule = detail?.schedule || selectedPlan;
  const hasCustomOverride = Boolean(detail ? detail.override : selectedPlan.hasCustomOverride);
  const isLastPlanAsset = Number(selectedPlan.assetCount || detail?.plan?.assetCount || 0) <= 1;

  async function submitOverride(event) {
    event.preventDefault();
    const response = await onSaveOverride(selectedPlan.id, machine.assetId, overrideDraft);
    if (response) setDetail(response);
    setEditingOverride(false);
  }

  return (
    <div className="modal-backdrop automation-management-backdrop" role="presentation">
      <section className="modal-panel automation-machine-details" role="dialog" aria-modal="true" aria-labelledby="automation-machine-title">
        <header>
          <div>
            <span>Automação da máquina</span>
            <h2 id="automation-machine-title">{machine.assetName}</h2>
            <p>{machine.assetType} • {machine.segmentName}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar ações da máquina"><X size={18} /></button>
        </header>

        {machine.plans.length > 1 && (
          <label className="automation-machine-plan-select">
            Plano que deseja gerenciar
            <select value={selectedPlan.id} onChange={(event) => setSelectedPlanId(event.target.value)}>
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
                <button
                  type="button"
                  className="danger-action compact-action"
                  disabled={saving}
                  onClick={() => onDeletePlan(selectedPlan)}
                >
                  Excluir plano
                </button>
              )}
              <button type="button" className="danger-action compact-action" disabled={saving} onClick={() => onRemoveAsset(selectedPlan.id, machine.assetId)}>
                {isLastPlanAsset ? "Manter plano inativo" : "Remover plano da máquina"}
              </button>
            </div>
          </section>
        ) : editingOverride ? (
          <form className="automation-override-form" onSubmit={submitOverride}>
            <h3>Recorrência personalizada</h3>
            <p>Esta configuração afeta somente {machine.assetName}.</p>
            <label>
              Recorrência
              <select value={overrideDraft.recurrenceType} onChange={(event) => setOverrideDraft({ ...overrideDraft, recurrenceType: event.target.value })}>
                {Object.entries(recurrenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {overrideDraft.recurrenceType === "custom_days" && (
              <label>Dias<input type="number" min="1" max="365" value={overrideDraft.recurrenceIntervalDays} onChange={(event) => setOverrideDraft({ ...overrideDraft, recurrenceIntervalDays: Number(event.target.value) })} /></label>
            )}
            <label>Horário<input type="time" value={overrideDraft.preferredTime} onChange={(event) => setOverrideDraft({ ...overrideDraft, preferredTime: event.target.value })} /></label>
            <footer>
              {hasCustomOverride && (
                <button
                  type="button"
                  className="secondary-action compact-action"
                  disabled={saving}
                  onClick={async () => {
                    const response = await onRemoveOverride(selectedPlan.id, machine.assetId);
                    if (response) setDetail(response);
                    setEditingOverride(false);
                  }}
                >
                  Usar recorrência padrão do plano
                </button>
              )}
              <button type="button" className="secondary-action compact-action" onClick={() => setEditingOverride(false)}>Cancelar</button>
              <button type="submit" className="primary-action compact-action" disabled={saving}>Salvar recorrência</button>
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
            </section>
            <section className="automation-machine-overview">
              <div><span>Recorrência geral</span><strong>{formatRecurrence(selectedPlan)}</strong></div>
              <div><span>Recorrência efetiva</span><strong>{formatRecurrence(displayedSchedule)}</strong></div>
              <div><span>Origem</span><strong>{displayedSchedule.recurrenceSource === "machine" ? "Máquina" : displayedSchedule.recurrenceSource === "segment" ? "Segmento" : "Plano"}</strong></div>
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
              <button type="button" className="secondary-action compact-action" onClick={() => onOpenPlan(selectedPlan, machine)}>
                <ExternalLink size={15} /> Ver detalhes do plano
              </button>
              {canManageOverride && (
                <button type="button" className="secondary-action compact-action" onClick={() => setEditingOverride(true)}>
                  <CalendarClock size={15} /> Definir recorrência personalizada
                </button>
              )}
              {canRemoveAsset && (
                <button type="button" className="danger-action compact-action" onClick={() => setConfirmingRemoval(true)}>
                  Remover plano da máquina
                </button>
              )}
              <button type="button" className="primary-action compact-action" onClick={onClose}>Fechar</button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
