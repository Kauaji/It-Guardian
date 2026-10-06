import { useEffect } from "react";
import { createMonitoringSocket } from "../../api.js";
import { normalizeAlertRecord } from "./alertNormalizers.js";

/** Aplica os snapshots do WebSocket de monitoramento ao estado em tempo real. */
export function useMonitoringStream({ applySegmentGroups, logout, notify, search, setSelectedDevice, state, status, token }) {
  const { segmentGroups, setAlerts, setAllDevices, setDevices, setLastUpdated, setSegments, setSummary } = state;

  useEffect(() => {
    const socket = createMonitoringSocket();

    if (!socket) return undefined;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== "monitoring.snapshot") return;

        setSummary(payload.summary);
        setAlerts((payload.alerts || []).map(normalizeAlertRecord));
        setLastUpdated(new Date(payload.updatedAt));
        setAllDevices(payload.devices);
        if (payload.segments) {
          setSegments(applySegmentGroups(payload.segments, segmentGroups));
        }

        if (!search && !status) {
          setDevices(payload.devices);
          setSelectedDevice((current) => {
            if (!current) return current;
            return payload.devices.find((device) => device.id === current.id) || current;
          });
        }
      } catch (_error) {
        notify("Não foi possível processar o streaming em tempo real.", "danger");
      }
    };

    socket.onclose = (event) => {
      if (event.code === 1008) {
        notify("Sessão de streaming não autorizada.", "danger");
        logout();
      }
    };

    return () => socket.close();
  }, [token, search, status, segmentGroups]);
}
