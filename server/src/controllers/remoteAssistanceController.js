import {
  endRemoteAssistanceByAgent,
  endRemoteAssistanceByTechnician,
  getPendingRemoteAssistanceForAgent,
  getRemoteAssistanceCommandsForAgent,
  getRemoteAssistanceEvents,
  getRemoteAssistanceFrame,
  getRemoteAssistancePublicConfig,
  getRemoteAssistanceSession,
  getRemoteAssistanceWebrtcAnswer,
  getRemoteAssistanceWebrtcOfferForAgent,
  receiveRemoteAssistanceFrame,
  respondToRemoteAssistanceConsent,
  selectRemoteAssistanceMonitor,
  sendRemoteAssistanceInput,
  startRemoteAssistanceSession,
  submitRemoteAssistanceWebrtcAnswer,
  submitRemoteAssistanceWebrtcOffer,
  updateRemoteAssistanceCapture,
  updateRemoteAssistanceControl
} from "../services/remoteAssistanceService.js";

function bearerToken(req) {
  return String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
}

function sessionToken(req) {
  return String(req.headers["x-remote-session-token"] || "").trim();
}

function viewerToken(req) {
  return String(req.headers["x-remote-viewer-token"] || "").trim();
}

export function config(_req, res) {
  res.json(getRemoteAssistancePublicConfig());
}

export async function start(req, res, next) {
  try {
    const result = await startRemoteAssistanceSession({
      user: req.user,
      assetId: req.params.assetId,
      serviceOrderId: req.body?.serviceOrderId,
      requestedMode: req.body?.requestedMode,
      reason: req.body?.reason,
      reauthenticationToken: req.body?.reauthenticationToken
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
}

export async function read(req, res, next) {
  try {
    res.json({ session: await getRemoteAssistanceSession({ user: req.user, sessionId: req.params.id }) });
  } catch (error) { next(error); }
}

export async function events(req, res, next) {
  try {
    res.json({ events: await getRemoteAssistanceEvents({ user: req.user, sessionId: req.params.id }) });
  } catch (error) { next(error); }
}

export async function frame(req, res, next) {
  try {
    res.set("Cache-Control", "private, no-store, max-age=0");
    res.json(await getRemoteAssistanceFrame({
      user: req.user,
      sessionId: req.params.id,
      viewerToken: viewerToken(req)
    }));
  } catch (error) { next(error); }
}

export async function input(req, res, next) {
  try {
    res.status(202).json(await sendRemoteAssistanceInput({
      user: req.user,
      sessionId: req.params.id,
      viewerToken: viewerToken(req),
      command: req.body
    }));
  } catch (error) { next(error); }
}

export async function monitor(req, res, next) {
  try {
    res.json({ session: await selectRemoteAssistanceMonitor({
      user: req.user,
      sessionId: req.params.id,
      viewerToken: viewerToken(req),
      monitorId: req.body?.monitorId
    }) });
  } catch (error) { next(error); }
}

export async function control(req, res, next) {
  try {
    res.json({ session: await updateRemoteAssistanceControl({
      user: req.user,
      sessionId: req.params.id,
      viewerToken: viewerToken(req),
      enabled: req.body?.enabled
    }) });
  } catch (error) { next(error); }
}

export async function pause(req, res, next) {
  try {
    res.json({ session: await updateRemoteAssistanceCapture({
      user: req.user,
      sessionId: req.params.id,
      viewerToken: viewerToken(req),
      paused: req.body?.paused
    }) });
  } catch (error) { next(error); }
}

export async function end(req, res, next) {
  try {
    res.json({ session: await endRemoteAssistanceByTechnician({
      user: req.user,
      sessionId: req.params.id,
      viewerToken: viewerToken(req)
    }) });
  } catch (error) { next(error); }
}

export async function agentPending(req, res, next) {
  try { res.json(await getPendingRemoteAssistanceForAgent({ bearerToken: bearerToken(req) })); }
  catch (error) { next(error); }
}

export async function agentConsent(req, res, next) {
  try {
    res.json(await respondToRemoteAssistanceConsent({
      bearerToken: bearerToken(req),
      sessionId: req.params.id,
      sessionToken: sessionToken(req),
      granted: req.body?.granted,
      controlAllowed: req.body?.controlAllowed,
      monitors: req.body?.monitors,
      selectedMonitorId: req.body?.selectedMonitorId
    }));
  } catch (error) { next(error); }
}

export async function agentFrame(req, res, next) {
  try {
    res.status(202).json(await receiveRemoteAssistanceFrame({
      bearerToken: bearerToken(req),
      sessionId: req.params.id,
      sessionToken: sessionToken(req),
      frame: req.body?.frame,
      unchanged: req.body?.unchanged,
      monitors: req.body?.monitors,
      selectedMonitorId: req.body?.selectedMonitorId
    }));
  } catch (error) { next(error); }
}

export async function agentCommands(req, res, next) {
  try {
    res.json(await getRemoteAssistanceCommandsForAgent({
      bearerToken: bearerToken(req),
      sessionId: req.params.id,
      sessionToken: sessionToken(req)
    }));
  } catch (error) { next(error); }
}

export async function agentEnd(req, res, next) {
  try {
    res.json(await endRemoteAssistanceByAgent({
      bearerToken: bearerToken(req),
      sessionId: req.params.id,
      sessionToken: sessionToken(req)
    }));
  } catch (error) { next(error); }
}

export async function webrtcOffer(req, res, next) {
  try {
    res.status(202).json(await submitRemoteAssistanceWebrtcOffer({
      user: req.user,
      sessionId: req.params.id,
      viewerToken: viewerToken(req),
      sdp: req.body?.sdp
    }));
  } catch (error) { next(error); }
}

export async function webrtcAnswer(req, res, next) {
  try {
    res.json(await getRemoteAssistanceWebrtcAnswer({
      user: req.user,
      sessionId: req.params.id,
      viewerToken: viewerToken(req)
    }));
  } catch (error) { next(error); }
}

export async function agentWebrtcOffer(req, res, next) {
  try {
    res.json(await getRemoteAssistanceWebrtcOfferForAgent({
      bearerToken: bearerToken(req),
      sessionId: req.params.id,
      sessionToken: sessionToken(req)
    }));
  } catch (error) { next(error); }
}

export async function agentWebrtcAnswer(req, res, next) {
  try {
    res.status(202).json(await submitRemoteAssistanceWebrtcAnswer({
      bearerToken: bearerToken(req),
      sessionId: req.params.id,
      sessionToken: sessionToken(req),
      sdp: req.body?.sdp
    }));
  } catch (error) { next(error); }
}
