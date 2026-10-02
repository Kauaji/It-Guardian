import { clearSessionCookie, setSessionCookie } from "../security/sessionCookie.js";
import {
  authenticateWithCredentials,
  changeOwnPassword,
  completeMfaLogin,
  endSessionOnLogout,
  logoutEverywhere,
  registerFirstAdmin
} from "../services/authService.js";
import {
  beginMfaSetup,
  confirmMfaSetup,
  disableMfa,
  getMfaStatus,
  regenerateRecoveryCodes
} from "../services/mfaService.js";
import {
  listUserSessions,
  revokeSession,
  rotateSessionTokenIfNeeded
} from "../services/sessionService.js";

function contextOf(req) {
  return { ip: req.ip, userAgent: req.get("user-agent") || null };
}

function sendSession(res, status, { user, token, session, maxAgeSeconds }) {
  setSessionCookie(res, token, maxAgeSeconds);
  res.status(status).json({
    user,
    token,
    session: { expiresAt: new Date(Date.now() + maxAgeSeconds * 1000), absoluteExpiresAt: session.absoluteExpiresAt }
  });
}

export async function register(req, res, next) {
  try {
    const body = req.body || {};
    const result = await registerFirstAdmin(
      { ...body, setupToken: body.setupToken || req.get("x-setup-token") },
      contextOf(req)
    );
    sendSession(res, 201, result);
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const result = await authenticateWithCredentials(req.body || {}, contextOf(req));
    if (result.mfaRequired) {
      res.json({ mfaRequired: true, mfaToken: result.mfaToken });
      return;
    }
    sendSession(res, 200, result);
  } catch (error) {
    next(error);
  }
}

export async function loginMfa(req, res, next) {
  try {
    sendSession(res, 200, await completeMfaLogin(req.body || {}, contextOf(req)));
  } catch (error) {
    next(error);
  }
}

export function me(req, res) {
  const { token, payload, session } = req.auth;
  const rotation = rotateSessionTokenIfNeeded({
    token,
    payload,
    session,
    user: { id: req.user.id, tokenVersion: Number(payload.ver) }
  });
  if (rotation.rotated) setSessionCookie(res, rotation.token, rotation.maxAgeSeconds);
  res.json({
    user: req.user,
    token: rotation.token,
    session: {
      expiresAt: new Date(Date.now() + rotation.maxAgeSeconds * 1000),
      absoluteExpiresAt: session.absoluteExpiresAt
    }
  });
}

export async function logout(req, res, next) {
  try {
    await endSessionOnLogout(req.user, req.auth.session.id, contextOf(req));
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    sendSession(res, 200, await changeOwnPassword(req.user, req.body || {}, contextOf(req)));
  } catch (error) {
    next(error);
  }
}

export async function sessions(req, res, next) {
  try {
    const list = await listUserSessions(req.user.id);
    res.json({
      sessions: list.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        lastSeenAt: item.lastSeenAt,
        absoluteExpiresAt: item.absoluteExpiresAt,
        ip: item.ip,
        userAgent: item.userAgent,
        current: item.id === req.auth.session.id
      }))
    });
  } catch (error) {
    next(error);
  }
}

export async function revokeOneSession(req, res, next) {
  try {
    const revoked = await revokeSession(req.params.id, req.user.id, "revoked_by_user");
    if (!revoked) {
      res.status(404).json({ message: "Sessão não encontrada.", statusCode: 404, requestId: req.requestId });
      return;
    }
    if (req.params.id === req.auth.session.id) clearSessionCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function revokeOtherSessions(req, res, next) {
  try {
    const revoked = await logoutEverywhere(req.user, req.auth.session.id, contextOf(req));
    res.json({ revoked });
  } catch (error) {
    next(error);
  }
}

export async function mfaStatus(req, res, next) {
  try {
    res.json(await getMfaStatus(req.user.id));
  } catch (error) {
    next(error);
  }
}

export async function mfaSetup(req, res, next) {
  try {
    res.json(await beginMfaSetup(req.user.id));
  } catch (error) {
    next(error);
  }
}

export async function mfaEnable(req, res, next) {
  try {
    res.json(await confirmMfaSetup(req.user.id, req.body?.code, contextOf(req)));
  } catch (error) {
    next(error);
  }
}

export async function mfaDisable(req, res, next) {
  try {
    await disableMfa(req.user.id, req.body || {}, contextOf(req));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function mfaRecoveryCodes(req, res, next) {
  try {
    res.json(await regenerateRecoveryCodes(req.user.id, req.body || {}, contextOf(req)));
  } catch (error) {
    next(error);
  }
}
