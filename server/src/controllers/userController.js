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
    const error = new Error("Role must be admin, operator or viewer");
    error.statusCode = 400;
    throw error;
  }
}

async function ensureNotRemovingLastAdmin(userId, payload) {
  const willBeAdmin = payload.role === "admin" || payload.isAdmin === true;
  const willBeActive = payload.active !== false;
  if (willBeAdmin && willBeActive) return;

  const remainingAdmins = await countActiveAdminsExcluding(userId);
  if (remainingAdmins > 0) return;

  const error = new Error("Não é possível excluir o último administrador ativo.");
  error.statusCode = 400;
  throw error;
}

export async function list(req, res, next) {
  try {
    const users = await listUsers();
    res.json({ users });
  } catch (error) {
    next(error);
  }
}

export async function updateRole(req, res, next) {
  try {
    const { role } = req.body;

    ensureRole(role);
    await ensureNotRemovingLastAdmin(req.params.id, { role, active: true, isAdmin: role === "admin" });

    const user = await updateUserRole(req.params.id, role);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await addLog({
      type: "rbac",
      message: `User role changed to ${role}`,
      userId: req.user.id,
      meta: { targetUserId: user.id, role }
    });

    return res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function createManaged(req, res, next) {
  try {
    const { name, email, password, role = "viewer" } = req.body;

    if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
      return res.status(400).json({ message: "Informe nome, e-mail e senha com pelo menos 6 caracteres." });
    }

    ensureRole(role);

    const user = await createUser({
      name: name.trim(),
      email: email.trim(),
      password,
      role,
      active: req.body.active !== false,
      sectorId: req.body.sectorId,
      jobTitle: req.body.jobTitle,
      permissions: req.body.permissions
    });

    await addLog({
      type: "admin_user_create",
      message: "User created by admin",
      userId: req.user.id,
      meta: { targetUserId: user.id }
    });

    return res.status(201).json({ user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function updateAccess(req, res, next) {
  try {
    const current = await findUserById(req.params.id);
    if (!current) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    let role = req.body.role ?? current.role;
    if (req.body.isAdmin === true) role = "admin";
    if (req.body.isAdmin === false && current.isAdmin && req.body.role === undefined) role = "operator";

    ensureRole(role);
    await ensureNotRemovingLastAdmin(req.params.id, {
      ...req.body,
      role,
      active: Object.prototype.hasOwnProperty.call(req.body, "active") ? req.body.active : current.active,
      isAdmin: role === "admin"
    });

    const user = await updateUserAccess(req.params.id, {
      ...req.body,
      role,
      isAdmin: role === "admin" || req.body.isAdmin === true
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await addLog({
      type: "admin_user_access",
      message: "User access updated",
      userId: req.user.id,
      meta: { targetUserId: user.id }
    });

    return res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function updatePermissions(req, res, next) {
  try {
    const current = await findUserById(req.params.id);
    if (!current) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const user = await updateUserPermissions(req.params.id, req.body.permissions || []);
    await addLog({
      type: "admin_user_permissions",
      message: "User permissions updated",
      userId: req.user.id,
      meta: { targetUserId: user.id }
    });

    return res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function removeManaged(req, res, next) {
  try {
    await ensureNotRemovingLastAdmin(req.params.id, { active: false });

    const user = await deactivateUser(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    await addLog({
      type: "admin_user_deactivate",
      message: "User deactivated by admin",
      userId: req.user.id,
      meta: { targetUserId: user.id }
    });

    return res.json({ user });
  } catch (error) {
    next(error);
  }
}
