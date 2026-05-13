function hashIp(ip = "") {
  return ip.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

export async function checkPingStatus(asset) {
  const checkedAt = new Date().toISOString();
  const ip = asset?.ip || "";
  const stableOffline = /(?:\.23|\.10|\.254)$/.test(ip);
  const simulatedOnline = !stableOffline && hashIp(ip) % 5 !== 0;

  return {
    status: simulatedOnline ? "online" : "offline",
    checkedAt,
    message: simulatedOnline
      ? "Ativo respondeu ao ping simulado."
      : "Nao respondeu ao ping. Verifique se o IP mudou ou configure reserva DHCP."
  };
}
