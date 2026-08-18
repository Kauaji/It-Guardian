import test from "node:test";
import assert from "node:assert/strict";
import { computeAutoLayout } from "./networkTopologyAutoLayout.js";

test("mapa de rede: nos centrais ficam mais perto do centro que os perifericos", () => {
  const center = { x: 800, y: 500 };
  const nodes = [
    { id: "n1", assetId: "switch-1", x: 0, y: 0, pinned: false },
    { id: "n2", assetId: "desktop-1", x: 0, y: 0, pinned: false }
  ];
  const result = computeAutoLayout({ nodes, links: [], centralAssetIds: new Set(["switch-1"]), center });

  const distance = (point) => Math.hypot(point.x - center.x, point.y - center.y);
  const central = result.find((point) => point.id === "n1");
  const peripheral = result.find((point) => point.id === "n2");

  assert.ok(distance(central) < distance(peripheral));
});

test("mapa de rede: no fixado (pinned) nunca muda de posicao", () => {
  const nodes = [
    { id: "n1", assetId: "switch-1", x: 42, y: 99, pinned: true },
    { id: "n2", assetId: "desktop-1", x: 0, y: 0, pinned: false }
  ];
  const result = computeAutoLayout({ nodes, links: [], centralAssetIds: new Set(["switch-1"]) });

  const pinned = result.find((point) => point.id === "n1");
  assert.equal(pinned.x, 42);
  assert.equal(pinned.y, 99);
});

test("mapa de rede: periferico com link para um central fica proximo do angulo do central", () => {
  const nodes = [
    { id: "n1", assetId: "switch-1", x: 0, y: 0, pinned: false },
    { id: "n2", assetId: "switch-2", x: 0, y: 0, pinned: false },
    { id: "n3", assetId: "desktop-1", x: 0, y: 0, pinned: false }
  ];
  const links = [{ sourceAssetId: "desktop-1", targetAssetId: "switch-2" }];
  const result = computeAutoLayout({
    nodes,
    links,
    centralAssetIds: new Set(["switch-1", "switch-2"])
  });

  const switch2 = result.find((point) => point.id === "n2");
  const desktop1 = result.find((point) => point.id === "n3");
  const center = { x: 800, y: 500 };
  const angleOf = (point) => Math.atan2(point.y - center.y, point.x - center.x);

  assert.ok(Math.abs(angleOf(switch2) - angleOf(desktop1)) < 0.3);
});

test("mapa de rede: sem nos centrais e sem links, tudo cai em grade sem sobreposicao", () => {
  const nodes = Array.from({ length: 4 }, (_, index) => ({
    id: `n${index}`,
    assetId: `asset-${index}`,
    x: 0,
    y: 0,
    pinned: false
  }));
  const result = computeAutoLayout({ nodes, links: [] });

  const seen = new Set();
  result.forEach((point) => {
    const key = `${point.x}:${point.y}`;
    assert.ok(!seen.has(key), "duas posicoes nao podem coincidir");
    seen.add(key);
  });
});
