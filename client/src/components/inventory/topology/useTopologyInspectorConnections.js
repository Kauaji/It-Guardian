import { useEffect, useState } from "react";
import { fetchNetworkTopologyMap, fetchNetworkTopologyMaps } from "../../../api.js";
import { isClusterNode } from "./networkTopologyModel.js";

export default function useTopologyInspectorConnections({ token, node, scopeKey, enabled }) {
  const type = isClusterNode(node) ? node.nodeType : null;
  const refId = type ? node.refId : null;
  const key = enabled && type && refId ? JSON.stringify([token, scopeKey, type, refId]) : null;
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    async function load() {
      try {
        // by-scope creates missing maps. Inspecting a node must remain read-only.
        const { maps } = await fetchNetworkTopologyMaps(token);
        if (cancelled) return;
        const map = maps.find((entry) => entry.scopeType === type && entry.scopeId === refId);
        const response = map ? await fetchNetworkTopologyMap(token, map.id) : null;
        if (!cancelled) setSnapshot({ key, links: response?.links || [], error: "" });
      } catch (error) {
        if (!cancelled) setSnapshot({ key, links: [], error: `Não foi possível carregar as conexões internas: ${error.message}` });
      }
    }
    load();
    return () => { cancelled = true; };
  }, [key, token, type, refId]);

  const current = snapshot?.key === key ? snapshot : null;
  return { links: current?.links || [], loading: Boolean(key && !current), error: current?.error || "" };
}
