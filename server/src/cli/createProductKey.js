import { initializeRuntime } from "../bootstrap.js";
import { closeDatabase } from "../database.js";
import { createProductKey } from "../repositories/productKeyRepository.js";
import { validateMonitoringConfig } from "../services/productKeyService.js";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : "";
}

function positiveInteger(value, fallback) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("O limite de ativacoes deve ser um inteiro positivo.");
  }
  return parsed;
}

async function main() {
  const displayName = option("name");
  const organizationName = option("organization");
  const planName = option("plan") || "Beta";
  const activationLimit = positiveInteger(option("limit"), 1);
  const expiresAt = option("expires") || null;
  const ocsServerUrl = option("ocs-url");
  const zabbixServer = option("zabbix-server");
  const zabbixServerActive = option("zabbix-active");
  const monitoringValues = [ocsServerUrl, zabbixServer, zabbixServerActive];

  if (!displayName || !organizationName) {
    throw new Error(
      'Uso: node src/cli/createProductKey.js --name "Cliente" --organization "Empresa" [--plan "Beta"] [--limit 5] [--expires "2027-12-31"] [--ocs-url "https://ocs.empresa/ocsinventory"] [--zabbix-server "zabbix.empresa"] [--zabbix-active "zabbix.empresa"]'
    );
  }
  if (monitoringValues.some(Boolean) && !monitoringValues.every(Boolean)) {
    throw new Error(
      "Informe --ocs-url, --zabbix-server e --zabbix-active em conjunto."
    );
  }
  if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) {
    throw new Error("A data informada em --expires e invalida.");
  }

  await initializeRuntime();
  const result = await createProductKey({
    displayName,
    organizationName,
    planName,
    activationLimit,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    monitoring: monitoringValues.every(Boolean)
      ? validateMonitoringConfig({ ocsServerUrl, zabbixServer, zabbixServerActive })
      : null
  });

  process.stdout.write([
    `Chave criada para ${result.productKey.organizationName}.`,
    `Plano: ${result.productKey.planName}`,
    `Limite: ${result.productKey.activationLimit}`,
    `Monitoramento: ${result.productKey.monitoring.configured ? "configurado" : "pendente"}`,
    `Chave: ${result.key}`,
    "A chave completa e exibida somente agora. Armazene-a em local seguro.",
    ""
  ].join("\n"));
}

main()
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
