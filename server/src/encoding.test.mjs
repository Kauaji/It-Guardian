import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const rootDir = fileURLToPath(new URL("../../", import.meta.url));
const sourceDirs = ["client/src", "server/src", "shared"].map((dir) => join(rootDir, dir));
const textExtensions = new Set([".css", ".js", ".jsx", ".mjs", ".ts", ".tsx", ".json", ".md"]);
const mojibakePattern = new RegExp([
  String.fromCharCode(0x00c3),
  String.fromCharCode(0x00c2),
  String.fromCharCode(0x201c),
  String.fromCharCode(0x201d),
  String.fromCharCode(0xfffd)
].join("|"));

function listTextFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTextFiles(fullPath));
      continue;
    }

    if (entry.isFile() && textExtensions.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

test("código-fonte não contém mojibake em textos visíveis", () => {
  const offenders = sourceDirs
    .filter((dir) => statSync(dir, { throwIfNoEntry: false })?.isDirectory())
    .flatMap(listTextFiles)
    .filter((file) => mojibakePattern.test(readFileSync(file, "utf8")));

  assert.deepEqual(offenders, []);
});
