import { ocsInventoryService } from "../integrations/ocs/OcsInventoryService.js";

export async function getInventory() {
  return ocsInventoryService.listInventory();
}

export async function getInventoryByHostId(hostId) {
  return ocsInventoryService.getInventoryByHostId(hostId);
}
