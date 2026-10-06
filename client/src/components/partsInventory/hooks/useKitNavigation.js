import { useEffect, useRef, useState } from "react";

// Visao "Kits por computador": modo da tela, aba do ambiente, kit expandido e kit em foco.
export function useKitNavigation({ tabs, loading, computerKits }) {
  const [viewMode, setViewMode] = useState("inventory");
  const [focusedKitAssetId, setFocusedKitAssetId] = useState("");
  const [expandedKitId, setExpandedKitId] = useState("");
  const [activeKitTabId, setActiveKitTabId] = useState(tabs[0]?.id || "");
  const focusedKit = useRef(null);

  useEffect(() => {
    if (!tabs.length) {
      setActiveKitTabId("");
      return;
    }
    if (!tabs.some((tab) => tab.id === activeKitTabId)) setActiveKitTabId(tabs[0].id);
  }, [activeKitTabId, tabs]);

  useEffect(() => {
    if (viewMode !== "kits" || !focusedKitAssetId || loading || !focusedKit.current) return;
    setExpandedKitId(focusedKitAssetId);
    focusedKit.current.focus({ preventScroll: true });
    focusedKit.current.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [computerKits, focusedKitAssetId, loading, viewMode]);

  function showKit(assetId, tabId) {
    setFocusedKitAssetId(assetId);
    setExpandedKitId(assetId);
    if (tabId && tabs.some((tab) => tab.id === tabId)) setActiveKitTabId(tabId);
    setViewMode("kits");
  }
  function resetKits() {
    setFocusedKitAssetId("");
    setExpandedKitId("");
  }
  function selectTab(tabId) {
    setActiveKitTabId(tabId);
    resetKits();
  }
  function toggleKit(assetId) {
    setExpandedKitId((current) => (current === assetId ? "" : assetId));
    setFocusedKitAssetId("");
  }

  return { viewMode, setViewMode, focusedKitAssetId, expandedKitId, activeKitTabId, focusedKit, showKit, resetKits, selectTab, toggleKit };
}
