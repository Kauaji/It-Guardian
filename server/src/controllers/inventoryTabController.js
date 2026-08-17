import {
  createTab,
  listAllInventoryTabs,
  removeTab,
  reorderTabs,
  updateTab
} from "../services/inventoryTabService.js";

export async function list(_req, res, next) {
  try {
    const tabs = await listAllInventoryTabs();
    res.json({ tabs });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const tab = await createTab(req.body, req.user);
    res.status(201).json({ tab });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const tab = await updateTab(req.params.id, req.body, req.user);
    res.json({ tab });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    const tab = await removeTab(req.params.id, req.user);
    res.json({ tab });
  } catch (error) {
    next(error);
  }
}

export async function reorder(req, res, next) {
  try {
    const tabs = await reorderTabs(req.body.tabIds || req.body.ids || [], req.user);
    res.json({ tabs });
  } catch (error) {
    next(error);
  }
}
