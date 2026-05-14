import { pingService } from "../integrations/ping/PingService.js";

export async function checkPingStatus(asset) {
  return pingService.check(asset);
}
