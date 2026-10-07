import { Terminal } from "lucide-react";
import PulseDot from "../../../ui/PulseDot.jsx";
import { ACTIVE_JOB_STATUSES, formatScriptDate, getEntryStatus, STATUS_LABELS } from "../utils/scriptRules.js";

function ScriptActivityEntry({ entry }) {
  const entryStatus = getEntryStatus(entry);
  const isActive = ACTIVE_JOB_STATUSES.has(entryStatus);
  return (
    <li>
      <Terminal size={14} />
      <div>
        <strong>{entry.scriptName || "Script"}</strong>
        <span>
          {isActive && (
            <PulseDot
              tone={entryStatus === "claimed" ? "ok" : "warning"}
              title={entryStatus === "claimed" ? "Executando agora no agente" : "Aguardando o agente"}
            />
          )}
          {STATUS_LABELS[entryStatus] || entryStatus} · {formatScriptDate(entry.executedAt || entry.createdAt)}
        </span>
        {entry.job?.stdout && <p className="service-order-script-output">{entry.job.stdout.slice(0, 400)}</p>}
        {entry.job?.stderr && <p className="service-order-script-output error">{entry.job.stderr.slice(0, 400)}</p>}
        {entry.job?.errorMessage && <p className="service-order-script-output error">{entry.job.errorMessage}</p>}
      </div>
    </li>
  );
}

export default function ScriptActivityList({ activity }) {
  return (
    <div className="service-order-scripts-activity">
      <h4>Atividade</h4>
      {!activity.length && <p className="empty">Nenhum script executado nesta OS ainda.</p>}
      <ul>
        {activity.map((entry) => (
          <ScriptActivityEntry key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  );
}
