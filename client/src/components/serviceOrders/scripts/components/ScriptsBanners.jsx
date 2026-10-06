import { ShieldAlert } from "lucide-react";

// Avisos de execucao real desabilitada ou bloqueada (um ou outro, nunca os dois).
export default function ScriptsBanners({ remoteScriptExecutionEnabled, reason }) {
  return (
    <>
      {!remoteScriptExecutionEnabled && (
        <p className="service-order-scripts-banner">
          <ShieldAlert size={16} />
          Execução real desabilitada. Este script pode ser registrado em modo simulação, mas não será enviado ao agente.
        </p>
      )}
      {reason && remoteScriptExecutionEnabled && (
        <p className="service-order-scripts-banner">
          <ShieldAlert size={16} />
          {reason}
        </p>
      )}
    </>
  );
}
