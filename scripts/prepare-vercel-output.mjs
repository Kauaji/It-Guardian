import { cp, rm } from "node:fs/promises";
import { resolve, relative } from "node:path";

const root = resolve(import.meta.dirname, "..");
const clientDist = resolve(root, "client", "dist");
const rootDist = resolve(root, "dist");

function assertInsideRoot(path) {
  const relativePath = relative(root, path);
  if (relativePath.startsWith("..") || relativePath === "") {
    throw new Error(`Invalid build output path: ${path}`);
  }
}

assertInsideRoot(clientDist);
assertInsideRoot(rootDist);

await rm(rootDist, { recursive: true, force: true });
await cp(clientDist, rootDist, { recursive: true });

console.log("Prepared Vercel output directory: dist");
