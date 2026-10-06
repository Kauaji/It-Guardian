import { priorityOptions, ruleTypeOptions } from "./settingsConfigs.js";

/** Conteúdo da célula de uma coluna da tabela de cadastros. */
export function renderCell(record, column) {
  const value = record[column.key];
  if (column.type === "status") {
    return <span className={`settings-status ${value ? "active" : "inactive"}`}>{value ? "Ativo" : "Inativo"}</span>;
  }
  if (column.type === "priority") {
    return priorityOptions.find((option) => option.value === value)?.label || "Não definida";
  }
  if (column.type === "ruleType") {
    return ruleTypeOptions.find((option) => option.value === value)?.label || value || "Não informado";
  }
  if (column.type === "currency") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
  }
  return value || "Não informado";
}
