import { isVercel } from "../config/environment.js";
import { ocsInventoryService } from "../integrations/ocs/OcsInventoryService.js";
import { zabbixService } from "../integrations/zabbix/ZabbixService.js";
import { syncOcsInventory, syncZabbix } from "./integrationService.js";

function intervalMilliseconds(name, fallbackMinutes) {
  const configured = Number(process.env[name] || fallbackMinutes);
  const minutes = Number.isFinite(configured) ? Math.max(1, configured) : fallbackMinutes;
  return minutes * 60_000;
}

function createScheduledSync({ source, service, sync, intervalMs, logger }) {
  const configuration = service.getConfiguration();
  if (!configuration.enabled || configuration.mode !== "real" || !configuration.configured) {
    return null;
  }

  let running = false;
  const execute = async () => {
    if (running) return;
    running = true;
    try {
      const result = await sync();
      logger.info(JSON.stringify({
        level: "info",
        event: "integration_sync",
        source,
        importedAssets: result.state?.importedAssets || 0,
        importedAlerts: result.state?.importedAlerts || 0
      }));
    } catch (error) {
      logger.error(JSON.stringify({
        level: "error",
        event: "integration_sync_failed",
        source,
        message: error.message
      }));
    } finally {
      running = false;
    }
  };

  void execute();
  const timer = setInterval(execute, intervalMs);
  timer.unref?.();
  return timer;
}

export function startIntegrationSyncScheduler({ logger = console } = {}) {
  if (isVercel) {
    logger.info(JSON.stringify({
      level: "info",
      event: "integration_scheduler_skipped",
      reason: "vercel_cannot_reach_lan_integrations"
    }));
    return () => {};
  }

  const timers = [
    createScheduledSync({
      source: "ocs",
      service: ocsInventoryService,
      sync: syncOcsInventory,
      intervalMs: intervalMilliseconds("OCS_SYNC_INTERVAL_MINUTES", 60),
      logger
    }),
    createScheduledSync({
      source: "zabbix",
      service: zabbixService,
      sync: syncZabbix,
      intervalMs: intervalMilliseconds("ZABBIX_SYNC_INTERVAL_MINUTES", 5),
      logger
    })
  ].filter(Boolean);

  return () => {
    for (const timer of timers) clearInterval(timer);
  };
}
