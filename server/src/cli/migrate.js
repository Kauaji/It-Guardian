import { closeDatabase } from "../database.js";
import { getMigrationStatus, runMigrations } from "../migrations/index.js";
import { initializeDatabase } from "../schema/legacyBootstrap.js";

const command = process.argv[2] || "up";

function printStatus(status) {
  process.stdout.write(`esquema legado: ${status.legacySchemaApplied ? "aplicado" : "PENDENTE"}\n`);
  for (const migration of status.migrations) {
    const when = migration.appliedAt ? new Date(migration.appliedAt).toISOString() : "";
    process.stdout.write(`${migration.applied ? "[x]" : "[ ]"} ${migration.id} ${when}\n`);
  }
  process.stdout.write(`${status.pending.length} migracao(oes) pendente(s)\n`);
}

async function main() {
  if (command === "status") {
    const status = await getMigrationStatus();
    printStatus(status);
    // `--check` serve de gate em pipeline: sai com 1 se algo estiver pendente.
    if (process.argv.includes("--check") && (!status.legacySchemaApplied || status.pending.length)) {
      process.exitCode = 1;
    }
    return;
  }
  if (command === "up") {
    await initializeDatabase();
    await runMigrations();
    printStatus(await getMigrationStatus());
    return;
  }
  throw new Error("Uso: node src/cli/migrate.js [up|status [--check]]");
}

main()
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
