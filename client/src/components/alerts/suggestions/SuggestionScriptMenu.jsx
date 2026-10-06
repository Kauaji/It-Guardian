import { KeyRound } from "lucide-react";
import { formatDisplayText } from "../alertUtils.js";
import { getSafeScriptLabel } from "../alertDisplayUtils.js";
import { useAlertCenterView } from "../AlertCenterViewContext.jsx";

function ScriptOption({ script, fallbackLabel, detail, disabled, onUse }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onUse(script)}>
      <span>{getSafeScriptLabel(script, fallbackLabel)}</span>
      <small>{formatDisplayText(detail, "Registro manual")}</small>
    </button>
  );
}

function ScriptPopover({ suggestion, scriptMenu, agentActive }) {
  const { perms } = useAlertCenterView();
  const state = scriptMenu.recommendationsBySuggestion[suggestion.id] || {};
  const recommended = state.recommended || [];
  const others = state.others || [];
  const error = state.error || "";
  const loading = scriptMenu.loadingId === suggestion.id;
  const isDisabled = (script) =>
    !perms.canUseScriptsFromAlerts || !agentActive || scriptMenu.usingKey === `${suggestion.id}:${script.id}`;
  const useScript = (script) => scriptMenu.useScript(suggestion, script);

  return (
    <div className="suggestion-script-popover">
      <strong>Scripts disponíveis</strong>
      {!perms.remoteScriptExecutionEnabled && (
        <p>Execução real desabilitada no servidor. Somente simulação e registro estão disponíveis.</p>
      )}
      {loading && <p>Carregando scripts...</p>}
      {error && <p>{error}</p>}
      {!!recommended.length && (
        <section>
          <em>Recomendado</em>
          {recommended.map((script) => (
            <ScriptOption
              key={script.id}
              script={script}
              fallbackLabel="Script recomendado"
              detail={script.recommendationReason || script.estimatedSummary}
              disabled={isDisabled(script)}
              onUse={useScript}
            />
          ))}
        </section>
      )}
      {!!others.length && (
        <section>
          <em>Outros scripts disponíveis</em>
          {others.map((script) => (
            <ScriptOption
              key={script.id}
              script={script}
              fallbackLabel="Script disponível"
              detail={script.estimatedSummary || script.category}
              disabled={isDisabled(script)}
              onUse={useScript}
            />
          ))}
        </section>
      )}
      {!loading && !recommended.length && !others.length && !error && <p>Nenhum script ativo cadastrado.</p>}
    </div>
  );
}

// Botao de chave do card + popover com os scripts recomendados e demais scripts ativos.
export default function SuggestionScriptMenu({ suggestion, scriptMenu, agentActive }) {
  return (
    <div className="suggestion-script-menu">
      <button
        type="button"
        className="icon-button suggestion-script-trigger"
        title="Scripts disponíveis"
        aria-label="Scripts disponíveis"
        onClick={() => scriptMenu.toggleMenu(suggestion.id)}
      >
        <KeyRound size={15} />
      </button>
      {scriptMenu.openSuggestionId === suggestion.id && (
        <ScriptPopover suggestion={suggestion} scriptMenu={scriptMenu} agentActive={agentActive} />
      )}
    </div>
  );
}
