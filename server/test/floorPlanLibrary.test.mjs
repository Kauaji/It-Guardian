import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const manifestPath = resolve(root, "client/public/assets/3d-library/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

test("floor plan library has stable and legally attributable entries", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.ok(manifest.assets.length >= 12);
  assert.equal(new Set(manifest.assets.map((asset) => asset.id)).size, manifest.assets.length);
  for (const asset of manifest.assets) {
    assert.ok(asset.id && asset.label && asset.category);
    assert.ok(asset.license && asset.source && asset.author);
    assert.ok(asset.dimensions?.width > 0 && asset.dimensions?.depth > 0 && asset.dimensions?.height > 0);
    assert.equal(typeof asset.linkableToInventory, "boolean");
    if (asset.modelPath) {
      assert.ok(existsSync(resolve(root, `client/public${asset.modelPath}`)), `missing model: ${asset.modelPath}`);
    }
  }
});

test("library covers the operational categories", () => {
  const categories = new Set(manifest.assets.map((asset) => asset.category));
  for (const category of ["office", "it", "network", "hospital"]) assert.ok(categories.has(category));
});
