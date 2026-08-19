import {
  createTemplate,
  getChecklistForOrder,
  listTemplates,
  removeTemplate,
  updateChecklistItem,
  updateChecklistPolicy,
  updateTemplate
} from "../services/serviceOrderChecklistService.js";

export async function listTemplatesHandler(req, res, next) {
  try {
    const templates = await listTemplates();
    res.json({ templates });
  } catch (error) {
    next(error);
  }
}

export async function createTemplateHandler(req, res, next) {
  try {
    const template = await createTemplate(req.body, req.user);
    res.status(201).json({ template });
  } catch (error) {
    next(error);
  }
}

export async function updateTemplateHandler(req, res, next) {
  try {
    const template = await updateTemplate(req.params.id, req.body, req.user);
    res.json({ template });
  } catch (error) {
    next(error);
  }
}

export async function removeTemplateHandler(req, res, next) {
  try {
    const result = await removeTemplate(req.params.id, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateChecklistPolicyHandler(req, res, next) {
  try {
    const settings = await updateChecklistPolicy(req.body, req.user);
    res.json({ settings });
  } catch (error) {
    next(error);
  }
}

export async function getChecklistHandler(req, res, next) {
  try {
    const items = await getChecklistForOrder(req.params.id, req.user);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function updateChecklistItemHandler(req, res, next) {
  try {
    const result = await updateChecklistItem(req.params.id, req.params.resultId, req.body, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
