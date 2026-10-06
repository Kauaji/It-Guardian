import { MonitorCog } from "lucide-react";
import { fontScaleOptions } from "./appearancePresets.js";

export default function UsabilitySection({ preferences, onChangeFontScale }) {
  return (
    <div className="general-settings-section">
      <MonitorCog size={22} />
      <h3>Usabilidade</h3>
      <p>Preferências simples para leitura, comportamento e acessibilidade da interface.</p>
      <div className="font-scale-card">
        <div>
          <strong>Tamanho geral das fontes</strong>
          <span>Ajuste a escala sem alterar a estrutura dos cards, tabelas e modais.</span>
        </div>
        <div className="font-scale-options" role="group" aria-label="Tamanho geral das fontes">
          {fontScaleOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={preferences.fontScale === option.id ? "active" : ""}
              onClick={() => onChangeFontScale(option.id)}
            >
              <span>{option.label}</span>
              <small>{option.hint}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
