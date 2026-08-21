import { badRequest, forbidden, notFoundError } from "../lib/errors.js";
import { hasPermission } from "../permissions.js";
import { addLog } from "../repositories/logRepository.js";
import { findServiceOrderById, getServiceOrderSettings, updateServiceOrderSettings } from "../repositories/serviceOrderRepository.js";
import { resolveProblemTypeKey } from "../domain/problemTypes.js";
import {
  applyChecklistTemplateToOrder,
  createChecklistTemplate,
  deleteChecklistTemplate,
  findActiveChecklistTemplateByProblemTypeKey,
  findChecklistTemplateById,
  hasIncompleteRequiredChecklistItems,
  listChecklistResults,
  listChecklistTemplates,
  updateChecklistResultItem,
  updateChecklistTemplate
} from "../repositories/serviceOrderChecklistRepository.js";

export async function listTemplates() {
  return listChecklistTemplates();
}

export async function createTemplate(payload, user) {
  const template = await createChecklistTemplate(payload || {});
  await addLog({
    type: "service_order_checklist_template_create",
    message: `Checklist template created: ${template.name}`,
    userId: user.id,
    meta: { templateId: template.id }
  });
  return template;
}

export async function updateTemplate(id, payload, user) {
  const template = await updateChecklistTemplate(id, payload || {});
  if (!template) throw notFoundError("Template de checklist não encontrado.");
  await addLog({
    type: "service_order_checklist_template_update",
    message: `Checklist template updated: ${template.name}`,
    userId: user.id,
    meta: { templateId: template.id }
  });
  return template;
}

export async function removeTemplate(id, user) {
  const existing = await findChecklistTemplateById(id);
  if (!existing) throw notFoundError("Template de checklist não encontrado.");
  await deleteChecklistTemplate(id);
  await addLog({
    type: "service_order_checklist_template_delete",
    message: `Checklist template deleted: ${existing.name}`,
    userId: user.id,
    meta: { templateId: id }
  });
  return { deleted: true };
}

// Chamada logo apos createServiceOrder (serviceOrderService.js) - resolve
// o problem_type informado (texto livre) pra chave normalizada e aplica o
// primeiro template ativo compativel, se houver. Silenciosa quando nao ha
// template configurado (checklist e opcional, nao obrigatorio por padrao).
export async function applyChecklistTemplateOnCreate(serviceOrder) {
  if (!serviceOrder?.problemType) return [];
  const problemTypeKey = await resolveProblemTypeKey(serviceOrder.problemType);
  if (!problemTypeKey) return [];
  const template = await findActiveChecklistTemplateByProblemTypeKey(problemTypeKey);
  if (!template) return [];
  return applyChecklistTemplateToOrder(serviceOrder.id, template);
}

export async function getChecklistForOrder(id, user) {
  const order = await findServiceOrderById(id, user);
  if (!order) throw notFoundError("Ordem de serviço não encontrada.");
  return listChecklistResults(id);
}

export async function updateChecklistItem(id, resultId, payload, user) {
  const order = await findServiceOrderById(id, user);
  if (!order) throw notFoundError("Ordem de serviço não encontrada.");

  const result = await updateChecklistResultItem(id, resultId, {
    checked: payload?.checked,
    notes: payload?.notes,
    user
  });
  if (!result) throw notFoundError("Item de checklist não encontrado.");

  const items = await listChecklistResults(id);
  const allChecked = items.length > 0 && items.every((item) => item.checked);
  if (allChecked) {
    await addLog({
      type: "service_order_checklist_completed",
      message: `Checklist concluído na OS ${order.number}.`,
      userId: user.id,
      meta: { serviceOrderId: id }
    });
  }

  return { item: result, items };
}

// Chamada dentro de changeServiceOrderStatus (serviceOrderService.js)
// antes de avancar pro status final - so bloqueia se a configuracao
// requireChecklistBeforeFinish estiver ligada.
export async function assertChecklistCompleteForFinish(serviceOrderId) {
  const settings = await getServiceOrderSettings();
  if (!settings.requireChecklistBeforeFinish) return;

  const incomplete = await hasIncompleteRequiredChecklistItems(serviceOrderId);
  if (incomplete) {
    throw badRequest("Existem itens obrigatórios do checklist não marcados. Finalize o checklist antes de concluir a OS.");
  }
}

export async function updateChecklistPolicy(payload, user) {
  if (!hasPermission(user, "service_orders.manage_checklists")) {
    throw forbidden("Sem permissão para alterar a política de checklist.");
  }
  const settings = await getServiceOrderSettings();
  const updated = await updateServiceOrderSettings({
    ...settings,
    requireChecklistBeforeFinish: Boolean(payload?.requireChecklistBeforeFinish)
  });
  await addLog({
    type: "service_order_checklist_policy_update",
    message: `Checklist obrigatorio: ${updated.requireChecklistBeforeFinish}`,
    userId: user.id
  });
  return updated;
}
