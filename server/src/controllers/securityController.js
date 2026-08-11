import { reauthenticateForRemoteAssistance } from "../services/securityReauthenticationService.js";

export async function reauthenticate(req, res, next) {
  try {
    const result = await reauthenticateForRemoteAssistance({
      user: req.user,
      password: req.body?.password,
      action: req.body?.action ?? req.body?.reason,
      assetId: req.body?.assetId,
      serviceOrderId: req.body?.serviceOrderId,
      requestIp: req.ip,
      userAgent: req.headers["user-agent"]
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}
