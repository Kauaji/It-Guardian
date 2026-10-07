import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConnectionPayload, parsePoints } from "./visualMapPayload.js";

test("parsePoints: texto JSON que nao e lista vira lista vazia em vez de passar adiante", () => {
  assert.deepEqual(parsePoints('[{"x":1,"y":2,"z":3}]'), [{ x: 1, y: 2, z: 3 }]);
  assert.deepEqual(parsePoints('{"x":1}'), []);
  assert.deepEqual(parsePoints("5"), []);
  assert.deepEqual(parsePoints("null"), []);
  assert.deepEqual(parsePoints("nao e json"), []);
  assert.deepEqual(parsePoints({ x: 1 }), []);
});

test("conexao com points_json que nao e lista responde 400 (antes TypeError 500)", () => {
  for (const pointsJson of ['{"a":1}', "5", "null"]) {
    assert.throws(
      () => normalizeConnectionPayload({ points_json: pointsJson }),
      (error) => error.statusCode === 400 && /ao menos dois pontos/.test(error.message)
    );
  }
});

test("conexao valida normaliza pontos em formato de lista e objeto", () => {
  const connection = normalizeConnectionPayload({ points: [[1, 2, 3], { positionX: 4 }] });
  assert.equal(connection.layer, "infrastructure");
  assert.equal(connection.connectionType, "network_cable");
  assert.deepEqual(connection.points, [
    { x: 1, y: 2, z: 3 },
    { x: 4, y: 0.08, z: 0 }
  ]);
});
