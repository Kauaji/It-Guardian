import { readdirSync, readFileSync } from "node:fs";

const directory = new URL("../src/schema/legacy/", import.meta.url);

/** Texto de todo o esquema legado concatenado: para testes que verificam a presenca de DDL por regex. */
export function legacySchemaSource() {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => readFileSync(new URL(name, directory), "utf8"))
    .join("\n");
}
