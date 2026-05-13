import { listLogs } from "../repositories/logRepository.js";

export async function list(req, res, next) {
  try {
    const logs = await listLogs();
    res.json({ logs });
  } catch (error) {
    next(error);
  }
}

