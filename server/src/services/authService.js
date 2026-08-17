import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/environment.js";
import { AppError, badRequest, forbidden } from "../lib/errors.js";
import { addLog } from "../repositories/logRepository.js";
import { countActiveAdminsExcluding, createUser, findUserByEmail, toPublicUser } from "../repositories/userRepository.js";
import { endRemoteAssistanceSessionsOnLogout } from "./remoteAssistanceService.js";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

export async function registerFirstAdmin({ name, email, password }) {
  if (!name || !email || !password || password.length < 6) {
    throw badRequest("Informe nome, e-mail e senha com pelo menos 6 caracteres.");
  }

  const activeAdmins = await countActiveAdminsExcluding("");
  if (activeAdmins > 0) {
    throw forbidden("Cadastro publico desativado. Solicite acesso a um administrador.");
  }

  const user = await createUser({ name, email, password, role: "admin", permissions: ["admin.full"] });
  await addLog({ type: "auth", message: "First admin registered", userId: user.id });

  return { user: toPublicUser(user), token: signToken(user) };
}

export async function authenticateWithCredentials({ email, password }) {
  const user = await findUserByEmail(email || "");

  if (!user || user.active === false || !(await bcrypt.compare(password || "", user.passwordHash))) {
    throw new AppError("E-mail ou senha invalidos.", { statusCode: 401 });
  }

  await addLog({ type: "auth", message: "User logged in", userId: user.id });

  return { user: toPublicUser(user), token: signToken(user) };
}

export async function endSessionOnLogout(user) {
  await endRemoteAssistanceSessionsOnLogout(user);
}
