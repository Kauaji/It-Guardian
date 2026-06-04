import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, FileCode2, ShieldCheck } from "lucide-react";

const emptyForm = {
  name: "",
  description: "",
  type: "powershell",
  content: "",
  category: "",
  riskLevel: "medium",
  requiresConfirmation: true,
  alertType: "",
  problemType: ""
};

const scriptTypeLabels = {
  bat: "BAT",
  cmd: "CMD",
  powershell: "PowerShell",
  shell: "Shell",
  other: "Outro"
};

const riskLabels = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico"
};

function formatRisk(risk) {
  return riskLabels[risk] || risk || "Médio";
}

function buildScriptPayload(form, analysis) {
  return {
    name: form.name,
    description: form.description,
    type: form.type,
    content: form.content,
    category: form.category,
    riskLevel: form.riskLevel,
    requiresConfirmation: form.requiresConfirmation,
    alertType: form.alertType,
    problemType: form.problemType,
    estimatedSummary: analysis?.estimatedSummary,
    suggestedRiskLevel: analysis?.suggestedRiskLevel
  };
}

function ScriptAnalysis({ analysis }) {
  if (!analysis) return null;

  return (
    <div className="script-analysis-box">
      <strong>Resumo estimado</strong>
      <p>{analysis.estimatedSummary}</p>
      <span className={`script-risk-pill ${analysis.suggestedRiskLevel}`}>
        Risco sugerido: {formatRisk(analysis.suggestedRiskLevel)}
      </span>
      {!!analysis.detectedActions?.length && (
        <ul>
          {analysis.detectedActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      )}
      <small>{analysis.safetyWarnings?.join(" ")}</small>
    </div>
  );
}

function SimulationForm({ script, devices, serviceOrders, alerts, onRegister }) {
  const [assetId, setAssetId] = useState("");
  const [serviceOrderId, setServiceOrderId] = useState("");
  const [alertId, setAlertId] = useState("");
  const [mode, setMode] = useState("simulated");
  const [notes, setNotes] = useState("");
  const highRisk = script.riskLevel === "high" || script.riskLevel === "critical";

  async function handleSubmit(event) {
    event.preventDefault();
    const baseConfirmation =
      "Esta ação apenas registrará uma simulação/intenção de execução. Nenhum comando será executado na máquina ou no servidor.";

    if (!window.confirm(baseConfirmation)) return;

    if (highRisk) {
      const riskConfirmation =
        "Este script foi marcado como alto risco. A execução real não está disponível nesta versão. Deseja apenas registrar a simulação?";
      if (!window.confirm(riskConfirmation)) return;
    }

    try {
      await onRegister(script.id, {
        assetId,
        serviceOrderId,
        alertId,
        mode,
        notes,
        confirmed: true,
        riskAcknowledged: highRisk
      });

      setNotes("");
    } catch {
      // A mensagem amigável já é exibida pelo App.
    }
  }

  return (
    <form className="script-simulation-form" onSubmit={handleSubmit}>
      <label>
        Máquina
        <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
          <option value="">Sem máquina vinculada</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name} - {device.ip || "sem IP"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ordem de Serviço
        <select value={serviceOrderId} onChange={(event) => setServiceOrderId(event.target.value)}>
          <option value="">Sem OS vinculada</option>
          {serviceOrders.map((order) => (
            <option key={order.id} value={order.id}>
              {order.number} - {order.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Aviso
        <select value={alertId} onChange={(event) => setAlertId(event.target.value)}>
          <option value="">Sem aviso vinculado</option>
          {alerts.map((alert) => (
            <option key={alert.id} value={alert.id}>
              {alert.title} - {alert.hostName || "sem máquina"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Modo
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="simulated">Simulado</option>
          <option value="prepared">Preparado</option>
        </select>
      </label>
      <label className="script-simulation-notes">
        Observação
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Contexto do registro. Nenhum comando será executado."
          rows={3}
        />
      </label>
      <button type="submit" className="primary-action compact-action">
        <ClipboardCheck size={16} />
        Registrar simulação
      </button>
    </form>
  );
}

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
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const activeScripts = useMemo(() => scripts.filter((script) => script.active !== false), [scripts]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setAnalysis(null);
  }

  async function handleAnalyze() {
    const result = await onAnalyze({ content: form.content, type: form.type });
    setAnalysis(result);
    if (result?.suggestedRiskLevel) {
      setForm((current) => ({ ...current, riskLevel: result.suggestedRiskLevel }));
    }
    return result;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      const result = analysis || (await handleAnalyze());
      if (!window.confirm("Deseja cadastrar este script com este resumo estimado?")) return;
      await onSave(buildScriptPayload(form, result), editingId);
      resetForm();
    } catch {
      // A mensagem amigável já é exibida pelo App.
    }
  }

  function editScript(script) {
    setEditingId(script.id);
    setForm({
      name: script.name || "",
      description: script.description || "",
      type: script.type || "other",
      content: script.content || "",
      category: script.category || "",
      riskLevel: script.riskLevel || "medium",
      requiresConfirmation: script.requiresConfirmation !== false,
      alertType: script.alertType || "",
      problemType: script.problemType || ""
    });
    setAnalysis({
      estimatedSummary: script.estimatedSummary,
      suggestedRiskLevel: script.suggestedRiskLevel,
      detectedActions: [],
      safetyWarnings: ["Resumo salvo anteriormente. Revise manualmente antes de usar."]
    });
  }

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
          <span>
            Execução real indisponível nesta versão. Somente registro/simulação. Nenhum comando será executado.
          </span>
        </div>
      )}

      {canManage && showForm && (
        <form className="maintenance-script-form" onSubmit={handleSubmit}>
          <label>
            Nome
            <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} maxLength={120} required />
          </label>
          <label>
            Tipo
            <select value={form.type} onChange={(event) => updateForm("type", event.target.value)}>
              {Object.entries(scriptTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Categoria
            <input value={form.category} onChange={(event) => updateForm("category", event.target.value)} maxLength={80} />
          </label>
          <label>
            Risco
            <select value={form.riskLevel} onChange={(event) => updateForm("riskLevel", event.target.value)}>
              {Object.entries(riskLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="maintenance-script-wide">
            Descrição
            <textarea
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              maxLength={500}
              rows={3}
            />
          </label>
          <label>
            Tipo de aviso
            <input value={form.alertType} onChange={(event) => updateForm("alertType", event.target.value)} maxLength={80} />
          </label>
          <label>
            Tipo de problema
            <input value={form.problemType} onChange={(event) => updateForm("problemType", event.target.value)} maxLength={120} />
          </label>
          <label className="inline-check maintenance-script-checkbox">
            <input
              type="checkbox"
              checked={form.requiresConfirmation}
              onChange={(event) => updateForm("requiresConfirmation", event.target.checked)}
            />
            Exige confirmação
          </label>
          <label className="maintenance-script-wide">
            Conteúdo do script tratado apenas como texto
            <textarea
              value={form.content}
              onChange={(event) => updateForm("content", event.target.value)}
              maxLength={10000}
              rows={9}
              required
            />
          </label>
          <ScriptAnalysis analysis={analysis} />
          <div className="script-form-actions">
            <button type="button" className="secondary-action compact-action" onClick={() => handleAnalyze().catch(() => null)}>
              Analisar texto
            </button>
            <button type="submit" className="primary-action compact-action">
              {editingId ? "Salvar alterações" : "Cadastrar script"}
            </button>
            <button type="button" className="secondary-action compact-action" onClick={resetForm}>
              Limpar
            </button>
          </div>
        </form>
      )}

      <div className="maintenance-script-grid">
        {activeScripts.map((script) => (
          <article key={script.id} className={`maintenance-script-card ${script.riskLevel}`}>
            <div className="script-card-header">
              <div>
                <h3>{script.name}</h3>
                <span>{scriptTypeLabels[script.type] || script.type} - {script.category || "Sem categoria"}</span>
              </div>
              <span className={`script-risk-pill ${script.riskLevel}`}>{formatRisk(script.riskLevel)}</span>
            </div>
            {script.description && <p>{script.description}</p>}
            <div className="script-card-summary">
              <strong>Resumo estimado</strong>
              <p>{script.estimatedSummary || "Resumo não informado."}</p>
              <small>Nenhum comando será executado por este módulo.</small>
            </div>
            <pre className="script-content-preview">{script.content}</pre>
            {(script.alertType || script.problemType) && (
              <div className="script-links">
                {script.alertType && <span>Aviso: {script.alertType}</span>}
                {script.problemType && <span>Problema: {script.problemType}</span>}
              </div>
            )}
            {canManage && (
              <div className="script-card-actions">
                <button type="button" className="secondary-action compact-action" onClick={() => editScript(script)}>
                  Editar
                </button>
                <button type="button" className="danger-action compact-action" onClick={() => deactivateScript(script)}>
                  Desativar
                </button>
              </div>
            )}
            {canRegisterSimulation && showSimulation && (
              <SimulationForm
                script={script}
                devices={devices}
                serviceOrders={serviceOrders}
                alerts={alerts}
                onRegister={onRegisterSimulation}
              />
            )}
          </article>
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
