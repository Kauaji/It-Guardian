import { useState } from "react";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { defaultInventoryTab, getNextInventoryTabName, pickUnusedPaletteColor } from "../../components/inventory/inventoryLocalState.js";
import { reassignTabMeta } from "../inventory/inventoryMeta.js";

// Abas (ambientes) do inventario: criar, renomear, excluir e trocar a cor.
export function useInventoryTabActions({ inventory }) {
  const { notify } = useAppSession();
  const { model, persistence } = inventory;
  const { inventoryTabs } = model;
  const { saveInventoryTabMeta, saveInventoryTabs, setActiveInventoryTabId } = persistence;
  const [inventoryTabForm, setInventoryTabForm] = useState(null);

  function selectInventoryTab(tabId) {
    if (!inventoryTabs.some((tab) => tab.id === tabId)) return;
    setActiveInventoryTabId(tabId);
  }

  function createInventoryTab() {
    const cleanName = getNextInventoryTabName(inventoryTabs);

    const nextTab = {
      id: `tab-${Date.now()}`,
      name: cleanName,
      color: pickUnusedPaletteColor(inventoryTabs),
      order: inventoryTabs.length
    };

    saveInventoryTabs((current) => [...current, nextTab]);
    setActiveInventoryTabId(nextTab.id);
    notify(`Ambiente ${nextTab.name} criado.`, "ok");
  }

  function renameInventoryTab(tabId) {
    const tab = inventoryTabs.find((item) => item.id === tabId);
    if (!tab) return;
    setInventoryTabForm(tab);
  }

  function closeInventoryTabForm() {
    setInventoryTabForm(null);
  }

  function submitInventoryTabForm(name) {
    const cleanName = name.trim();
    const tabId = inventoryTabForm?.id;
    if (!cleanName || !tabId) return;
    const duplicate = inventoryTabs.some((item) => item.id !== tabId && item.name.trim().toLowerCase() === cleanName.toLowerCase());
    if (duplicate) {
      notify("Já existe uma aba com esse nome.", "danger");
      return;
    }

    saveInventoryTabs((current) => current.map((item) => (item.id === tabId ? { ...item, name: cleanName } : item)));
    setInventoryTabForm(null);
    notify("Ambiente renomeado.", "ok");
  }

  function deleteInventoryTab(tabId) {
    if (inventoryTabs.length <= 1) {
      notify("Mantenha pelo menos uma aba no inventário.", "danger");
      return;
    }

    const tab = inventoryTabs.find((item) => item.id === tabId);
    if (!tab) return;
    const remainingTabs = inventoryTabs.filter((item) => item.id !== tabId);
    const fallbackTab = remainingTabs[0] || defaultInventoryTab;
    const confirmed = window.confirm(`Excluir a aba "${tab.name}"? Os dados locais dela serão movidos para "${fallbackTab.name}".`);
    if (!confirmed) return;

    saveInventoryTabs(remainingTabs.map((item, index) => ({ ...item, order: index })));
    saveInventoryTabMeta((current) => reassignTabMeta(current, tabId, fallbackTab.id));
    setActiveInventoryTabId(fallbackTab.id);
    notify("Aba excluída. Dados movidos para outro ambiente.", "ok");
  }

  function changeInventoryTabColor(tabId, color) {
    saveInventoryTabs((current) => current.map((tab) => (tab.id === tabId ? { ...tab, color } : tab)));
  }

  return {
    changeInventoryTabColor,
    closeInventoryTabForm,
    createInventoryTab,
    deleteInventoryTab,
    inventoryTabForm,
    renameInventoryTab,
    selectInventoryTab,
    submitInventoryTabForm
  };
}
