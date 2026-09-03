import { exportReportCsv, previewReport } from "../services/reportService.js";

function filtersFromQuery(query = {}) {
  const { startDate, endDate, ...rest } = query;
  return {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    ...rest
  };
}

function previewHandler(type) {
  return async (req, res, next) => {
    try {
      res.json(await previewReport(type, { user: req.user, filters: filtersFromQuery(req.query) }));
    } catch (error) {
      next(error);
    }
  };
}

function exportCsvHandler(type) {
  return async (req, res, next) => {
    try {
      const csv = await exportReportCsv(type, { user: req.user, filters: filtersFromQuery(req.query) });
      res.set("Content-Type", "text/csv; charset=utf-8");
      res.set("Content-Disposition", `attachment; filename="relatorio-${type}.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  };
}

export const previewMonthly = previewHandler("monthly");
export const exportMonthlyCsv = exportCsvHandler("monthly");
export const previewServiceOrders = previewHandler("service_orders");
export const exportServiceOrdersCsv = exportCsvHandler("service_orders");
export const previewSla = previewHandler("sla");
export const exportSlaCsv = exportCsvHandler("sla");
export const previewAssets = previewHandler("assets");
export const exportAssetsCsv = exportCsvHandler("assets");
export const previewAlerts = previewHandler("alerts");
export const exportAlertsCsv = exportCsvHandler("alerts");
export const previewScripts = previewHandler("scripts");
export const exportScriptsCsv = exportCsvHandler("scripts");
export const previewRemoteAssistance = previewHandler("remote_assistance");
export const exportRemoteAssistanceCsv = exportCsvHandler("remote_assistance");
