import { initializeRuntime } from "../bootstrap.js";
import { closeDatabase } from "../database.js";
import { createAgentEnrollment } from "../repositories/agentRepository.js";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : "";
}

async function main() {
  const name = option("name");
  if (!name) {
    throw new Error('Uso: node src/cli/createAgentEnrollment.js --name "Laboratorio Windows"');
  }

  await initializeRuntime();
  const result = await createAgentEnrollment({ name });
  process.stdout.write([
    `Enrollment criado: ${result.enrollment.name}`,
    `Token: ${result.token}`,
    "Guarde o token agora. O valor completo nao sera exibido novamente.",
    ""
  ].join("\n"));
}

main()
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
