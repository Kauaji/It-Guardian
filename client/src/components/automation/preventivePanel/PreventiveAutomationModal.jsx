import { XCircle } from "lucide-react";
import PreventiveAutomationContextSummary from "./PreventiveAutomationContextSummary.jsx";
import PreventiveAutomationFormFields from "./PreventiveAutomationFormFields.jsx";
import PreventiveAutomationOverrides from "./PreventiveAutomationOverrides.jsx";
import PreventiveAutomationReview from "./PreventiveAutomationReview.jsx";
import PreventiveAutomationScriptPicker from "./PreventiveAutomationScriptPicker.jsx";

function modalTitle({ reviewMode, wizardMode, form }) {
  if (reviewMode) return "Revisar plano automatizado";
  if (wizardMode) return "Configurar automatização";
  return form.id ? "Editar plano" : "Novo plano";
}

function submitLabel({ saving, wizardMode, reviewMode }) {
  if (saving) return "Salvando...";
  if (!wizardMode) return "Salvar plano";
  return reviewMode ? "Salvar plano automatizado" : "Revisar plano automatizado";
}

function ModalFooter({ formState }) {
  const { wizardMode, reviewMode, saving, identity, closeModal, setReviewMode } = formState;
  let backLabel = "Cancelar";
  let onBack = closeModal;
  if (wizardMode && !reviewMode) backLabel = "Voltar às verificações";
  else if (reviewMode) {
    backLabel = "Voltar à automatização";
    onBack = () => setReviewMode(false);
  }

  return (
    <footer>
      <button type="button" className="secondary-action compact-action" onClick={onBack} disabled={saving}>
        {backLabel}
      </button>
      <button
        type="submit"
        className="primary-action compact-action"
        disabled={saving || identity.hasDuplicateAutomationIdentity}
      >
        {submitLabel({ saving, wizardMode, reviewMode })}
      </button>
    </footer>
  );
}

// Modal de criacao/edicao/assistente de automacao preventiva.
export default function PreventiveAutomationModal({ formState, plans, activeScripts, scopeSources }) {
  const { dialogRef, form, wizardMode, reviewMode, wizardContext, identity, closeModal, updateForm, toggleScript, submitForm } = formState;

  return (
    <div className="modal-backdrop preventive-automation-backdrop" role="presentation">
      <form
        ref={dialogRef}
        className={`modal-panel preventive-automation-modal ${wizardMode ? "wizard-mode" : ""}`}
        role="dialog"
        aria-modal="true"
        onSubmit={submitForm}
      >
        <header>
          <div>
            <span>{wizardMode ? "Etapa 3" : "Automação Preventiva"}</span>
            <h2>{modalTitle({ reviewMode, wizardMode, form })}</h2>
          </div>
          <button type="button" className="icon-button" onClick={closeModal} aria-label="Fechar">
            <XCircle size={18} />
          </button>
        </header>

        {wizardMode && wizardContext && <PreventiveAutomationContextSummary form={form} context={wizardContext} />}

        {reviewMode ? (
          <PreventiveAutomationReview
            form={form}
            wizardContext={wizardContext}
            scripts={activeScripts}
            scopeSources={scopeSources}
          />
        ) : (
          <>
            <PreventiveAutomationFormFields
              form={form}
              plans={plans}
              identity={identity}
              scopeSources={scopeSources}
              onChange={updateForm}
            />
            <PreventiveAutomationScriptPicker
              scripts={activeScripts}
              selectedIds={form.defaultScriptIds}
              onToggle={toggleScript}
            />
            <PreventiveAutomationOverrides formState={formState} scopeSources={scopeSources} />
          </>
        )}

        <ModalFooter formState={formState} />
      </form>
    </div>
  );
}
