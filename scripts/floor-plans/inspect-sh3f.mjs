import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";

const source = process.argv[2] ? resolve(process.argv[2]) : null;

if (!source || !existsSync(source)) {
  console.error("Usage: node scripts/floor-plans/inspect-sh3f.mjs <licensed-library.sh3f>");
  process.exitCode = 1;
} else if (extname(source).toLowerCase() !== ".sh3f") {
  console.error("The input must be an SH3F library file.");
  process.exitCode = 1;
} else {
  console.log(`Validated SH3F input: ${source}`);
  console.log("Import is intentionally inspection-only until a license allowlist and a pinned converter are configured.");
  console.log("See docs/BIBLIOTECA-3D-E-LICENCAS.md for the approved OBJ/DAE -> GLB pipeline.");
}
