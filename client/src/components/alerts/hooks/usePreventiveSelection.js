import { useState } from "react";

function toggledSet(current, item) {
  const next = new Set(current);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
}

// Selecao da aba Preventivas: maquinas (etapa 1), scripts (etapa 2) e
// descricoes de script expandidas.
export default function usePreventiveSelection() {
  const [assets, setAssets] = useState(() => new Set());
  const [scripts, setScripts] = useState(() => new Set());
  const [expandedScripts, setExpandedScripts] = useState(() => new Set());

  function toggleAsset(assetId) {
    setAssets((current) => toggledSet(current, assetId));
  }

  function toggleScript(scriptId) {
    setScripts((current) => toggledSet(current, scriptId));
  }

  function toggleScriptDetails(scriptId) {
    setExpandedScripts((current) => toggledSet(current, scriptId));
  }

  // Marca todas as maquinas do segmento; se todas ja estavam marcadas, desmarca.
  function toggleSegment(assetIds) {
    setAssets((current) => {
      const next = new Set(current);
      const allSelected = assetIds.every((assetId) => next.has(assetId));

      for (const assetId of assetIds) {
        if (allSelected) next.delete(assetId);
        else next.add(assetId);
      }

      return next;
    });
  }

  function clearSelection() {
    setAssets(new Set());
    setScripts(new Set());
  }

  function clearAll() {
    clearSelection();
    setExpandedScripts(new Set());
  }

  return {
    assets,
    scripts,
    expandedScripts,
    toggleAsset,
    toggleScript,
    toggleScriptDetails,
    toggleSegment,
    clearSelection,
    clearAll
  };
}
