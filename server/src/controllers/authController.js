import { clearSessionCookie, setSessionCookie } from "../security/sessionCookie.js";
import {
  authenticateWithCredentials,
  endSessionOnLogout,
  registerFirstAdmin,
  signToken
} from "../services/authService.js";

export async function register(req, res, next) {
  try {
    const { user, token } = await registerFirstAdmin(req.body || {});
    setSessionCookie(res, token);
    res.status(201).json({ user, token });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { user, token } = await authenticateWithCredentials(req.body || {});
    setSessionCookie(res, token);
    res.json({ user, token });
  } catch (error) {
    next(error);
  }
}

export function me(req, res) {
  const token = signToken(req.user);
  setSessionCookie(res, token);
  res.json({ user: req.user, token });
}

export async function logout(req, res, next) {
  try {
    await endSessionOnLogout(req.user);
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
