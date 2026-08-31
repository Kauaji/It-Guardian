import { useCallback, useEffect, useRef, useState } from "react";
import { createNetworkTopologyLink, fetchNetworkTopologyMap } from "../../../api.js";
import {
  buildTopologyLinkPayload,
  hasTopologyConnectionPair,
  hasTopologyConnectionPartner,
  linkConnectsNodes,
  topologyNodeKey
} from "./networkTopologyConnections.js";

export default function useTopologyLinkCreation({ token, mapId, scopeKey, enabled, nodes, links, onCreated, notify }) {
  const [active, setActive] = useState(false);
  const [sourceNodeId, setSourceNodeId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const activeRef = useRef(false);
  const sourceRef = useRef(null);
  const busyRef = useRef(false);
  const version = useRef(0);

  const reset = useCallback(() => {
    activeRef.current = false;
    sourceRef.current = null;
    setActive(false);
    setSourceNodeId(null);
    setError("");
  }, []);

  useEffect(() => {
    version.current += 1;
    busyRef.current = false;
    setBusy(false);
    reset();
    return () => { version.current += 1; };
  }, [token, mapId, scopeKey, reset]);

  useEffect(() => { if (!enabled) reset(); }, [enabled, reset]);

  const start = useCallback((node = null) => {
    if (
      !enabled ||
      !mapId ||
      busyRef.current ||
      !hasTopologyConnectionPair(nodes) ||
      (node && !hasTopologyConnectionPartner(nodes, node))
    ) return;
    activeRef.current = true;
    sourceRef.current = node;
    setActive(true);
    setSourceNodeId(node?.id || null);
    setError("");
  }, [enabled, mapId, nodes]);

  const toggle = useCallback(() => {
    if (busyRef.current) return;
    if (activeRef.current) reset();
    else start();
  }, [reset, start]);

  const activate = useCallback((node) => {
    if (!enabled || !activeRef.current || !node) return false;
    if (busyRef.current) return true;
    const source = sourceRef.current;
    if (!source) {
      if (!hasTopologyConnectionPartner(nodes, node)) {
        setError("Não há outro item do mesmo tipo visível para conectar.");
        return true;
      }
      sourceRef.current = node;
      setSourceNodeId(node.id);
      setError("");
      return true;
    }
    if (topologyNodeKey(source) === topologyNodeKey(node)) {
      setError("Selecione outro item como destino.");
      return true;
    }
    if ((source.nodeType || "asset") !== (node.nodeType || "asset")) {
      setError("Conecte itens do mesmo tipo: grupo com grupo, segmento com segmento ou ativo com ativo.");
      return true;
    }
    const existing = links.find((link) => linkConnectsNodes(link, source, node));
    if (existing) {
      reset();
      onCreated(mapId, existing, false);
      notify?.("info", "Estes itens já possuem uma conexão neste mapa.");
      return true;
    }
    const requestVersion = version.current;
    busyRef.current = true;
    setBusy(true);
    setError("");
    async function save() {
      try {
        const response = await createNetworkTopologyLink(token, mapId, buildTopologyLinkPayload(source, node));
        if (version.current !== requestVersion) return;
        reset();
        onCreated(mapId, response.link, true);
        notify?.("success", "Conexão salva. Clique na linha para editar seus detalhes.");
      } catch (saveError) {
        if (version.current !== requestVersion) return;
        // A timeout can follow a successful write. Reconcile the same map,
        // rather than blindly issuing a second POST for the pair.
        if (!saveError.statusCode || saveError.statusCode === 409 || saveError.statusCode >= 500) {
          try {
            const response = await fetchNetworkTopologyMap(token, mapId);
            if (version.current !== requestVersion) return;
            const saved = response.links.find((link) => linkConnectsNodes(link, source, node));
            if (saved) {
              reset();
              onCreated(mapId, saved, false);
              notify?.("info", "A conexão já está salva neste mapa.");
              return;
            }
          } catch { /* Keep the original error and allow an explicit retry. */ }
        }
        if (version.current === requestVersion) {
          setError(saveError.message);
          notify?.("error", saveError.message);
        }
      } finally {
        if (version.current === requestVersion) {
          busyRef.current = false;
          setBusy(false);
        }
      }
    }
    save();
    return true;
  }, [enabled, links, mapId, token, nodes, onCreated, notify, reset]);

  return { active, sourceNodeId, busy, error, start, toggle, activate, reset };
}
