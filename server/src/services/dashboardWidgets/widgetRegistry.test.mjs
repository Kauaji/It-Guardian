import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { knownWidgetTypes } from "./widgetRegistry.js";

/**
 * O registry do cliente (client/src/components/dashboard/widgets/widgetRegistry.js)
 * nao pode ser importado diretamente aqui -- ele e um modulo JSX/Vite, e o
 * do servidor puxa repositorios/banco que nao existem no ambiente do
 * cliente. Em vez disso, le o arquivo do cliente como texto e extrai as
 * chaves de tipo por regex -- suficiente para pegar o caso real que importa
 * (um tipo existe de um lado e nao do outro), sem precisar de um bundler
 * compartilhado entre os dois pacotes so para este teste.
 */
function readClientWidgetTypes() {
  const clientRegistryPath = fileURLToPath(
    new URL("../../../../client/src/components/dashboard/widgets/widgetRegistry.js", import.meta.url)
  );
  const source = readFileSync(clientRegistryPath, "utf8");
  const objectBody = source.slice(source.indexOf("export const widgetRegistry"), source.indexOf("export const knownWidgetTypes"));
  const matches = [...objectBody.matchAll(/^\s{2}(\w+):\s*\{/gm)];
  return new Set(matches.map((match) => match[1]));
}

test("o catalogo de tipos de widget do cliente e do servidor batem exatamente", () => {
  const clientTypes = readClientWidgetTypes();
  assert.ok(clientTypes.size > 0, "a extracao por regex nao encontrou nenhum tipo no arquivo do cliente -- provavelmente o formato do arquivo mudou");

  const onlyOnServer = [...knownWidgetTypes].filter((type) => !clientTypes.has(type));
  const onlyOnClient = [...clientTypes].filter((type) => !knownWidgetTypes.has(type));

  assert.deepEqual(onlyOnServer, [], "tipo(s) existem no registry do servidor mas nao no do cliente");
  assert.deepEqual(onlyOnClient, [], "tipo(s) existem no registry do cliente mas nao no do servidor");
});
