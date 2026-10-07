import { adminResetMfa } from "../services/mfaService.js";
import {
  changeUserRole,
  createManagedUser,
  deactivateManagedUser,
  listAllUsers,
  resetUserPasswordByAdmin,
  updateUserAccessById,
  updateUserPermissionsById
} from "../services/userService.js";

export async function list(req, res, next) {
  try {
    const users = await listAllUsers();
    res.json({ users });
  } catch (error) {
    next(error);
  }
}

export async function updateRole(req, res, next) {
  try {
    const user = await changeUserRole(req.params.id, req.body.role, req.user);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function createManaged(req, res, next) {
  try {
    const user = await createManagedUser(req.body, req.user);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}

export async function updateAccess(req, res, next) {
  try {
    const user = await updateUserAccessById(req.params.id, req.body, req.user);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function updatePermissions(req, res, next) {
  try {
    const user = await updateUserPermissionsById(req.params.id, req.body.permissions, req.user);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function removeManaged(req, res, next) {
  try {
    const user = await deactivateManagedUser(req.params.id, req.user);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    res.json(await resetUserPasswordByAdmin(req.params.id, req.user));
  } catch (error) {
    next(error);
  }
}

export async function resetMfa(req, res, next) {
  try {
    await adminResetMfa(req.params.id, req.user, { ip: req.ip, userAgent: req.get("user-agent") || null });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
