import { Router } from "express";
import {
  lastSync,
  status,
  synchronizeOcs,
  synchronizeZabbix,
  testConnection,
  zabbixProblems
} from "../controllers/integrationController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.use(requireAuth, requireAdmin);

for (const source of ["ocs", "zabbix"]) {
  router.get(`/${source}/status`, (req, res, next) => {
    req.params.source = source;
    return status(req, res, next);
  });
  router.post(`/${source}/test`, (req, res, next) => {
    req.params.source = source;
    return testConnection(req, res, next);
  });
  router.get(`/${source}/last-sync`, (req, res, next) => {
    req.params.source = source;
    return lastSync(req, res, next);
  });
}
router.post("/ocs/sync", synchronizeOcs);
router.post("/zabbix/sync", synchronizeZabbix);
router.get("/zabbix/problems", zabbixProblems);

export default router;
