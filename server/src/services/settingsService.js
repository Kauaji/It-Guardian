import { badRequest, notFoundError } from "../lib/errors.js";
import { addLog } from "../repositories/logRepository.js";
import {
  createSettingsRecord,
  deleteSettingsRecord,
  findSettingsRecord,
  hasDuplicateSettingsRecord,
  listSettingsRecords,
  updateSettingsRecord
} from "../repositories/settingsRepository.js";

const importFieldMaps = {
  clients: {
    "nome fantasia": "tradeName",
    nome: "tradeName",
    cliente: "tradeName",
    "razao social": "legalName",
    "razão social": "legalName",
    cnpj: "document",
    documento: "document",
    telefone: "phone",
    email: "email",
    "e-mail": "email",
    endereco: "address",
    "endereço": "address",
    responsavel: "contactName",
    "responsável": "contactName",
    observacoes: "notes",
    "observações": "notes"
  },
  products: {
    nome: "name",
    produto: "name",
    "nome do produto": "name",
    categoria: "category",
    marca: "brand",
    modelo: "model",
    codigo: "internalCode",
    "código": "internalCode",
    "codigo interno": "internalCode",
    "código interno": "internalCode",
    patrimonio: "assetTag",
    quantidade: "quantity",
    estoque: "quantity",
    valor: "unitPrice",
    preco: "unitPrice",
    "preco unitario": "unitPrice",
    "valor unitario": "unitPrice",
    unidade: "unit",
    observacoes: "notes",
    "observações": "notes"
  }
};

function normalizeHeader(value = "") {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function stripByteOrderMark(text) {
  return text.length && text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if ((char === "," || char === ";") && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text = "") {
  const lines = stripByteOrderMark(String(text))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

function mapImportRow(resource, row) {
  const fieldMap = importFieldMaps[resource] || {};
  return Object.entries(row).reduce((payload, [header, value]) => {
    const field = fieldMap[normalizeHeader(header)];
    if (field) payload[field] = value;
    return payload;
  }, {});
}

export function createResourceService(resource, label) {
  return {
    async list(search) {
      return listSettingsRecords(resource, search || "");
    },

    async details(id) {
      const record = await findSettingsRecord(resource, id);
      if (!record) throw notFoundError(`${label} nao encontrado.`);
      return record;
    },

    async create(payload, user) {
      const record = await createSettingsRecord(resource, payload);
      await addLog({
        type: `${resource}_create`,
        message: `${label} created`,
        userId: user.id,
        meta: { id: record.id }
      });
      return record;
    },

    async update(id, payload, user) {
      const record = await updateSettingsRecord(resource, id, payload);
      await addLog({
        type: `${resource}_update`,
        message: `${label} updated`,
        userId: user.id,
        meta: { id: record.id }
      });
      return record;
    },

    async remove(id, user) {
      const record = await deleteSettingsRecord(resource, id);
      await addLog({
        type: `${resource}_delete`,
        message: `${label} deleted`,
        userId: user.id,
        meta: { id: record.id }
      });
      return record;
    },

    async importCsv(csv, user) {
      if (!csv || typeof csv !== "string") {
        throw badRequest("Envie um arquivo CSV valido.");
      }

      const rows = parseCsv(csv);
      if (!rows.length) {
        throw badRequest("O CSV precisa ter cabecalho e pelo menos uma linha.");
      }

      const imported = [];
      const errors = [];

      for (const [index, row] of rows.entries()) {
        const payload = mapImportRow(resource, row);

        try {
          if (await hasDuplicateSettingsRecord(resource, payload)) {
            errors.push({ line: index + 2, message: "Registro duplicado ignorado." });
            continue;
          }
          imported.push(await createSettingsRecord(resource, payload));
        } catch (error) {
          errors.push({ line: index + 2, message: error.message });
        }
      }

      await addLog({
        type: `${resource}_import`,
        message: `${label} import finished`,
        userId: user.id,
        meta: { imported: imported.length, errors: errors.length }
      });

      return { imported: imported.length, errors, records: imported };
    }
  };
}

export const clientService = createResourceService("clients", "client");
export const productService = createResourceService("products", "product");
export const serviceOfferingService = createResourceService("services", "service");
export const technicianService = createResourceService("technicians", "technician");
export const problemTypeService = createResourceService("problemTypes", "problemType");
export const priorityRuleService = createResourceService("priorityRules", "priorityRule");
