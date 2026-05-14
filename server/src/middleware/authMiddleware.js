import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/environment.js";
import { findUserById } from "../repositories/userRepository.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [, token] = header.split(" ");

    if (!token) {
      return res.status(401).json({ message: "Authentication token is required" });
    }

    const payload = jwt.verify(token, getJwtSecret());
    const user = await findUserById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: "Invalid authentication token" });
    }

    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired authentication token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action" });
    }

    return next();
  };
}
