import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL = "memory";
process.env.NODE_ENV = "test";

const { validateFloorPlanBackground } = await import("../src/repositories/floorPlanRepository.js");

test("floor plan background accepts only authentic supported image signatures", () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const webp = Buffer.from("RIFF0000WEBP", "ascii");

  assert.deepEqual(validateFloorPlanBackground(png, "image/png", "Planta térreo.png"), {
    mimeType: "image/png",
    fileName: "Planta-terreo.png"
  });
  assert.equal(validateFloorPlanBackground(jpeg, "image/jpeg", "mapa.jpeg").fileName, "mapa.jpg");
  assert.equal(validateFloorPlanBackground(webp, "image/webp", "mapa.webp").mimeType, "image/webp");

  assert.throws(
    () => validateFloorPlanBackground(Buffer.from("<script>alert(1)</script>"), "image/png", "ataque.png"),
    /Arquivo inválido/
  );
  assert.throws(
    () => validateFloorPlanBackground(Buffer.alloc(8 * 1024 * 1024 + 1), "image/png", "grande.png"),
    /8 MB/
  );
});
