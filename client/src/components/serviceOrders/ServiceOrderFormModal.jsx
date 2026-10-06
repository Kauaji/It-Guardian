import { useModalLifecycle } from "../../hooks/useModalLifecycle.js";
import EnvironmentAssetFields from "./form/components/EnvironmentAssetFields.jsx";
import FormHeader from "./form/components/FormHeader.jsx";
import RequesterFields from "./form/components/RequesterFields.jsx";
import SummaryFields from "./form/components/SummaryFields.jsx";
import TechnicianPicker from "./form/components/TechnicianPicker.jsx";
import { useFormLookups } from "./form/hooks/useFormLookups.js";
import { useServiceOrderForm } from "./form/hooks/useServiceOrderForm.js";

export default function ServiceOrderFormModal({
  open,
  devices = [],
  tabs = [],
  activeTab,
  token,
  notify,
  systemMode = "local",
  serviceOrderSettings,
  sectors = [],
  saving,
  onClose,
  onSubmit
}) {
  const dialogRef = useModalLifecycle(open, onClose);
  const businessMode = systemMode === "business";
  const environmentLabel = businessMode ? "Cliente" : "Ambiente";
  const helperText = businessMode
    ? "No modo Business, informe cliente/ambiente, ativo, solicitante, categoria e descrição."
    : "No modo Local, o setor organiza o atendimento interno sem exigir cliente.";
  const { technicians, clients } = useFormLookups({ open, token, businessMode, notify });
  const state = useServiceOrderForm({
    open, businessMode, activeTab, tabs, devices, sectors, serviceOrderSettings, clients, saving, onSubmit
  });
  const { form, formError, updateField } = state;

  if (!open) return null;

  return (
    <div className="modal-backdrop service-order-backdrop" role="presentation">
      <form ref={dialogRef} className="modal-panel service-order-form-modal" role="dialog" aria-modal="true" aria-labelledby="service-order-form-title" onSubmit={state.submit}>
        <FormHeader helperText={helperText} onClose={onClose} />
        <SummaryFields form={form} availableSectors={state.availableSectors} updateField={updateField} />
        <EnvironmentAssetFields
          form={form}
          businessMode={businessMode}
          environmentLabel={environmentLabel}
          clients={clients}
          tabs={tabs}
          devices={devices}
          selectedAsset={state.selectedAsset}
          updateField={updateField}
        />
        <TechnicianPicker technicians={technicians} selectedNames={form.assignedTechnicianNames} onToggle={state.toggleAssignedTechnician} />
        <RequesterFields
          form={form}
          technicians={technicians}
          thirdPartyRequester={state.thirdPartyRequester}
          updateField={updateField}
          onToggleThirdParty={state.toggleThirdPartyRequester}
        />

        {formError && <div className="service-order-form-error service-order-wide">{formError}</div>}

        <div className="modal-actions service-order-wide">
          <button type="button" className="ghost-action" onClick={onClose}>Cancelar</button>
          <button className="primary-action compact-action" disabled={saving || form.title.trim().length < 3}>
            {saving ? "Criando..." : "Criar OS"}
          </button>
        </div>
      </form>
    </div>
  );
}
