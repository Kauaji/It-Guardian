import { addLog } from "../repositories/logRepository.js";
import { listUsers, updateUserRole } from "../repositories/userRepository.js";

const allowedRoles = new Set(["admin", "operator", "viewer"]);

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

    if (!allowedRoles.has(role)) {
      return res.status(400).json({ message: "Role must be admin, operator or viewer" });
    }

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
