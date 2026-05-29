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
  const lines = String(text)
    .replace(/^\uFEFF/, "")
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

function createController(resource, label) {
  return {
    async list(req, res, next) {
      try {
        const records = await listSettingsRecords(resource, req.query.search || "");
        res.json({ [resource]: records });
      } catch (error) {
        next(error);
      }
    },

    async details(req, res, next) {
      try {
        const record = await findSettingsRecord(resource, req.params.id);
        if (!record) return res.status(404).json({ message: `${label} nao encontrado.` });
        res.json({ [label]: record });
      } catch (error) {
        next(error);
      }
    },

    async create(req, res, next) {
      try {
        const record = await createSettingsRecord(resource, req.body);
        await addLog({
          type: `${resource}_create`,
          message: `${label} created`,
          userId: req.user.id,
          meta: { id: record.id }
        });
        res.status(201).json({ [label]: record });
      } catch (error) {
        next(error);
      }
    },

    async update(req, res, next) {
      try {
        const record = await updateSettingsRecord(resource, req.params.id, req.body);
        await addLog({
          type: `${resource}_update`,
          message: `${label} updated`,
          userId: req.user.id,
          meta: { id: record.id }
        });
        res.json({ [label]: record });
      } catch (error) {
        next(error);
      }
    },

    async remove(req, res, next) {
      try {
        const record = await deleteSettingsRecord(resource, req.params.id);
        await addLog({
          type: `${resource}_delete`,
          message: `${label} deleted`,
          userId: req.user.id,
          meta: { id: record.id }
        });
        res.json({ [label]: record });
      } catch (error) {
        next(error);
      }
    },

    async importCsv(req, res, next) {
      try {
        const csv = req.body.csv;
        if (!csv || typeof csv !== "string") {
          return res.status(400).json({ message: "Envie um arquivo CSV valido." });
        }

        const rows = parseCsv(csv);
        if (!rows.length) {
          return res.status(400).json({ message: "O CSV precisa ter cabecalho e pelo menos uma linha." });
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
          userId: req.user.id,
          meta: { imported: imported.length, errors: errors.length }
        });

        res.json({ imported: imported.length, errors, records: imported });
      } catch (error) {
        next(error);
      }
    }
  };
}

export const clientController = createController("clients", "client");
export const productController = createController("products", "product");
export const serviceController = createController("services", "service");
export const technicianController = createController("technicians", "technician");
export const problemTypeController = createController("problemTypes", "problemType");
export const priorityRuleController = createController("priorityRules", "priorityRule");
