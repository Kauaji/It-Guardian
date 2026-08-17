import { badRequest, notFoundError } from "../lib/errors.js";
import { addLog } from "../repositories/logRepository.js";
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

function ensureRole(role) {
  if (!allowedRoles.has(role)) {
    throw badRequest("Role must be admin, operator or viewer");
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
  if (!user) throw notFoundError("User not found");

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

  if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
    throw badRequest("Informe nome, e-mail e senha com pelo menos 6 caracteres.");
  }

  ensureRole(role);

  const user = await createUser({
    name: name.trim(),
    email: email.trim(),
    password,
    role,
    active: payload.active !== false,
    sectorId: payload.sectorId,
    jobTitle: payload.jobTitle,
    permissions: payload.permissions
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
  if (!user) throw notFoundError("User not found");

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

  await addLog({
    type: "admin_user_deactivate",
    message: "User deactivated by admin",
    userId: actingUser.id,
    meta: { targetUserId: user.id }
  });

  return user;
}
