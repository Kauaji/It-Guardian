import { useMemo } from "react";
import { hasPermission } from "../../../permissions.js";
import {
  canShowRemoteAssistanceAction,
  hasRemoteAssistanceAgent,
  isRemoteAssistanceAssetFresh,
  isRemoteAssistanceFrontendEnabled
} from "../remoteAssistanceModel.js";
import { getUnavailableTitle } from "../utils/viewState.js";
import { useRemoteAssistanceConfig } from "./useRemoteAssistanceConfig.js";

// Permissoes do tecnico, elegibilidade do ativo e disponibilidade do botao.
export function useRemoteAvailability({ asset, user, token, compact }) {
  const frontendEnabled = isRemoteAssistanceFrontendEnabled();
  const frontendControlEnabled = import.meta.env.VITE_ENABLE_REMOTE_CONTROL === "true";
  const canView = hasPermission(user, "remote_assistance.view");
  const canStart = hasPermission(user, "remote_assistance.start");
  const eligible = useMemo(() => Boolean(asset?.id && isRemoteAssistanceAssetFresh(asset)), [asset]);
  const config = useRemoteAssistanceConfig({
    active: Boolean(frontendEnabled && canView && canStart && eligible),
    token
  });
  const visible = canShowRemoteAssistanceAction({
    frontendEnabled,
    canView,
    canStart,
    eligible,
    backendEnabled: config?.enabled
  });

  return {
    config,
    visible,
    frontendControlEnabled,
    canControl: hasPermission(user, "remote_assistance.control"),
    canChat: hasPermission(user, "remote_assistance.chat"),
    canEnd: hasPermission(user, "remote_assistance.end"),
    renderCompactSlot: Boolean(compact && asset?.id && hasRemoteAssistanceAgent(asset)),
    unavailableTitle: getUnavailableTitle({ frontendEnabled, canView, canStart, eligible, config })
  };
}
