import { getAgentAutoUpdateInfo, getFrontendUrl, isRemoteScriptExecutionEnabled } from "../config/environment.js";
import {
  validateAgentPayload,
  validateEnrollmentName,
  validateJobResultPayload
} from "../domain/agentPayload.js";
import { isUpdateAvailable } from "../domain/agentVersion.js";
import { createPublicMachineToken } from "../domain/publicMachineToken.js";
import { AppError, conflict } from "../lib/errors.js";
import {
  authenticateAgentToken,
  createAgentEnrollment,
  listAgentEnrollments,
  revokeAgentEnrollment
} from "../repositories/agentRepository.js";
import { recordAgentInventory } from "./agentInventoryService.js";
import { resolveSignedUpdate } from "./agentSigningService.js";
import { claimNextAgentScriptJob, completeAgentScriptJob } from "./agentScriptJobService.js";

export { validateAgentPayload };

/** Autentica o token Bearer do agente; recusa (401) token ausente, invalido ou revogado. */
async function requireAgentEnrollment(token) {
  const enrollment = await authenticateAgentToken(token);
  if (!enrollment) {
    throw new AppError("Token do agente invalido ou revogado.", { statusCode: 401 });
  }
  return enrollment;
}

export async function receiveAgentInventory({ token, body }) {
  const enrollment = await requireAgentEnrollment(token);

  const asset = await recordAgentInventory({
    enrollment,
    payload: validateAgentPayload(body)
  });
  const job = await claimNextAgentScriptJob({
    assetId: asset.id,
    enrollmentId: enrollment.id
  });

  const autoUpdate = resolveSignedUpdate(getAgentAutoUpdateInfo());
  const updateAvailable = isUpdateAvailable(autoUpdate.version, String(body?.agentVersion || "").trim());

  return {
    assetId: asset.id,
    acceptedAt: new Date().toISOString(),
    intervalSeconds: asset.intervalSeconds,
    remoteScriptExecutionEnabled: isRemoteScriptExecutionEnabled(),
    job,
    latestVersion: updateAvailable ? autoUpdate.version : null,
    latestVersionDownloadUrl: updateAvailable ? autoUpdate.downloadUrl : null,
    latestVersionSha256: updateAvailable ? autoUpdate.sha256 : null,
    latestVersionSignature: updateAvailable ? autoUpdate.signature : null
  };
}

export async function completeAgentJob({ token, jobId, body }) {
  const enrollment = await requireAgentEnrollment(token);
  const { jobId: validJobId, result } = validateJobResultPayload({ jobId, body });

  return completeAgentScriptJob({ jobId: validJobId, enrollmentId: enrollment.id, result });
}

export async function getAgentSupportLink({ token }) {
  const enrollment = await requireAgentEnrollment(token);
  if (!enrollment.activationId) {
    throw conflict("Este agente nao possui uma ativacao vinculada.");
  }

  const publicAppUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "") || getFrontendUrl();
  const deviceToken = createPublicMachineToken(enrollment.activationId);
  return {
    supportUrl: `${publicAppUrl}/abrir-chamado?device=${encodeURIComponent(deviceToken)}`
  };
}

export async function createEnrollment({ name, userId }) {
  return createAgentEnrollment({ name: validateEnrollmentName(name), createdBy: userId });
}

export { listAgentEnrollments, revokeAgentEnrollment };
