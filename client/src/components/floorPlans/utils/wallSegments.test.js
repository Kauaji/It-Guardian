import { describe, expect, it } from "vitest";
import { getWallOpeningCuts, getWallSolidSegments } from "./wallSegments.js";

describe("getWallOpeningCuts", () => {
  it("centraliza cada vao no deslocamento da abertura e ordena", () => {
    const cuts = getWallOpeningCuts(200, [
      { width: 40, metadata: { anchorOffset: 0.75 } },
      { width: 20, metadata: { anchorOffset: 0.25 } }
    ]);
    expect(cuts).toEqual([
      { start: 40, end: 60 },
      { start: 130, end: 170 }
    ]);
  });

  it("usa 0,5 por padrao e limita o vao a 12 px minimo e a largura da parede", () => {
    expect(getWallOpeningCuts(100, [{ width: 2 }])).toEqual([{ start: 44, end: 56 }]);
    expect(getWallOpeningCuts(100, [{ width: 500, metadata: { anchorOffset: 0.5 } }])).toEqual([{ start: 0, end: 100 }]);
  });

  it("mantem os vaos dentro da parede", () => {
    expect(getWallOpeningCuts(100, [{ width: 40, metadata: { anchorOffset: 1 } }])).toEqual([{ start: 80, end: 100 }]);
    expect(getWallOpeningCuts(100, [{ width: 40, metadata: { anchorOffset: 0 } }])).toEqual([{ start: 0, end: 20 }]);
  });

  it("sem aberturas nao ha vaos", () => {
    expect(getWallOpeningCuts(100)).toEqual([]);
  });
});

describe("getWallSolidSegments", () => {
  it("sem vaos devolve a parede inteira", () => {
    expect(getWallSolidSegments(100, [])).toEqual([{ start: 0, end: 100 }]);
  });

  it("devolve os trechos entre os vaos", () => {
    expect(
      getWallSolidSegments(200, [
        { start: 40, end: 60 },
        { start: 130, end: 170 }
      ])
    ).toEqual([
      { start: 0, end: 40 },
      { start: 60, end: 130 },
      { start: 170, end: 200 }
    ]);
  });

  it("une vaos sobrepostos e nao devolve trechos vazios", () => {
    expect(
      getWallSolidSegments(100, [
        { start: 10, end: 50 },
        { start: 30, end: 60 }
      ])
    ).toEqual([
      { start: 0, end: 10 },
      { start: 60, end: 100 }
    ]);
    expect(getWallSolidSegments(100, [{ start: 0, end: 100 }])).toEqual([]);
  });
});
