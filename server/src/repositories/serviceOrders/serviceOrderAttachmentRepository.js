import { randomUUID } from "node:crypto";
import { query } from "../../database.js";
import { fromAttachmentRow } from "./serviceOrderMappers.js";

export async function listServiceOrderAttachments(serviceOrderId) {
  const result = await query(
    "SELECT * FROM service_order_attachments WHERE service_order_id = $1 ORDER BY uploaded_at DESC",
    [serviceOrderId]
  );
  return result.rows.map(fromAttachmentRow);
}

export async function insertServiceOrderAttachment({ serviceOrderId, attachment, uploadedBy }) {
  const result = await query(
    `
      INSERT INTO service_order_attachments (
        id, service_order_id, file_name, file_type, file_size, storage_key, category, description, uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      randomUUID(),
      serviceOrderId,
      attachment.fileName,
      attachment.fileType,
      attachment.fileSize,
      attachment.storageKey,
      attachment.category,
      attachment.description,
      uploadedBy
    ]
  );
  return fromAttachmentRow(result.rows[0]);
}

export async function deleteServiceOrderAttachmentRow(serviceOrderId, attachmentId) {
  const result = await query(
    "DELETE FROM service_order_attachments WHERE id = $1 AND service_order_id = $2 RETURNING *",
    [attachmentId, serviceOrderId]
  );
  return result.rows[0] ? fromAttachmentRow(result.rows[0]) : null;
}
