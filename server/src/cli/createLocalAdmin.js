import { initializeRuntime } from "../bootstrap.js";
import { closeDatabase } from "../database.js";
import { assertValidPassword } from "../domain/passwordPolicy.js";
import { createUser, findUserByEmail, toPublicUser } from "../repositories/userRepository.js";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : "";
}

async function main() {
  const name = option("name");
  const email = option("email").toLowerCase();
  const password = option("password");

  if (!name || !email || !password) {
    throw new Error(
      'Uso: node src/cli/createLocalAdmin.js --name "Administrador" --email "admin@empresa.local" --password "frase-longa-com-12-ou-mais-caracteres"'
    );
  }
  assertValidPassword(password, { email, name });

  await initializeRuntime();
  if (await findUserByEmail(email)) {
    throw new Error(`Ja existe um usuario com o email ${email}.`);
  }

  const user = await createUser({
    name,
    email,
    password,
    role: "admin",
    permissions: ["admin.full"]
  });
  const publicUser = toPublicUser(user);
  process.stdout.write(`Administrador criado: ${publicUser.name} <${publicUser.email}>\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
