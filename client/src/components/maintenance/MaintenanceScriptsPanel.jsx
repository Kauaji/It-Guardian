import { useMemo } from "react";
import { AlertTriangle, FileCode2, ShieldCheck } from "lucide-react";
import ScriptAnalysis from "./scripts/ScriptAnalysis.jsx";
import ScriptCard from "./scripts/ScriptCard.jsx";
import ScriptFormFields from "./scripts/ScriptFormFields.jsx";
import { useScriptForm } from "./scripts/useScriptForm.js";

export default function MaintenanceScriptsPanel({
  scripts,
  devices,
  serviceOrders,
  alerts,
  canManage,
  canRegisterSimulation,
  showHeader = true,
  showSafetyBanner = true,
  showForm = true,
  showSimulation = true,
  compact = false,
  onAnalyze,
  onSave,
  onDeactivate,
  onRegisterSimulation
}) {
  const scriptForm = useScriptForm({ onAnalyze, onSave });
  const { form, analysis, editingId } = scriptForm;
  const activeScripts = useMemo(() => scripts.filter((script) => script.active !== false), [scripts]);

  async function deactivateScript(script) {
    if (!window.confirm(`Desativar o script "${script.name}"?`)) return;
    try {
      await onDeactivate(script.id);
    } catch {
      // A mensagem amigável já é exibida pelo App.
    }
  }

  return (
    <section className={`panel maintenance-scripts-panel ${compact ? "compact" : ""}`}>
      {showHeader && (
        <div className="panel-heading">
          <div>
            <h2>Scripts de manutenção</h2>
            <p>Base segura para cadastro, análise textual e registro de simulação.</p>
          </div>
          <FileCode2 size={18} />
        </div>
      )}

      {showSafetyBanner && (
        <div className="script-safety-banner">
          <ShieldCheck size={18} />
          <span>Execução real indisponível nesta versão. Somente registro/simulação. Nenhum comando será executado.</span>
        </div>
      )}

      {canManage && showForm && (
        <form
          ref={scriptForm.formRef}
          className={`maintenance-script-form ${analysis ? "has-analysis" : "needs-analysis"}`}
          onSubmit={scriptForm.handleSubmit}
        >
          <ScriptFormFields form={form} onChange={scriptForm.updateForm} onChangeContent={scriptForm.changeContent} />
          <ScriptAnalysis analysis={analysis} />
          <div className="script-form-actions">
            {analysis && (
              <button type="submit" className="primary-action compact-action">
                {editingId ? "Salvar alterações" : "Cadastrar script"}
              </button>
            )}
            <button type="button" className="secondary-action compact-action" onClick={() => scriptForm.handleAnalyze().catch(() => null)}>
              Analisar texto
            </button>
            <button type="button" className="secondary-action compact-action" onClick={scriptForm.resetForm}>
              Limpar
            </button>
          </div>
        </form>
      )}

      <div className="maintenance-script-grid">
        {activeScripts.map((script) => (
          <ScriptCard
            key={script.id}
            script={script}
            devices={devices}
            serviceOrders={serviceOrders}
            alerts={alerts}
            canManage={canManage}
            showSimulationForm={canRegisterSimulation && showSimulation}
            onEdit={scriptForm.editScript}
            onDeactivate={deactivateScript}
            onRegisterSimulation={onRegisterSimulation}
          />
        ))}
        {!activeScripts.length && (
          <div className="script-empty-state">
            <AlertTriangle size={20} />
            <p>Nenhum script de manutenção ativo cadastrado.</p>
          </div>
        )}
      </div>
    </section>
  );
}
