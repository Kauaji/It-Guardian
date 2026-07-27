import { ocsInventory } from "../../data/mockOcs.js";
import {
  ExternalIntegrationError,
  joinIntegrationUrl,
  requestJson
} from "../httpJsonClient.js";

export class OcsInventoryService {
  constructor({
    mode = process.env.OCS_MODE || "mock",
    enabled,
    baseUrl = process.env.OCS_BASE_URL || "",
    username = process.env.OCS_USER || "",
    password = process.env.OCS_PASSWORD || "",
    computersPath = process.env.OCS_COMPUTERS_PATH || "/computers",
    timeoutMs = Number(process.env.OCS_TIMEOUT_MS || 10000),
    retries = Number(process.env.OCS_RETRIES || 1),
    fetchImpl = globalThis.fetch
  } = {}) {
    this.mode = ["mock", "real", "disabled"].includes(mode) ? mode : "disabled";
    this.enabled = enabled ?? (
      this.mode === "mock" ||
      (this.mode === "real" && String(process.env.OCS_ENABLED || "").toLowerCase() === "true")
    );
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.username = username;
    this.password = password;
    this.computersPath = computersPath;
    this.timeoutMs = Math.max(250, timeoutMs);
    this.retries = Math.max(0, retries);
    this.fetchImpl = fetchImpl;
  }

  getConfiguration() {
    return {
      source: "ocs",
      mode: this.mode,
      enabled: Boolean(this.enabled),
      baseUrl: this.baseUrl || null,
      configured: this.mode === "mock" || Boolean(this.baseUrl && this.username && this.password)
    };
  }

  async listInventory() {
    if (!this.enabled || this.mode === "disabled") return [];
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
    if (!this.baseUrl || !this.username || !this.password) {
      throw new ExternalIntegrationError(
        "OCS Inventory",
        "A integracao OCS Inventory nao esta completamente configurada."
      );
    }
    const credentials = Buffer.from(`${this.username}:${this.password}`, "utf8").toString("base64");
    const payload = await requestJson({
      source: "OCS Inventory",
      url: joinIntegrationUrl(this.baseUrl, this.computersPath),
      headers: { authorization: `Basic ${credentials}` },
      timeoutMs: this.timeoutMs,
      retries: this.retries,
      fetchImpl: this.fetchImpl
    });
    const assets = Array.isArray(payload)
      ? payload
      : payload?.computers || payload?.data || payload?.results || payload?.items;
    if (!Array.isArray(assets)) {
      throw new ExternalIntegrationError(
        "OCS Inventory",
        "A integracao OCS Inventory respondeu em um formato invalido."
      );
    }
    return assets;
  }

  async testConnection() {
    if (!this.enabled || this.mode === "disabled") {
      return { ok: true, skipped: true, mode: this.mode };
    }
    const assets = await this.listInventory();
    return { ok: true, skipped: false, mode: this.mode, discoveredAssets: assets.length };
  }
}

export const ocsInventoryService = new OcsInventoryService();
