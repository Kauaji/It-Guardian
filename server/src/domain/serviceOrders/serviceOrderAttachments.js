import { makeHttpError } from "./serviceOrderErrors.js";

const BLOCKED_ATTACHMENT_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".ps1", ".js", ".vbs", ".msi", ".scr", ".jar", ".com"
]);

export const serviceOrderAttachmentCategories = new Set([
  "evidencia", "orcamento", "foto", "documento", "print", "outro"
]);

function fileExtension(value) {
  const match = String(value || "").trim().match(/\.[a-z0-9]+$/i);
  return match ? match[0].toLowerCase() : "";
}

export function assertSafeAttachmentReference(value, fieldLabel) {
  const ext = fileExtension(value);
  if (ext && BLOCKED_ATTACHMENT_EXTENSIONS.has(ext)) {
    throw makeHttpError(`${fieldLabel} aponta para um tipo de arquivo não permitido (${ext}).`);
  }
}

/**
 * Valida e normaliza os metadados de um anexo (funcao pura). Lanca erro HTTP
 * 400 quando o nome esta vazio ou quando nome/referencia apontam para uma
 * extensao bloqueada. Os limites de tamanho espelham as colunas da tabela.
 */
export function normalizeServiceOrderAttachmentInput({
  fileName,
  fileType,
  fileSize,
  storageKey,
  category,
  description
}) {
  const normalizedFileName = String(fileName || "").trim();
  if (normalizedFileName.length < 1) {
    throw makeHttpError("Informe o nome do anexo.");
  }
  assertSafeAttachmentReference(normalizedFileName, "O nome do anexo");
  assertSafeAttachmentReference(storageKey, "A referência do anexo");

  const normalizedCategory = serviceOrderAttachmentCategories.has(category) ? category : "outro";
  const size = Number(fileSize);

  return {
    fileName: normalizedFileName.slice(0, 255),
    fileType: fileType ? String(fileType).slice(0, 100) : null,
    fileSize: Number.isFinite(size) && size >= 0 ? Math.trunc(size) : null,
    storageKey: storageKey ? String(storageKey).slice(0, 1000) : null,
    category: normalizedCategory,
    description: description ? String(description).slice(0, 1000) : null,
    historyName: normalizedFileName
  };
}
