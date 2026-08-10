import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FLOOR_PLAN_LIBRARY } from "../../client/src/components/floorPlans/assets/floorPlanLibrary.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const publicDirectory = join(repositoryRoot, "client", "public");
const manifestPath = join(publicDirectory, "assets", "3d-library", "manifest.json");
const maximumModelBytes = 5 * 1024 * 1024;

function toPublicFilePath(publicPath) {
  return join(publicDirectory, String(publicPath || "").replace(/^\//, ""));
}

const assets = FLOOR_PLAN_LIBRARY.map((asset) => {
  let fileBytes = 0;
  if (asset.modelPath) {
    const modelFile = toPublicFilePath(asset.modelPath);
    if (!existsSync(modelFile)) throw new Error(`Missing 3D model for ${asset.id}: ${asset.modelPath}`);
    fileBytes = statSync(modelFile).size;
    if (fileBytes > maximumModelBytes) {
      throw new Error(`3D model exceeds the 5 MB budget for ${asset.id}: ${fileBytes} bytes`);
    }
  }

  return {
    id: asset.id,
    name: asset.label,
    label: asset.label,
    category: asset.category,
    subcategory: asset.subcategory || asset.category,
    assetType: asset.assetType,
    modelPath: asset.modelPath,
    thumbnailPath: asset.thumbnailPath,
    defaultWidth: asset.dimensions.width,
    defaultDepth: asset.dimensions.depth,
    defaultHeight: asset.dimensions.height,
    defaultScale: asset.defaultScale,
    defaultRotation: asset.defaultRotation,
    tags: asset.tags,
    license: asset.license,
    licenseUrl: asset.licenseUrl,
    source: asset.source,
    author: asset.author,
    sourceUrl: asset.sourceUrl,
    consultedAt: asset.consultedAt,
    originalFormat: asset.originalFormat,
    finalFormat: asset.finalFormat,
    conversion: asset.conversion,
    linkableToInventory: asset.linkableToInventory,
    canShowStatus: asset.linkableToInventory,
    render2d: "generated-plan-glyph",
    render3d: asset.modelPath ? "glb-with-procedural-fallback" : "procedural",
    sourceFormat: asset.originalFormat,
    fileBytes,
    dimensions: asset.dimensions
  };
});

const manifest = {
  schemaVersion: 2,
  generatedBy: "npm run floorplans:manifest",
  assetCount: assets.length,
  maximumModelBytes,
  assets
};

mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${assets.length} floor-plan assets to ${manifestPath}`);
