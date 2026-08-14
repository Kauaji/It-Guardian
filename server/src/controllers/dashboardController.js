import { getDashboardSummaryReport } from "../services/dashboardService.js";

const allowedPeriods = new Set(["today", "7d", "15d", "30d", "90d"]);

export async function summary(req, res, next) {
  try {
    const requestedPeriod = String(req.query.period || "30d");
    const period = allowedPeriods.has(requestedPeriod) ? requestedPeriod : "30d";
    const report = await getDashboardSummaryReport({ period, user: req.user });
    res.json(report);
  } catch (error) {
    next(error);
  }
}
