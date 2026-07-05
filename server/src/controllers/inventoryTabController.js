import { addLog } from "../repositories/logRepository.js";
import {
  createInventoryTab,
  deleteInventoryTab,
  listInventoryTabs,
  reorderInventoryTabs,
  updateInventoryTab
} from "../repositories/inventoryTabRepository.js";
import { broadcastSnapshot } from "../services/realtimeService.js";

export async function list(_req, res, next) {
  try {
    const tabs = await listInventoryTabs();
    res.json({ tabs });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const tab = await createInventoryTab({ id: req.body.id, name: req.body.name, color: req.body.color, sortOrder: req.body.sortOrder ?? req.body.order, userId: req.user.id
    });

    await addLog({ type: "inventory_tab_create", message: `Inventory tab created: ${tab.name}`, userId: req.user.id, meta: { tabId: tab.id }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after inventory tab create", error);
    });

    res.status(201).json({ tab });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const tab = await updateInventoryTab({ id: req.params.id, name: req.body.name, color: req.body.color, sortOrder: req.body.sortOrder ?? req.body.order, active: req.body.active, isDefault: req.body.isDefault
    });

    await addLog({ type: "inventory_tab_update", message: `Inventory tab updated: ${tab.name}`, userId: req.user.id, meta: { tabId: tab.id }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after inventory tab update", error);
    });

    res.json({ tab });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const tab = await deleteInventoryTab(req.params.id);

    await addLog({ type: "inventory_tab_delete", message: `Inventory tab deleted: ${tab.name}`, userId: req.user.id, meta: { tabId: tab.id }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after inventory tab delete", error);
    });

    res.json({ tab });
  } catch (error) {
    next(error);
  }
}

export async function reorder(req, res, next) {
  try {
    const tabs = await reorderInventoryTabs(req.body.tabIds || req.body.ids || []);

    await addLog({ type: "inventory_tab_reorder", message: "Inventory tabs reordered", userId: req.user.id, meta: { tabIds: tabs.map((tab) => tab.id) }
    });

    broadcastSnapshot().catch((error) => {
      console.error("Realtime broadcast failed after inventory tab reorder", error);
    });

    res.json({ tabs });
  } catch (error) {
    next(error);
  }
}
