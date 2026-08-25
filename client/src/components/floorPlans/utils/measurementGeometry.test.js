import { describe, expect, it } from "vitest";
import {
  appendDigitToBuffer,
  createMeasurementObjectFromPoints,
  getMeasurementSegment,
  isMeasurementObject,
  parseTypedLengthBuffer,
  snapMeasurementEndPoint
} from "./measurementGeometry.js";

const PLAN = { gridSize: 25, metersPerGridCell: 0.5 };

describe("isMeasurementObject", () => {
  it("reconhece objectType 'measurement'", () => {
    expect(isMeasurementObject({ objectType: "measurement" })).toBe(true);
    expect(isMeasurementObject({ objectType: "wall" })).toBe(false);
    expect(isMeasurementObject(null)).toBe(false);
  });
});

describe("getMeasurementSegment", () => {
  it("deriva start/end a partir de x/y/width/rotation, sem angulo (0 graus)", () => {
    const segment = getMeasurementSegment({ x: 0, y: 0, width: 100, height: 6, rotation: 0 });
    expect(segment.length).toBe(100);
    expect(segment.start.x).toBeCloseTo(0, 5);
    expect(segment.end.x).toBeCloseTo(100, 5);
    expect(segment.start.y).toBeCloseTo(3, 5);
  });

  it("respeita a rotacao ao derivar start/end", () => {
    const segment = getMeasurementSegment({ x: 0, y: 0, width: 100, height: 6, rotation: 90 });
    expect(segment.start.y).toBeCloseTo(3 - 50, 3);
    expect(segment.end.y).toBeCloseTo(3 + 50, 3);
  });
});

describe("snapMeasurementEndPoint", () => {
  it("sem constrainAngle, o angulo fica livre (nao trava em 45/15 graus)", () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 37 };
    const result = snapMeasurementEndPoint(start, end, 5, { constrainAngle: false });
    const rawAngle = Math.atan2(37, 100) * 180 / Math.PI;
    expect(result.angle).toBeCloseTo(rawAngle, 0);
  });

  it("com constrainAngle, trava em passos de 15 graus", () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 37 };
    const result = snapMeasurementEndPoint(start, end, 5, { constrainAngle: true });
    expect(result.angle % 15).toBe(0);
  });

  it("overrideLengthPx vence sobre a distancia bruta do mouse", () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 0 };
    const result = snapMeasurementEndPoint(start, end, 5, { overrideLengthPx: 250 });
    expect(result.length).toBe(250);
  });

  it("comprimento minimo evita medidas de tamanho zero", () => {
    const start = { x: 0, y: 0 };
    const end = { x: 0, y: 0 };
    const result = snapMeasurementEndPoint(start, end, 5);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("createMeasurementObjectFromPoints", () => {
  it("cria um objeto com objectType measurement e category annotation", () => {
    const object = createMeasurementObjectFromPoints({
      id: "m1",
      planId: "p1",
      floorId: "f1",
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
      gridSize: 25
    });
    expect(object.objectType).toBe("measurement");
    expect(object.category).toBe("annotation");
    expect(object.width).toBeCloseTo(100, 0);
    expect(object.metadata.startPoint).toBeTruthy();
    expect(object.metadata.endPoint).toBeTruthy();
  });

  it("aplica overrideLengthPx no comprimento final do objeto criado", () => {
    const object = createMeasurementObjectFromPoints({
      id: "m2",
      planId: "p1",
      floorId: "f1",
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
      gridSize: 25,
      overrideLengthPx: 320
    });
    expect(object.width).toBe(320);
  });
});

describe("appendDigitToBuffer", () => {
  it("adiciona digitos ao buffer", () => {
    expect(appendDigitToBuffer("3", "2")).toBe("32");
  });

  it("aceita virgula ou ponto como separador decimal, so uma vez", () => {
    expect(appendDigitToBuffer("3", ",")).toBe("3,");
    expect(appendDigitToBuffer("3,2", ",")).toBe("3,2");
    expect(appendDigitToBuffer("3", ".")).toBe("3,");
  });

  it("Backspace remove o ultimo caractere", () => {
    expect(appendDigitToBuffer("3,2", "Backspace")).toBe("3,");
  });

  it("ignora teclas que nao fazem parte do buffer", () => {
    expect(appendDigitToBuffer("3,2", "a")).toBe("3,2");
  });
});

describe("parseTypedLengthBuffer", () => {
  it("converte um buffer valido (metros) para pixels", () => {
    expect(parseTypedLengthBuffer("3,2", PLAN)).toBeCloseTo(160, 5);
  });

  it("buffer vazio ou so a virgula retorna null (numero ainda incompleto)", () => {
    expect(parseTypedLengthBuffer("", PLAN)).toBeNull();
    expect(parseTypedLengthBuffer(",", PLAN)).toBeNull();
  });

  it("valor zero ou negativo retorna null", () => {
    expect(parseTypedLengthBuffer("0", PLAN)).toBeNull();
  });
});
