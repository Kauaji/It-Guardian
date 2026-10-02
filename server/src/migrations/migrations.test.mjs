import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";
import { migrations } from "./index.js";

const directory = new URL("./", import.meta.url);
const files = readdirSync(directory).filter((name) => /^\d{3}-.*\.js$/.test(name));

// Prefixo duplicado ja existente no historico (025-report-exports / 025-asset-metric-history):
// ambas ja foram aplicadas em bancos reais, entao nao podem ser renumeradas. Nenhum prefixo novo pode repetir.
const GRANDFATHERED_DUPLICATE_PREFIXES = new Set(["025"]);

test("ids de migracao seguem o padrao NNN-nome e sao unicos", () => {
  const ids = migrations.map((migration) => migration.id);
  assert.equal(new Set(ids).size, ids.length, "ha ids de migracao repetidos");
  for (const id of ids) assert.match(id, /^\d{3}-[a-z0-9-]+$/, `id fora do padrao: ${id}`);
});

test("prefixos numericos nao se repetem (exceto o legado conhecido) e a ordem e crescente", () => {
  const prefixes = migrations.map((migration) => migration.id.slice(0, 3));
  const seen = new Set();
  prefixes.forEach((prefix, index) => {
    if (index > 0) assert.ok(prefix >= prefixes[index - 1], `migracao fora de ordem: ${migrations[index].id}`);
    if (prefix === prefixes[index - 1]) {
      assert.ok(GRANDFATHERED_DUPLICATE_PREFIXES.has(prefix), `prefixo duplicado novo: ${migrations[index].id}`);
    }
    seen.add(prefix);
  });
});

test("toda migracao tem arquivo correspondente e todo arquivo esta registrado", () => {
  const registered = new Set(migrations.map((migration) => migration.id));
  const onDisk = new Set(files.map((name) => name.replace(/\.js$/, "")));
  assert.deepEqual([...onDisk].filter((id) => !registered.has(id)), [], "arquivo de migracao nao registrado em index.js");
  assert.deepEqual([...registered].filter((id) => !onDisk.has(id)), [], "migracao registrada sem arquivo");
});

test("toda migracao expoe up(db)", () => {
  for (const migration of migrations) assert.equal(typeof migration.up, "function", migration.id);
});
