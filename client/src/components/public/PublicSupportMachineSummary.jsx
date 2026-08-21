import { Monitor } from "lucide-react";

export default function PublicSupportMachineSummary({ deviceToken, machineContextLoading, machineContextError, machine }) {
  if (!deviceToken) return null;

  if (machineContextLoading) {
    return (
      <p className="public-support-machine-status">
        Identificando a máquina pelo link do instalador...
      </p>
    );
  }

  if (machineContextError || !machine?.id) {
    return (
      <p className="public-support-machine-status public-support-machine-status-warning">
        Não foi possível identificar a máquina pelo link. Você ainda pode abrir um chamado manualmente.
      </p>
    );
  }

  return (
    <div className="public-support-machine-status public-support-machine-status-ok">
      <Monitor size={18} />
      <div>
        <strong>Máquina identificada</strong>
        <span>{machine.name || machine.hostname}</span>
        {machine.environmentName && <span>{machine.environmentName}</span>}
      </div>
    </div>
  );
}
