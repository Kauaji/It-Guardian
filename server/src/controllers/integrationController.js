import {
  getIntegrationLastSync,
  getIntegrationStatus,
  listZabbixProblems,
  syncOcsInventory,
  syncZabbix,
  testIntegrationConnection
} from "../services/integrationService.js";

function sourceFromRequest(req) {
  return req.params.source;
}

export async function status(req, res, next) {
  try {
    res.json(await getIntegrationStatus(sourceFromRequest(req)));
  } catch (error) {
    next(error);
  }
}

export async function testConnection(req, res, next) {
  try {
    res.json(await testIntegrationConnection(sourceFromRequest(req)));
  } catch (error) {
    next(error);
  }
}

export async function lastSync(req, res, next) {
  try {
    res.json({ state: await getIntegrationLastSync(sourceFromRequest(req)) });
  } catch (error) {
    next(error);
  }
}

export async function synchronizeOcs(_req, res, next) {
  try {
    res.json(await syncOcsInventory());
  } catch (error) {
    next(error);
  }
}

export async function synchronizeZabbix(_req, res, next) {
  try {
    res.json(await syncZabbix());
  } catch (error) {
    next(error);
  }
}

export async function zabbixProblems(req, res, next) {
  try {
    const problems = await listZabbixProblems({ status: req.query.status });
    res.json({ problems });
  } catch (error) {
    next(error);
  }
}
