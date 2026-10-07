import { describe, expect, it } from "vitest";
import { PASSWORD_MAX_BYTES, byteLength, passwordChecklist, passwordStrength, validatePasswordLocally } from "./passwordPolicy.js";

describe("validatePasswordLocally", () => {
  it("aceita uma frase longa", () => {
    expect(validatePasswordLocally("cavalo azul come batata doce")).toEqual({ valid: true, errors: [] });
  });

  it("exige 12 caracteres", () => {
    const result = validatePasswordLocally("curta123");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toBe("A senha precisa ter pelo menos 12 caracteres.");
  });

  it("limita a 72 bytes (nao caracteres)", () => {
    expect(byteLength("ação")).toBe(6);
    const tooLong = "ç".repeat(40); // 40 caracteres, 80 bytes
    const result = validatePasswordLocally(tooLong);
    expect(result.errors).toContain(`A senha pode ter no máximo ${PASSWORD_MAX_BYTES} bytes.`);
    expect(validatePasswordLocally("a1b2c3d4e5f6".repeat(7)).errors).toContain(`A senha pode ter no máximo ${PASSWORD_MAX_BYTES} bytes.`);
  });

  it("recusa senha so de espacos", () => {
    expect(validatePasswordLocally(" ".repeat(14)).errors).toContain("A senha não pode ser formada só por espaços.");
  });

  it("recusa repeticoes e poucos caracteres distintos", () => {
    expect(validatePasswordLocally("aaaaaaaaaaaaaa").errors).toContain("A senha é previsível demais (repetições ou sequências).");
    expect(validatePasswordLocally("abababababababab").valid).toBe(false);
    expect(validatePasswordLocally("abcabcabcabcabc").valid).toBe(false);
  });

  it("recusa senha que contem nome ou parte do e-mail", () => {
    const context = { email: "maria.souza@empresa.com", name: "Maria Souza" };
    expect(validatePasswordLocally("Souza-trabalho-2026!", context).errors).toContain("A senha não pode conter seu nome ou e-mail.");
    expect(validatePasswordLocally("mariasouza-vai-ao-mar", context).valid).toBe(false);
    expect(validatePasswordLocally("cavalo azul come batata doce", context).valid).toBe(true);
  });

  it("trata valores nulos como vazios", () => {
    expect(validatePasswordLocally(undefined).valid).toBe(false);
    expect(validatePasswordLocally(null, { email: null, name: null }).valid).toBe(false);
  });
});

describe("passwordChecklist", () => {
  it("marca comprimento e bytes", () => {
    expect(passwordChecklist("curta").map((item) => item.met)).toEqual([false, true]);
    expect(passwordChecklist("uma frase bem longa").map((item) => item.met)).toEqual([true, true]);
    expect(passwordChecklist("ç".repeat(40)).map((item) => item.met)).toEqual([true, false]);
  });
});

describe("passwordStrength", () => {
  it("sobe com comprimento e variedade", () => {
    expect(passwordStrength("curta").score).toBe(0);
    expect(passwordStrength("curta").label).toBe("Muito curta");
    expect(passwordStrength("umasenhaqualquer").score).toBe(2);
    expect(passwordStrength("abcdefghijkl").score).toBe(1);
    expect(passwordStrength("UmaSenha-Bem-Longa-2026!").score).toBe(3);
    expect(passwordStrength("uma frase com espacos").score).toBe(3);
    expect(passwordStrength(undefined).score).toBe(0);
  });
});
