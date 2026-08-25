import { metersToPx } from "./unitConversion.js";

const MIN_MEASUREMENT_LENGTH = 8;
const DISPLAY_THICKNESS = 6;
const CONSTRAINED_ANGLE_STEP = 15;

export function isMeasurementObject(object) {
  return object?.objectType === "measurement";
}

/**
 * Mesma forma de wallGeometry.js#getWallSegment, generalizada pra uma
 * "espessura" so decorativa (linha fina de cota, nao parede de verdade).
 */
export function getMeasurementSegment(measurement) {
  const length = Math.max(MIN_MEASUREMENT_LENGTH, Number(measurement?.width || MIN_MEASUREMENT_LENGTH));
  const rotation = Number(measurement?.rotation || 0);
  const radians = rotation * Math.PI / 180;
  const center = {
    x: Number(measurement?.x || 0) + length / 2,
    y: Number(measurement?.y || 0) + Number(measurement?.height || DISPLAY_THICKNESS) / 2
  };
  const halfLength = length / 2;
  const direction = { x: Math.cos(radians), y: Math.sin(radians) };
  return {
    center,
    direction,
    length,
    rotation,
    start: { x: center.x - direction.x * halfLength, y: center.y - direction.y * halfLength },
    end: { x: center.x + direction.x * halfLength, y: center.y + direction.y * halfLength }
  };
}

/**
 * Regua livre: nem angulo nem comprimento travam num grid - o traco segue o
 * mouse pixel a pixel, como uma trena de verdade. So trava em passos de 15
 * graus quando constrainAngle (Shift) esta ativo. Quando overrideLengthPx
 * vem preenchido (usuario digitou um comprimento enquanto desenhava), ele
 * vence sobre a distancia bruta do mouse.
 */
export function snapMeasurementEndPoint(start, end, { constrainAngle = false, overrideLengthPx = null } = {}) {
  const deltaX = Number(end?.x || 0) - Number(start?.x || 0);
  const deltaY = Number(end?.y || 0) - Number(start?.y || 0);
  const rawLength = Math.hypot(deltaX, deltaY);
  const rawAngle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
  const angle = constrainAngle ? Math.round(rawAngle / CONSTRAINED_ANGLE_STEP) * CONSTRAINED_ANGLE_STEP : rawAngle;
  const length = overrideLengthPx != null
    ? Math.max(MIN_MEASUREMENT_LENGTH, overrideLengthPx)
    : Math.max(MIN_MEASUREMENT_LENGTH, rawLength);
  const radians = angle * Math.PI / 180;
  return {
    x: Number(start?.x || 0) + Math.cos(radians) * length,
    y: Number(start?.y || 0) + Math.sin(radians) * length,
    angle,
    length
  };
}

export function createMeasurementObjectFromPoints({ id, planId, floorId, start, end, constrainAngle = false, overrideLengthPx = null }) {
  const startPoint = { x: Number(start?.x || 0), y: Number(start?.y || 0) };
  const snappedEnd = snapMeasurementEndPoint(startPoint, end, { constrainAngle, overrideLengthPx });
  const centerX = (startPoint.x + snappedEnd.x) / 2;
  const centerY = (startPoint.y + snappedEnd.y) / 2;
  return {
    id,
    planId,
    floorId,
    objectType: "measurement",
    category: "annotation",
    label: "Medida",
    linkedAssetId: null,
    groupId: null,
    segmentId: null,
    x: centerX - snappedEnd.length / 2,
    y: centerY - DISPLAY_THICKNESS / 2,
    width: snappedEnd.length,
    height: DISPLAY_THICKNESS,
    rotation: snappedEnd.angle,
    z: 0,
    height3d: 0,
    color: "#334155",
    metadata: {
      geometryVersion: 1,
      startPoint,
      endPoint: { x: snappedEnd.x, y: snappedEnd.y }
    }
  };
}

/**
 * Constroi o buffer de digitos digitados enquanto a medida esta sendo
 * desenhada (ex.: "3,2"). Aceita virgula ou ponto como separador decimal
 * (normalizado pra virgula na exibicao), so um separador por vez, digitos
 * puros. Retorna o buffer inalterado para teclas que nao fazem parte dele.
 */
export function appendDigitToBuffer(buffer, key) {
  if (key === "Backspace") return buffer.slice(0, -1);
  if (/^[0-9]$/.test(key)) return buffer + key;
  if ((key === "," || key === ".") && !buffer.includes(",")) return buffer + ",";
  return buffer;
}

/**
 * Converte o buffer digitado (metros, pt-BR) num comprimento em pixels, ou
 * null se o buffer ainda nao forma um numero valido (vazio, so a virgula).
 */
export function parseTypedLengthBuffer(buffer, plan) {
  if (!buffer || buffer === ",") return null;
  const meters = Number(buffer.replace(",", "."));
  if (!Number.isFinite(meters) || meters <= 0) return null;
  return metersToPx(meters, plan);
}
