import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const directory = new URL("./legacy/", import.meta.url);

/**
 * O esquema legado roda uma unica vez por banco (marcador em schema_migrations).
 * Editar estes arquivos NAO afetaria bancos existentes -- o que torna a mudanca
 * silenciosamente inutil em producao. Mudancas de esquema entram como migracao
 * numerada em src/migrations/. Se uma correcao no legado for realmente
 * necessaria (ex.: typo que quebra banco virgem), atualize este hash de
 * proposito e publique tambem uma migracao equivalente.
 */
const FROZEN_SHA256 = "827ef26052b949c02f9477caffca047bf0e5d729af4e87b40e5fa55e62af4d6f";

test("o esquema legado esta congelado: novas mudancas vao em src/migrations/", () => {
  const hash = createHash("sha256");
  for (const name of readdirSync(directory).filter((file) => file.endsWith(".js")).sort()) {
    // normaliza fim de linha: checkouts Windows (autocrlf) nao podem mudar o hash
    hash.update(name).update("\0").update(readFileSync(new URL(name, directory), "utf8").replace(/\r\n/g, "\n"));
  }
  assert.equal(
    hash.digest("hex"),
    FROZEN_SHA256,
    "src/schema/legacy/* foi alterado. Adicione uma migracao em src/migrations/ em vez de editar o legado."
  );
});
