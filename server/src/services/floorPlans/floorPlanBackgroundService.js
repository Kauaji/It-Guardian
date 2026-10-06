import { createHash, randomUUID } from "node:crypto";
import { floorPlanBackgroundUrl, validateFloorPlanBackground } from "../../domain/floorPlans/floorPlanBackground.js";
import { makeHttpError } from "../../domain/floorPlans/floorPlanErrors.js";
import { getUserId } from "../../domain/floorPlans/floorPlanPayload.js";
import { addLog } from "../../repositories/logRepository.js";
import {
  clearFloorBackgroundUrl,
  deleteFloorPlanBackground,
  findFloorPlanBackground,
  floorExistsInPlan,
  setFloorBackgroundUrl,
  upsertFloorPlanBackground
} from "../../repositories/floorPlans/floorPlanBackgroundRepository.js";

export async function saveFloorPlanBackground(planId, floorId, buffer, mimeType, fileName, user = {}) {
  const clean = validateFloorPlanBackground(buffer, mimeType, fileName);
  if (!(await floorExistsInPlan(planId, floorId))) throw makeHttpError(404, "Andar da planta não encontrado.");
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const backgroundUrl = floorPlanBackgroundUrl(planId, floorId);
  await upsertFloorPlanBackground({
    id: randomUUID(),
    planId,
    floorId,
    fileName: clean.fileName,
    mimeType: clean.mimeType,
    buffer,
    sha256,
    userId: getUserId(user)
  });
  await setFloorBackgroundUrl(floorId, backgroundUrl);
  await addLog({
    type: "floor_plan.background_uploaded",
    message: `Imagem de fundo da planta ${planId} atualizada.`,
    userId: getUserId(user),
    meta: { planId, floorId, mimeType: clean.mimeType, byteSize: buffer.length, sha256 }
  });
  return { floorId, fileName: clean.fileName, mimeType: clean.mimeType, byteSize: buffer.length, sha256, backgroundUrl };
}

export async function getFloorPlanBackground(planId, floorId) {
  const background = await findFloorPlanBackground(planId, floorId);
  if (!background) throw makeHttpError(404, "Imagem de fundo não encontrada.");
  return background;
}

export async function removeFloorPlanBackground(planId, floorId, user = {}) {
  if (!(await deleteFloorPlanBackground(planId, floorId))) throw makeHttpError(404, "Imagem de fundo não encontrada.");
  await clearFloorBackgroundUrl(planId, floorId);
  await addLog({
    type: "floor_plan.background_removed",
    message: `Imagem de fundo da planta ${planId} removida.`,
    userId: getUserId(user),
    meta: { planId, floorId }
  });
  return { floorId };
}
