import {
  completeAgentJob,
  createEnrollment,
  listAgentEnrollments,
  receiveAgentInventory,
  revokeAgentEnrollment
} from "../services/agentService.js";

function bearerToken(req) {
  const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function completeJob(req, res, next) {
  try {
    const result = await completeAgentJob({
      token: bearerToken(req),
      jobId: req.params.id,
      body: req.body
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function receive(req, res, next) {
  try {
    const result = await receiveAgentInventory({
      token: bearerToken(req),
      body: req.body
    });
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
}

export async function createManagedEnrollment(req, res, next) {
  try {
    const result = await createEnrollment({
      name: req.body?.name,
      userId: req.user.id
    });
    res.status(201).json({
      enrollment: result.enrollment,
      token: result.token,
      warning: "Este token e exibido apenas uma vez. Guarde-o em local seguro."
    });
  } catch (error) {
    next(error);
  }
}

export async function listManagedEnrollments(_req, res, next) {
  try {
    res.json({ enrollments: await listAgentEnrollments() });
  } catch (error) {
    next(error);
  }
}

export async function revokeManagedEnrollment(req, res, next) {
  try {
    const enrollment = await revokeAgentEnrollment(req.params.id);
    if (!enrollment) return res.status(404).json({ message: "Token ativo nao encontrado." });
    return res.json({ enrollment });
  } catch (error) {
    return next(error);
  }
}
