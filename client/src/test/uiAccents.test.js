import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findAccentIssues } from "../../../scripts/check-ui-accents.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const words = (source) => findAccentIssues(source).map((issue) => issue.word.toLowerCase());

describe("scripts/check-ui-accents.mjs", () => {
  it("acusa termos sem acento em texto JSX, atributos e mensagens", () => {
    expect(words("<h2>Ordens de Servico</h2>")).toEqual(["servico"]);
    expect(words('<button aria-label="Visualizacao do inventario" title="Configuracao" />')).toEqual([
      "visualizacao",
      "inventario",
      "configuracao"
    ]);
    expect(words('notify("Nao foi possivel salvar a sessao.", "danger");')).toEqual(["nao", "possivel", "sessao"]);
    expect(words("const msg = `Codigo invalido para ${user.name}`;")).toEqual(["codigo", "invalido"]);
  });

  it("aceita a ortografia correta e preserva identificadores, rotas, classes e valores de dados", () => {
    expect(words("<h2>Ordens de Serviço</h2>")).toEqual([]);
    expect(words('navigate("/ordens-de-servico");')).toEqual([]);
    expect(words('<div className="floor-plan-paint-area selected" data-tab="inventario" />')).toEqual([]);
    expect(words('const options = { servico: "manutencao", tz: "America/Sao_Paulo" };')).toEqual([]);
    expect(words('if (normalizedName === "manutencao" || normalizedName === "nao organizadas") return true;')).toEqual([]);
    expect(words('const ok = category.includes("placa de video");')).toEqual([]);
  });

  it("ignora comentários, siglas e a marca accents-ok", () => {
    expect(words("// Nao foi possivel (comentario)")).toEqual([]);
    expect(words(" * Servico interno")).toEqual([]);
    expect(words("<span>Versão do SO</span>")).toEqual([]);
    expect(words("<span>Nao precisa</span> {/* accents-ok */}")).toEqual([]);
  });

  it("palavras ambíguas (já, só, até) só contam em frases", () => {
    expect(words("<p>Esta tela ja foi salva ate aqui.</p>")).toEqual(["ja", "ate"]);
    expect(words('const k = "ja";')).toEqual([]);
  });

  it("o código atual de client/src está limpo", () => {
    const output = execFileSync("node", ["scripts/check-ui-accents.mjs"], { cwd: repoRoot, encoding: "utf8" });
    expect(output).toMatch(/check-ui-accents: OK/);
  });
});
