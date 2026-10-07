import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { runDataRetention } from "../jobs/dataRetention.js";

const router = Router();

function matchesCronSecret(req) {
  const expected = process.env.CRON_SECRET;
  const match = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ""));
  if (!expected || !match) return false;
  const left = Buffer.from(match[1].trim());
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

// A Vercel envia `Authorization: Bearer $CRON_SECRET` nas chamadas de cron.
async function retentionCron(req, res, next) {
  try {
    if (!process.env.CRON_SECRET) {
      return res.status(503).json({ message: "Cron desativado: defina CRON_SECRET.", code: "CRON_DISABLED", statusCode: 503 });
    }
    if (!matchesCronSecret(req)) {
      return res.status(401).json({ message: "Não autorizado.", statusCode: 401 });
    }
    return res.json(await runDataRetention());
  } catch (error) {
    return next(error);
  }
}

router.get("/retention/cron", retentionCron);
router.post("/retention/cron", retentionCron);

export default router;
