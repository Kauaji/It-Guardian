import { initializeRuntime } from "../bootstrap.js";
import { closeDatabase } from "../database.js";
import { configureProductKeyMonitoring } from "../services/productKeyService.js";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : "";
}

async function main() {
  const id = option("id");
  const ocsServerUrl = option("ocs-url");
  const zabbixServer = option("zabbix-server");
  const zabbixServerActive = option("zabbix-active");

  if (!id || !ocsServerUrl || !zabbixServer || !zabbixServerActive) {
    throw new Error(
      'Uso: node src/cli/configureProductKeyMonitoring.js --id "id-da-chave" --ocs-url "https://ocs.empresa/ocsinventory" --zabbix-server "zabbix.empresa" --zabbix-active "zabbix.empresa"'
    );
  }

  await initializeRuntime();
  const productKey = await configureProductKeyMonitoring(id, {
    ocsServerUrl,
    zabbixServer,
    zabbixServerActive
  });
  if (!productKey) throw new Error("Chave de produto nao encontrada.");

  process.stdout.write([
    `Monitoramento configurado para ${productKey.organizationName}.`,
    `OCS: ${productKey.monitoring.ocsServerUrl}`,
    `Zabbix passivo: ${productKey.monitoring.zabbixServer}`,
    `Zabbix ativo: ${productKey.monitoring.zabbixServerActive}`,
    ""
  ].join("\n"));
}

main()
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
