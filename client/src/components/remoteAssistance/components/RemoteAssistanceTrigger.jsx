import { MonitorUp } from "lucide-react";

// Botao que abre o dialogo de assistencia remota (cheio ou compacto).
export default function RemoteAssistanceTrigger({ compact, serviceOrder, visible, unavailableTitle, onOpen }) {
  return (
    <button
      type="button"
      className={compact ? "icon-button" : "ghost-action remote-assistance-trigger"}
      disabled={!visible}
      onClick={(event) => {
        if (compact) event.stopPropagation();
        if (!visible) return;
        onOpen();
      }}
      title={visible ? (serviceOrder ? "Acessar máquina" : "Atendimento remoto") : unavailableTitle}
      aria-label={serviceOrder ? "Acessar máquina" : "Atendimento remoto"}
    >
      <MonitorUp size={15} />
      {!compact && (serviceOrder ? "Acessar máquina" : "Atendimento remoto")}
    </button>
  );
}
