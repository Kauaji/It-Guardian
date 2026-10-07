// Catálogo dos cadastros auxiliares das Ordens de Serviço: campos, colunas e funções da API.
import { Boxes, Building2, ListChecks, SlidersHorizontal, UserCog } from "lucide-react";
import {
  createClient,
  createPriorityRule,
  createProblemType,
  createProduct,
  createService,
  createTechnician,
  deleteClient,
  deletePriorityRule,
  deleteProblemType,
  deleteProduct,
  deleteService,
  deleteTechnician,
  fetchClients,
  fetchPriorityRules,
  fetchProblemTypes,
  fetchProducts,
  fetchServices,
  fetchTechnicians,
  importClients,
  importProducts,
  updateClient,
  updatePriorityRule,
  updateProblemType,
  updateProduct,
  updateService,
  updateTechnician
} from "../../../api.js";

export const sections = [
  { id: "clients", label: "Clientes", icon: Building2 },
  { id: "products", label: "Peças", icon: Boxes },
  { id: "services", label: "Serviços", icon: ListChecks },
  { id: "technicians", label: "Técnicos", icon: UserCog },
  { id: "problemTypes", label: "Tipos de Problema", icon: ListChecks },
  { id: "priorityRules", label: "Regras de Prioridade", icon: SlidersHorizontal }
];

export const priorityOptions = [
  { value: "", label: "Sem prioridade padrão" },
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" }
];

const requiredPriorityOptions = priorityOptions.filter((option) => option.value);
export const defaultProblemCategories = [
  "Computador",
  "Notebook",
  "Servidor",
  "Impressora",
  "Teclado",
  "Mouse",
  "Monitor",
  "Rede",
  "Sistema",
  "Outro"
];

export const ruleTypeOptions = [
  { value: "client", label: "Prioridade por cliente" },
  { value: "sector", label: "Prioridade por setor" },
  { value: "problem_type", label: "Prioridade por tipo de problema" },
  { value: "service", label: "Prioridade por serviço" },
  { value: "category", label: "Prioridade por categoria" },
  { value: "open_time", label: "Tempo da ordem aberta" },
  { value: "equipment_category", label: "Categoria do equipamento" }
];

