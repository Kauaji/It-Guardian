function hashIp(ip = "") {
  return ip.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

export class PingService {
  constructor({ mode = process.env.PING_MODE || "mock" } = {}) {
    this.mode = mode;
  }

  async check(asset) {
    if (this.mode === "real") {
      return this.checkReal(asset);
    }

    return this.checkMock(asset);
  }

  async checkMock(asset) {
    const checkedAt = new Date().toISOString();
    const ip = asset?.ip || "";
    const stableOffline = /(?:\.23|\.10|\.254)$/.test(ip);
    const simulatedOnline = !stableOffline && hashIp(ip) % 5 !== 0;

    return {
      status: simulatedOnline ? "online" : "offline",
      checkedAt,
      mode: "mock",
      message: simulatedOnline
        ? "Ativo respondeu ao ping simulado."
        : "Nao respondeu ao ping. Verifique se o IP mudou ou configure reserva DHCP."
    };
  }

  async checkReal() {
    const error = new Error(
      "Ping real exige backend em VPS ou agente dentro da rede da empresa. Use PING_MODE=mock no Vercel."
    );
    error.statusCode = 501;
    throw error;
  }
}

export const pingService = new PingService();
