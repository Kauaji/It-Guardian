import { CheckCircle2, Clock3, RefreshCw, WifiOff } from "lucide-react";
import { remoteAssistanceStatusLabel } from "../remoteAssistanceModel.js";

export default function RemoteStatus({ session }) {
  const displayState = session?.connectionState || session?.status;
  const denied = session?.status === "consent_denied" || session?.status === "failed";
  const unstable = displayState === "reconnecting" || displayState === "agent_offline";
  const settled = displayState === "active";
  const Icon = denied ? WifiOff : unstable ? RefreshCw : settled ? CheckCircle2 : Clock3;
  return (
    <span className={`remote-assistance-status status-${displayState || "idle"}`}>
      <Icon size={15} className={unstable ? "spin" : undefined} />
      {remoteAssistanceStatusLabel(displayState)}
    </span>
  );
}
