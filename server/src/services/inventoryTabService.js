import { addLog } from "../repositories/logRepository.js";
import {
  createInventoryTab,
  deleteInventoryTab,
  listInventoryTabs,
  reorderInventoryTabs,
  updateInventoryTab
} from "../repositories/inventoryTabRepository.js";
import { broadcastSnapshot } from "./realtimeService.js";

function notifySnapshot(context) {
  broadcastSnapshot().catch((error) => {
    console.error(`Realtime broadcast failed after ${context}`, error);
  });
}

export async function listAllInventoryTabs() {
  return listInventoryTabs();
}

export async function createTab({ id, name, color, sortOrder, order }, user) {
  const tab = await createInventoryTab({ id, name, color, sortOrder: sortOrder ?? order, userId: user.id });

  await addLog({
    type: "inventory_tab_create",
    message: `Inventory tab created: ${tab.name}`,
    userId: user.id,
    meta: { tabId: tab.id }
  });

  notifySnapshot("inventory tab create");
  return tab;
}

export async function updateTab(id, { name, color, sortOrder, order, active, isDefault }, user) {
  const tab = await updateInventoryTab({ id, name, color, sortOrder: sortOrder ?? order, active, isDefault });

  await addLog({
    type: "inventory_tab_update",
    message: `Inventory tab updated: ${tab.name}`,
    userId: user.id,
    meta: { tabId: tab.id }
  });

  notifySnapshot("inventory tab update");
  return tab;
}

export async function removeTab(id, user) {
  const tab = await deleteInventoryTab(id);

  await addLog({
    type: "inventory_tab_delete",
    message: `Inventory tab deleted: ${tab.name}`,
    userId: user.id,
    meta: { tabId: tab.id }
  });

  notifySnapshot("inventory tab delete");
  return tab;
}

export async function reorderTabs(tabIds, user) {
  const tabs = await reorderInventoryTabs(tabIds || []);

  await addLog({
    type: "inventory_tab_reorder",
    message: "Inventory tabs reordered",
    userId: user.id,
    meta: { tabIds: tabs.map((tab) => tab.id) }
  });

  notifySnapshot("inventory tab reorder");
  return tabs;
}
