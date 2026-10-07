import { randomInt } from "node:crypto";
import { assertValidPassword } from "../domain/passwordPolicy.js";
import { badRequest, notFoundError } from "../lib/errors.js";
import { addLog } from "../repositories/logRepository.js";
import { setUserPassword } from "../repositories/userSecurityRepository.js";
import { hashPassword } from "../security/passwordHasher.js";
import { revokeAllSessions } from "./sessionService.js";
import {
  countActiveAdminsExcluding,
  createUser,
  deactivateUser,
  findUserById,
  listUsers,
  updateUserAccess,
  updateUserPermissions,
  updateUserRole,
  toPublicUser
} from "../repositories/userRepository.js";

const allowedRoles = new Set(["admin", "operator", "viewer"]);

export function ensureRole(role) {
  if (!allowedRoles.has(role)) {
    throw badRequest("O perfil deve ser administrador, operador ou visualizador.");
  }
}

async function ensureNotRemovingLastAdmin(userId, payload) {
  const willBeAdmin = payload.role === "admin" || payload.isAdmin === true;
  const willBeActive = payload.active !== false;
  if (willBeAdmin && willBeActive) return;

  const remainingAdmins = await countActiveAdminsExcluding(userId);
  if (remainingAdmins > 0) return;

  throw badRequest("Não é possível excluir o último administrador ativo.");
}

export async function listAllUsers() {
  return listUsers();
}

export async function changeUserRole(id, role, actingUser) {
  ensureRole(role);
  await ensureNotRemovingLastAdmin(id, { role, active: true, isAdmin: role === "admin" });

  const user = await updateUserRole(id, role);
  if (!user) throw notFoundError("Usuário não encontrado.");

  await addLog({
    type: "rbac",
    message: `User role changed to ${role}`,
    userId: actingUser.id,
    meta: { targetUserId: user.id, role }
  });

  return user;
}

export async function createManagedUser(payload, actingUser) {
  const { name, email, password, role = "viewer" } = payload;

  if (!name?.trim() || !email?.trim()) {
    throw badRequest("Informe nome e e-mail.");
  }
  assertValidPassword(password, { email, name });

  ensureRole(role);

  const user = await createUser({
    name: name.trim(),
    email: email.trim(),
    password,
    role,
    active: payload.active !== false,
    sectorId: payload.sectorId,
    jobTitle: payload.jobTitle,
    permissions: payload.permissions,
    // A senha foi escolhida por quem criou a conta: a pessoa troca no primeiro acesso.
    mustChangePassword: payload.mustChangePassword !== false
  });

  await addLog({
    type: "admin_user_create",
    message: "User created by admin",
    userId: actingUser.id,
    meta: { targetUserId: user.id }
  });

  return toPublicUser(user);
}

export async function updateUserAccessById(id, payload, actingUser) {
  const current = await findUserById(id);
  if (!current) throw notFoundError("Usuário não encontrado.");

  let role = payload.role ?? current.role;
  if (payload.isAdmin === true) role = "admin";
  if (payload.isAdmin === false && current.isAdmin && payload.role === undefined) role = "operator";

  ensureRole(role);
  await ensureNotRemovingLastAdmin(id, {
    ...payload,
    role,
    active: Object.prototype.hasOwnProperty.call(payload, "active") ? payload.active : current.active,
    isAdmin: role === "admin"
  });

  const user = await updateUserAccess(id, {
    ...payload,
    role,
    isAdmin: role === "admin" || payload.isAdmin === true
  });
  if (!user) throw notFoundError("Usuário não encontrado.");

  await addLog({
    type: "admin_user_access",
    message: "User access updated",
    userId: actingUser.id,
    meta: { targetUserId: user.id }
  });

  return user;
}

export async function updateUserPermissionsById(id, permissions, actingUser) {
  const current = await findUserById(id);
  if (!current) throw notFoundError("Usuário não encontrado.");

  const user = await updateUserPermissions(id, permissions || []);
  await addLog({
    type: "admin_user_permissions",
    message: "User permissions updated",
    userId: actingUser.id,
    meta: { targetUserId: user.id }
  });

  return user;
}

export async function deactivateManagedUser(id, actingUser) {
  await ensureNotRemovingLastAdmin(id, { active: false });

  const user = await deactivateUser(id);
  if (!user) throw notFoundError("Usuário não encontrado.");
  await revokeAllSessions(id, "user_deactivated");

  await addLog({
    type: "admin_user_deactivate",
    message: "User deactivated by admin",
    userId: actingUser.id,
    meta: { targetUserId: user.id }
  });

  return user;
}

const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateTemporaryPassword(length = 16) {
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return password;
}

/**
 * Redefinicao assistida: o administrador gera uma senha temporaria (mostrada
 * uma unica vez), todas as sessoes da pessoa caem e a troca vira obrigatoria
 * no proximo acesso. Nao existe "esqueci minha senha" por e-mail porque o
 * sistema nao tem canal de e-mail confiavel configurado.
 */
export async function resetUserPasswordByAdmin(id, actingUser) {
  const target = await findUserById(id);
  if (!target) throw notFoundError("Usuário não encontrado.");

  const temporaryPassword = generateTemporaryPassword();
  await setUserPassword(id, await hashPassword(temporaryPassword), { mustChangePassword: true });
  await revokeAllSessions(id, "password_reset_by_admin");

  await addLog({
    type: "auth_password_reset_by_admin",
    message: `Senha de ${target.email} redefinida por administrador.`,
    userId: actingUser.id,
    meta: { targetUserId: id }
  });

  return { temporaryPassword, user: toPublicUser((await findUserById(id)) || target) };
}