export const configs = {
  clients: {
    singular: "cliente",
    plural: "clientes",
    searchLabel: "clientes",
    titleField: "tradeName",
    importable: true,
    create: createClient,
    update: updateClient,
    remove: deleteClient,
    fetch: fetchClients,
    importCsv: importClients,
    fields: [
      { name: "tradeName", label: "Nome fantasia", required: true },
      { name: "legalName", label: "Razão social" },
      { name: "document", label: "CNPJ" },
      { name: "phone", label: "Telefone" },
      { name: "email", label: "E-mail", type: "email" },
      { name: "address", label: "Endereço", wide: true },
      { name: "contactName", label: "Responsável" },
      { name: "active", label: "Status", type: "status" },
      { name: "notes", label: "Observações", type: "textarea", wide: true }
    ],
    columns: [
      { key: "tradeName", label: "Cliente" },
      { key: "document", label: "CNPJ" },
      { key: "phone", label: "Telefone" },
      { key: "contactName", label: "Responsável" },
      { key: "active", label: "Status", type: "status" }
    ]
  },
  products: {
    singular: "peça",
    plural: "produtos",
    searchLabel: "peças",
    titleField: "name",
    importable: true,
    create: createProduct,
    update: updateProduct,
    remove: deleteProduct,
    fetch: fetchProducts,
    importCsv: importProducts,
    fields: [
      { name: "name", label: "Nome do produto", required: true },
      { name: "category", label: "Categoria" },
      { name: "brand", label: "Marca" },
      { name: "model", label: "Modelo" },
      { name: "internalCode", label: "Código interno" },
      { name: "assetTag", label: "Patrimônio", internalOnly: true },
      { name: "quantity", label: "Quantidade", type: "number" },
      { name: "unitPrice", label: "Valor unitário", type: "currency", businessOnly: true },
      { name: "unit", label: "Unidade" }
    ],
    columns: [
      { key: "name", label: "Produto" },
      { key: "category", label: "Categoria" },
      { key: "internalCode", label: "Código" },
      { key: "assetTag", label: "Patrimônio", internalOnly: true },
      { key: "quantity", label: "Qtd." },
      { key: "unitPrice", label: "Valor", type: "currency", businessOnly: true }
    ]
  },
  services: {
    singular: "serviço",
    plural: "serviços",
    searchLabel: "serviços",
    titleField: "name",
    importable: false,
    create: createService,
    update: updateService,
    remove: deleteService,
    fetch: fetchServices,
    fields: [
      { name: "code", label: "Código" },
      { name: "name", label: "Nome do serviço", required: true },
      { name: "description", label: "Descrição", type: "textarea", wide: true },
      { name: "category", label: "Categoria" },
      { name: "defaultPriority", label: "Prioridade padrão", type: "select", options: priorityOptions },
      { name: "defaultValue", label: "Valor do serviço", type: "currency", businessOnly: true },
      { name: "active", label: "Status", type: "status" }
    ],
    columns: [
      { key: "code", label: "Código" },
      { key: "name", label: "Serviço" },
      { key: "category", label: "Categoria" },
      { key: "defaultPriority", label: "Prioridade", type: "priority" },
      { key: "defaultValue", label: "Valor", type: "currency", businessOnly: true },
      { key: "active", label: "Status", type: "status" }
    ]
  },
  technicians: {
    singular: "técnico",
    plural: "técnicos",
    searchLabel: "técnicos",
    titleField: "name",
    importable: false,
    create: createTechnician,
    update: updateTechnician,
    remove: deleteTechnician,
    fetch: fetchTechnicians,
    fields: [
      { name: "name", label: "Nome", required: true },
      { name: "email", label: "E-mail", type: "email" },
      { name: "phone", label: "Telefone" },
      { name: "role", label: "Cargo/função" },
      { name: "specialty", label: "Especialidade" },
      { name: "allowedClientIds", label: "Clientes permitidos", type: "clientMulti", businessOnly: true },
      { name: "active", label: "Status", type: "status" },
      { name: "notes", label: "Observações", type: "textarea", wide: true }
    ],
    columns: [
      { key: "name", label: "Técnico" },
      { key: "email", label: "E-mail" },
      { key: "phone", label: "Telefone" },
      { key: "specialty", label: "Especialidade" },
      { key: "active", label: "Status", type: "status" }
    ]
  },
  problemTypes: {
    singular: "tipo de problema",
    plural: "problemTypes",
    searchLabel: "tipos de problema",
    titleField: "name",
    importable: false,
    create: createProblemType,
    update: updateProblemType,
    remove: deleteProblemType,
    fetch: fetchProblemTypes,
    fields: [
      { name: "name", label: "Nome do problema", required: true },
      { name: "category", label: "Categoria associada", type: "category" },
      { name: "defaultPriority", label: "Prioridade padrão", type: "select", options: priorityOptions }
    ],
    columns: [
      { key: "name", label: "Problema" },
      { key: "category", label: "Categoria" },
      { key: "defaultPriority", label: "Prioridade", type: "priority" }
    ]
  },
  priorityRules: {
    singular: "regra",
    plural: "priorityRules",
    searchLabel: "regras de prioridade",
    titleField: "name",
    importable: false,
    create: createPriorityRule,
    update: updatePriorityRule,
    remove: deletePriorityRule,
    fetch: fetchPriorityRules,
    fields: [
      { name: "name", label: "Nome da regra", required: true },
      { name: "ruleType", label: "Tipo da regra", type: "select", options: ruleTypeOptions },
      { name: "targetValue", label: "Alvo/valor da regra" },
      { name: "priority", label: "Prioridade sugerida", type: "select", options: requiredPriorityOptions },
      { name: "thresholdHours", label: "Horas limite", type: "number" },
      { name: "active", label: "Status", type: "status" },
      { name: "notes", label: "Observações", type: "textarea", wide: true }
    ],
    columns: [
      { key: "name", label: "Regra" },
      { key: "ruleType", label: "Tipo", type: "ruleType" },
      { key: "targetValue", label: "Alvo" },
      { key: "priority", label: "Prioridade", type: "priority" },
      { key: "active", label: "Status", type: "status" }
    ]
  }
};

export function emptyRecord(config) {
  return config.fields.reduce((record, field) => {
    record[field.name] = field.type === "status" ? true : field.type === "number" ? 0 : field.type === "clientMulti" ? [] : "";
    return record;
  }, {});
}

export function buildProblemCategories(records = []) {
  const categories = records.map((record) => record.category).filter(Boolean);
  return [...new Set([...defaultProblemCategories, ...categories])];
}

/** Campos/colunas visíveis conforme o modo: businessOnly só no Business, internalOnly só no Local. */
export function visibleByMode(items, businessMode) {
  return items.filter((item) => (!item.businessOnly || businessMode) && (!item.internalOnly || !businessMode));
}
