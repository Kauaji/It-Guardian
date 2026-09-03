import { describe, expect, it } from "vitest";

import {
  buildReportFilterParams,
  canViewReportType,
  getReportType,
  REPORT_TABLE_COLUMNS,
  REPORT_TYPES
} from "./reportUtils.js";

describe("buildReportFilterParams", () => {
  it("remove valores vazios, nulos e o sentinela 'all'", () => {
    const params = buildReportFilterParams({
      startDate: "2026-08-01",
      endDate: "",
      status: "all",
      priority: "high",
      search: "  ",
      technician: null
    });

    expect(params).toEqual({ startDate: "2026-08-01", priority: "high" });
  });

  it("apara espacos em valores de texto", () => {
    const params = buildReportFilterParams({ search: "  disco cheio  " });
    expect(params.search).toBe("disco cheio");
  });
});

describe("getReportType / canViewReportType", () => {
  it("retorna null para um tipo desconhecido", () => {
    expect(getReportType("inexistente")).toBeNull();
  });

  it("exige todas as permissoes do tipo, nao so uma", () => {
    const hasPermission = (user, permission) => user.permissions.includes(permission);
    const userComTudo = { permissions: ["reports.view", "reports.view_scripts"] };
    const userParcial = { permissions: ["reports.view"] };

    expect(canViewReportType(userComTudo, hasPermission, "scripts")).toBe(true);
    expect(canViewReportType(userParcial, hasPermission, "scripts")).toBe(false);
  });

  it("relatorio mensal so exige reports.view", () => {
    const hasPermission = (user, permission) => user.permissions.includes(permission);
    const user = { permissions: ["reports.view"] };
    expect(canViewReportType(user, hasPermission, "monthly")).toBe(true);
  });
});

describe("REPORT_TYPES / REPORT_TABLE_COLUMNS", () => {
  it("define exatamente 7 tipos de relatorio", () => {
    expect(REPORT_TYPES).toHaveLength(7);
  });

  it("toda coluna de preview de cada tipo existe entre as colunas de tabela definidas", () => {
    for (const type of REPORT_TYPES) {
      expect(REPORT_TABLE_COLUMNS[type.id]).toBeDefined();
      expect(REPORT_TABLE_COLUMNS[type.id].length).toBeGreaterThan(0);
    }
  });

  it("nenhuma coluna de tabela usa uma chave sensivel (token, stdout/stderr integral, conteudo de script)", () => {
    const bannedKeys = /token|password|secret|iceServers|script_content|frame|chat/i;
    for (const columns of Object.values(REPORT_TABLE_COLUMNS)) {
      for (const column of columns) {
        expect(column.key).not.toMatch(bannedKeys);
        expect(column.key).not.toBe("stdout");
        expect(column.key).not.toBe("stderr");
      }
    }
  });
});
