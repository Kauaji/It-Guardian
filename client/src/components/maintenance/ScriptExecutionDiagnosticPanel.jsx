import { useEffect, useState } from "react";
import { CheckCircle, HelpCircle, XCircle } from "lucide-react";
import { fetchScriptExecutionDiagnosis } from "../../api.js";

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function DiagnosticRow({ state, label, detail }) {
  const icon =
    state === "pass" ? (
      <CheckCircle size={15} />
    ) : state === "fail" ? (
      <XCircle size={15} />
    ) : (
      <HelpCircle size={15} />
    );
  return (
    <li className={`script-diagnostic-row script-diagnostic-${state}`}>
      {icon}
      <div>
        <span>{label}</span>
        {detail && <small>{detail}</small>}
      </div>
    </li>
  );
}

export default function ScriptExecutionDiagnosticPanel({ token, assetId, scriptId = null, context = "service_order" }) {
  const [diagnosis, setDiagnosis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !assetId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchScriptExecutionDiagnosis(token, { assetId, scriptId, context })
      .then((response) => {
        if (!cancelled) setDiagnosis(response.diagnosis);
      })
      .catch((fetchError) => {
        if (!cancelled) setError(fetchError.message || "Não foi possível calcular o diagnóstico.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, assetId, scriptId, context]);

  if (!assetId) return null;
  if (loading) return <p className="script-diagnostic-loading">Calculando diagnóstico de execução...</p>;
  if (error) return <p className="script-diagnostic-loading">{error}</p>;
  if (!diagnosis) return null;

  const rows = [
    {
      state: diagnosis.serverEnabled ? "pass" : "fail",
      label: "Servidor habilitado",
      detail: diagnosis.serverEnabled
        ? "ENABLE_REMOTE_SCRIPT_EXECUTION está ligado."
        : "ENABLE_REMOTE_SCRIPT_EXECUTION está desligado nesta instalação."
    },
    {
      state: diagnosis.agentRegistered ? "pass" : "fail",
      label: "Agente registrado",
      detail: diagnosis.agentRegistered ? "Esta máquina tem um enrollment ativo." : "Nenhum agente ativo para esta máquina."
    },
    {
      state: diagnosis.agentActive ? "pass" : "fail",
      label: "Agente com contato recente",
      detail: diagnosis.agentLastSeenAt
        ? `Último contato: ${formatDate(diagnosis.agentLastSeenAt)}.`
        : "Sem contato recente registrado."
    },
    {
      state: "unknown",
      label: "Coletor local permite execução remota",
      detail: "O servidor não recebe essa informação do coletor hoje — não é possível confirmar remotamente."
    },
    {
      state: diagnosis.userHasPermission ? "pass" : "fail",
      label: "Permissão do usuário",
      detail: diagnosis.userHasPermission ? "Você tem a permissão necessária." : "Você não tem a permissão necessária."
    }
  ];

  if (diagnosis.script) {
    rows.push({
      state: diagnosis.script.scriptActive ? "pass" : "fail",
      label: "Script ativo no catálogo",
      detail: diagnosis.script.scriptActive ? "" : "Este script foi desativado."
    });
    rows.push({
      state: diagnosis.script.scriptTypeAllowed ? "pass" : "fail",
      label: "Tipo de script permitido",
      detail: diagnosis.script.scriptTypeAllowed ? "" : "Somente BAT, CMD e PowerShell são enviados ao agente."
    });
    if (diagnosis.script.riskRequiresSecondReviewer) {
      const approved = diagnosis.script.secondReviewerSatisfied && diagnosis.userHasHighRiskApproval;
      rows.push({
        state: approved ? "pass" : "fail",
        label: "Controle duplo (risco alto/crítico)",
        detail: !diagnosis.script.secondReviewerSatisfied
          ? "Você foi quem editou este script por último — precisa de um segundo revisor."
          : !diagnosis.userHasHighRiskApproval
            ? "Falta a permissão de aprovação de risco alto/crítico (scripts.approve_high_risk)."
            : "Segundo revisor e permissão de aprovação confirmados."
      });
    }
  }

  return (
    <ul className="script-diagnostic-panel">
      {rows.map((row) => (
        <DiagnosticRow key={row.label} state={row.state} label={row.label} detail={row.detail} />
      ))}
    </ul>
  );
}
