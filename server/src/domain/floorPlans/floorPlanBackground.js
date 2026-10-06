import { makeHttpError } from "./floorPlanErrors.js";

/** @type {Record<string, (buffer: Buffer) => boolean>} Assinatura (magic bytes) de cada formato aceito. */
const BACKGROUND_MIME_SIGNATURES = {
  "image/png": (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  "image/jpeg": (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  "image/webp": (buffer) => buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP"
};

/**
 * @param {unknown} buffer
 * @param {unknown} mimeType
 * @param {unknown} [fileName]
 * @returns {{ mimeType: string, fileName: string }}
 * @throws {Error} 400/413 para imagem vazia, grande demais ou com assinatura que nao confere.
 */
export function validateFloorPlanBackground(buffer, mimeType, fileName = "planta") {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw makeHttpError(400, "Selecione uma imagem para a planta.");
  if (buffer.length > 8 * 1024 * 1024) throw makeHttpError(413, "A imagem deve ter no máximo 8 MB.");
  const normalizedMime = String(mimeType || "").split(";", 1)[0].trim().toLowerCase();
  if (!BACKGROUND_MIME_SIGNATURES[normalizedMime]?.(buffer)) throw makeHttpError(400, "Arquivo inválido. Envie PNG, JPG ou WEBP verdadeiro.");
  const extension = normalizedMime === "image/png" ? ".png" : normalizedMime === "image/webp" ? ".webp" : ".jpg";
  const base = String(fileName || "planta").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9._-]+/gi, "-").replace(/\.(png|jpe?g|webp)$/i, "").slice(0, 100) || "planta";
  return { mimeType: normalizedMime, fileName: `${base}${extension}` };
}

/**
 * @param {string} planId
 * @param {string} floorId
 * @returns {string}
 */
export function floorPlanBackgroundUrl(planId, floorId) {
  return `/api/floor-plans/${planId}/floors/${floorId}/background`;
}
