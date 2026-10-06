import { BriefcaseBusiness } from "lucide-react";

export default function SystemModeSection({ systemMode, onSystemModeChange }) {
  return (
    <div className="general-settings-section">
      <BriefcaseBusiness size={22} />
      <h3>Modo do sistema</h3>
      <p>Define se as Ordens de Serviço seguem o fluxo simples de uso interno ou o fluxo Business, mais completo e exigente.</p>
      <label className="business-mode-card">
        <input
          type="checkbox"
          checked={systemMode === "business"}
          onChange={(event) => onSystemModeChange?.(event.target.checked ? "business" : "local")}
        />
        <span>
          <strong>Ativar modo Business</strong>
          <small>{systemMode === "business" ? "Business ativo" : "Modo Local ativo"}</small>
        </span>
      </label>
    </div>
  );
}
