import {
  changeUserRole,
  createManagedUser,
  deactivateManagedUser,
  listAllUsers,
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
