import { describe, expect, it } from "vitest";
import { ACCOUNT_SECURITY_PATH, ACCOUNT_VIEW_ID } from "./accountRoutes.js";
import { labelForView, pathForView, viewIdFromPath } from "../app/routes.js";

describe("rota da conta", () => {
  it("/conta/seguranca e uma visao propria, fora da tabela de permissoes", () => {
    expect(ACCOUNT_SECURITY_PATH).toBe("/conta/seguranca");
    expect(viewIdFromPath("/conta/seguranca")).toBe(ACCOUNT_VIEW_ID);
    expect(pathForView(ACCOUNT_VIEW_ID)).toBe("/conta/seguranca");
    expect(labelForView(ACCOUNT_VIEW_ID)).toBe("Segurança da conta");
    expect(viewIdFromPath("/conta/seguranca/x")).toBeNull();
  });
});
