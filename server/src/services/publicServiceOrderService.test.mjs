import assert from "node:assert/strict";
import test from "node:test";
import {
  normalize,
  sanitizePriority,
  uniqueCategories,
  chooseHigherPriority
} from "./publicServiceOrderService.js";

function problemType(overrides = {}) {
  return {
    id: "custom-1",
    name: "Problema customizado",
    category: "Categoria",
    defaultPriority: "medium",
    ...overrides
  };
}

test("normalize remove acentos e normaliza caixa e espacos", () => {
  assert.equal(normalize("  Impressora não imprime  "), "impressora nao imprime");
});

test("normalize usa valor padrao vazio quando nao recebe argumento", () => {
  assert.equal(normalize(), "");
});

test("sanitizePriority mantem valores validos inalterados", () => {
  assert.equal(sanitizePriority("low"), "low");
  assert.equal(sanitizePriority("medium"), "medium");
  assert.equal(sanitizePriority("high"), "high");
  assert.equal(sanitizePriority("critical"), "critical");
});

test("sanitizePriority retorna o fallback padrao para valor invalido", () => {
  assert.equal(sanitizePriority("urgente"), "medium");
});

test("sanitizePriority retorna fallback customizado, inclusive string vazia", () => {
  assert.equal(sanitizePriority("nao-existe", ""), "");
});

test("chooseHigherPriority troca quando o candidato tem rank estritamente maior", () => {
  assert.equal(chooseHigherPriority("low", "high"), "high");
});

test("chooseHigherPriority mantem o atual quando o candidato empata em rank", () => {
  assert.equal(chooseHigherPriority("medium", "medium"), "medium");
});

test("chooseHigherPriority mantem o atual quando o candidato tem rank menor", () => {
  assert.equal(chooseHigherPriority("high", "low"), "high");
});

test("chooseHigherPriority mantem o atual quando o candidato nao e uma prioridade valida", () => {
  assert.equal(chooseHigherPriority("medium", "urgentissimo"), "medium");
});

test("uniqueCategories combina categorias configuradas com as padrao sem duplicar", () => {
  const result = uniqueCategories([
    problemType({ category: "Tablet" }),
    problemType({ category: "Computador" })
  ]);

  const expected = new Set(["Tablet", "Computador", "Notebook", "Servidor", "Impressora", "Teclado", "Mouse", "Monitor", "Rede", "Sistema", "Outro"]);

  assert.equal(result.length, expected.size);
  assert.deepEqual(new Set(result), expected);
});

test("uniqueCategories ignora categorias em branco ou apenas com espacos", () => {
  const result = uniqueCategories([
    problemType({ category: "" }),
    problemType({ category: "   " })
  ]);

  assert.deepEqual(
    [...result].sort(),
    ["Computador", "Impressora", "Mouse", "Monitor", "Notebook", "Outro", "Rede", "Servidor", "Sistema", "Teclado"].sort()
  );
});
