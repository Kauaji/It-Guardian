import { DEFAULT_PLAN_SIZE } from "./editorGeometry.js";

/** Intervalo de datas (ISO) usado pelo mapa de calor de OS. */
export function getInfrastructurePeriodRange(period) {
  const end = new Date();
  const start = new Date(end);
  if (period === "current_month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (period === "previous_month") {
    start.setMonth(start.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(1);
    end.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - Number(period || 30));
  }
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/** Um segmento sem grupo (ou do mesmo grupo) e compativel com o grupo informado. */
export function isSegmentCompatibleWithGroup(segment, groupId) {
  return !groupId || !segment.groupId || segment.groupId === groupId;
}

export function filterCompatibleSegments(segments, groupId) {
  return groupId ? segments.filter((segment) => isSegmentCompatibleWithGroup(segment, groupId)) : segments;
}

/** Filtros enviados as APIs de resumo/mapa de calor (so inclui o que foi escolhido). */
export function buildInfrastructureFilters(groupId, segmentId) {
  return {
    ...(groupId ? { groupId } : {}),
    ...(segmentId ? { segmentId } : {})
  };
}

/** Ajusta a escala da imagem de fundo mantendo a proporcao do pavimento. */
export function buildBackgroundScaleSettings(settings, floor, scale) {
  return {
    ...settings,
    scale,
    width: Number(floor?.width || DEFAULT_PLAN_SIZE.width) * scale,
    height: Number(floor?.height || DEFAULT_PLAN_SIZE.height) * scale
  };
}

export const BACKGROUND_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const BACKGROUND_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Valida o arquivo escolhido para fundo (tipo e tamanho). */
export function isValidBackgroundFile(file) {
  return Boolean(file)
    && BACKGROUND_UPLOAD_TYPES.includes(file.type)
    && file.size <= BACKGROUND_UPLOAD_MAX_BYTES;
}
