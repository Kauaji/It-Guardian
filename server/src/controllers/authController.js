import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/environment.js";
import { addLog } from "../repositories/logRepository.js";
import { countActiveAdminsExcluding, createUser, findUserByEmail, toPublicUser } from "../repositories/userRepository.js";
import { clearSessionCookie, setSessionCookie } from "../security/sessionCookie.js";

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({ message: "Informe nome, e-mail e senha com pelo menos 6 caracteres." });
    }

    const activeAdmins = await countActiveAdminsExcluding("");
    if (activeAdmins > 0) {
      return res.status(403).json({ message: "Cadastro publico desativado. Solicite acesso a um administrador." });
    }

    const user = await createUser({ name, email, password, role: "admin", permissions: ["admin.full"] });
    await addLog({ type: "auth", message: "First admin registered", userId: user.id });

    const token = signToken(user);
    setSessionCookie(res, token);
    res.status(201).json({
      user: toPublicUser(user),
      token
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await findUserByEmail(email || "");

    if (!user || user.active === false || !(await bcrypt.compare(password || "", user.passwordHash))) {
      return res.status(401).json({ message: "Usuario/e-mail ou senha invalidos." });
    }

    await addLog({ type: "auth", message: "User logged in", userId: user.id });

    const token = signToken(user);
    setSessionCookie(res, token);
    res.json({
      user: toPublicUser(user),
      token
    });
  } catch (error) {
    next(error);
  }
}

export function me(req, res) {
  const token = signToken(req.user);
  setSessionCookie(res, token);
  res.json({ user: req.user, token });
}

export function logout(_req, res) {
  clearSessionCookie(res);
  res.status(204).end();
}
