import { ocsInventory } from "../data/mockOcs.js";

export async function getInventory() {
  return ocsInventory;
}

export async function getInventoryByHostId(hostId) {
  return ocsInventory.find((item) => item.hostId === hostId) || null;
}

