import { ocsInventory } from "../../data/mockOcs.js";

export class OcsInventoryService {
  constructor({ mode = process.env.OCS_MODE || "mock" } = {}) {
    this.mode = mode;
  }

  async listInventory() {
    if (this.mode === "real") {
      return this.listInventoryFromApi();
    }

    return ocsInventory;
  }

  async getInventoryByHostId(hostId) {
    const inventory = await this.listInventory();
    return inventory.find((item) => item.hostId === hostId) || null;
  }

  async listInventoryFromApi() {
    const error = new Error("Integracao real com OCS Inventory deve rodar no backend futuro em VPS.");
    error.statusCode = 501;
    throw error;
  }
}

export const ocsInventoryService = new OcsInventoryService();
