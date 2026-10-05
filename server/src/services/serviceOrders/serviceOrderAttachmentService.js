import { normalizeServiceOrderAttachmentInput } from "../../domain/serviceOrders/serviceOrderAttachments.js";
import {
  deleteServiceOrderAttachmentRow,
  insertServiceOrderAttachment
} from "../../repositories/serviceOrders/serviceOrderAttachmentRepository.js";
import {
  addServiceOrderAssetHistory,
  addServiceOrderHistory
} from "../../repositories/serviceOrders/serviceOrderHistoryRepository.js";
import { findServiceOrderById } from "../../repositories/serviceOrders/serviceOrderReadRepository.js";

/**
 * Anexo metadata-only: nenhuma infraestrutura de upload/storage existe no
 * projeto hoje (sem multer, sem S3/disco). `storageKey` e uma referencia
 * em texto (link/descricao de onde a evidencia real esta guardada), nao
 * um upload binario - limitacao documentada em docs/ORDENS-DE-SERVICO.md.
 * A validacao de extensao ainda se aplica ao nome/referencia informados.
 */
export async function createServiceOrderAttachment({
  serviceOrderId,
  fileName,
  fileType,
  fileSize,
  storageKey,
  category,
  description,
  user
}) {
  const current = await findServiceOrderById(serviceOrderId);
  if (!current) return null;

  const attachment = normalizeServiceOrderAttachmentInput({
    fileName,
    fileType,
    fileSize,
    storageKey,
    category,
    description
  });
  const created = await insertServiceOrderAttachment({
    serviceOrderId,
    attachment,
    uploadedBy: user?.id || null
  });

  await addServiceOrderHistory({
    serviceOrderId,
    eventType: "attachment_added",
    message: `Anexo adicionado: ${attachment.historyName}.`,
    newValue: attachment.historyName,
    user
  });
  await addServiceOrderAssetHistory({
    assetId: current.assetId,
    serviceOrder: current,
    eventType: "attachment_added",
    message: `anexo adicionado: ${attachment.historyName}.`,
    newValue: attachment.historyName,
    user
  });

  return created;
}

export async function deleteServiceOrderAttachment(serviceOrderId, attachmentId, user = null) {
  const current = await findServiceOrderById(serviceOrderId);
  if (!current) return null;

  const deleted = await deleteServiceOrderAttachmentRow(serviceOrderId, attachmentId);
  if (!deleted) return null;

  await addServiceOrderHistory({
    serviceOrderId,
    eventType: "attachment_removed",
    message: `Anexo removido: ${deleted.fileName}.`,
    oldValue: deleted.fileName,
    user
  });
  await addServiceOrderAssetHistory({
    assetId: current.assetId,
    serviceOrder: current,
    eventType: "attachment_removed",
    message: `anexo removido: ${deleted.fileName}.`,
    oldValue: deleted.fileName,
    user
  });

  return deleted;
}
