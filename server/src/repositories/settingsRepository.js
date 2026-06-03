import { randomUUID } from "node:crypto";
import { query } from "../database.js";

const resources = {
  clients: {
    table: "clients",
    searchColumns: ["trade_name", "legal_name", "document", "email", "contact_name"],
    writable: ["tradeName", "legalName", "document", "phone", "email", "address", "contactName", "notes", "active"],
    columns: {
      tradeName: "trade_name",
      legalName: "legal_name",
      document: "document",
      phone: "phone",
      email: "email",
      address: "address",
      contactName: "contact_name",
      notes: "notes",
      active: "active"
    },
    required: "tradeName",
    duplicateColumns: ["document", "trade_name"]
  },
  products: {
    table: "products",
    searchColumns: ["name", "category", "brand", "model", "internal_code", "asset_tag"],
    writable: ["name", "category", "brand", "model", "internalCode", "assetTag", "quantity", "unitPrice", "unit", "notes", "active"],
    columns: {
      name: "name",
      category: "category",
      brand: "brand",
      model: "model",
      internalCode: "internal_code",
      assetTag: "asset_tag",
      quantity: "quantity",
      unitPrice: "unit_price",
      unit: "unit",
      notes: "notes",
      active: "active"
    },
    required: "name",
    duplicateColumns: ["internal_code", "name"]
  },
  services: {
    table: "service_catalog",
    searchColumns: ["code", "name", "description", "category", "default_priority", "notes"],
    writable: ["code", "name", "description", "category", "defaultPriority", "defaultValue", "notes", "active"],
    columns: {
      code: "code",
      name: "name",
      description: "description",
      category: "category",
      defaultPriority: "default_priority",
      defaultValue: "default_value",
      notes: "notes",
      active: "active"
    },
    required: "name",
    duplicateColumns: ["code", "name"]
  },
  technicians: {
    table: "technicians",
    searchColumns: ["name", "email", "phone", "role", "specialty"],
    writable: ["name", "email", "phone", "role", "specialty", "notes", "active", "allowedClientIds"],
    columns: {
      name: "name",
      email: "email",
      phone: "phone",
      role: "role",
      specialty: "specialty",
      notes: "notes",
      active: "active",
      allowedClientIds: "allowed_client_ids"
    },
    required: "name",
    duplicateColumns: ["email", "name"]
  },
  problemTypes: {
    table: "problem_types",
    searchColumns: ["name", "description", "category", "default_priority"],
    writable: ["name", "description", "category", "defaultPriority", "active"],
    columns: {
      name: "name",
      description: "description",
      category: "category",
      defaultPriority: "default_priority",
      active: "active"
    },
    required: "name",
    duplicateColumns: ["name"]
  },
  priorityRules: {
    table: "priority_rules",
    searchColumns: ["name", "rule_type", "target_value", "priority", "notes"],
    writable: ["name", "ruleType", "targetValue", "priority", "thresholdHours", "notes", "active"],
    columns: {
      name: "name",
      ruleType: "rule_type",
      targetValue: "target_value",
      priority: "priority",
      thresholdHours: "threshold_hours",
      notes: "notes",
      active: "active"
    },
    required: "name",
    duplicateColumns: ["name"]
  }
};

function getResourceConfig(resource) {
  const config = resources[resource];
  if (!config) {
    const error = new Error("Recurso de configuracao invalido.");
    error.statusCode = 404;
    throw error;
  }
  return config;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value == null || value === "") return true;
  return !["false", "0", "inativo", "inactive", "nao", "não"].includes(String(value).trim().toLowerCase());
}

function normalizeQuantity(value) {
  if (value == null || value === "") return 0;
  const normalized = Number(String(value).replace(",", "."));
  return Number.isFinite(normalized) ? normalized : 0;
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return normalizeStringArray(parsed);
    } catch {
      // Plain CSV strings are still accepted below.
    }

    return [...new Set(value.split(/[,\n;]/).map((item) => item.trim()).filter(Boolean))];
  }

  return [];
}

function normalizeServiceCode(value = "") {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "-");
}

async function getNextServiceCode() {
  const result = await query("SELECT code FROM service_catalog WHERE code IS NOT NULL");
  const nextNumber = result.rows.reduce((highest, row) => {
    const match = String(row.code || "").match(/^SRV-(\d+)$/i);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;

  return `SRV-${String(nextNumber).padStart(4, "0")}`;
}

async function assertUniqueServiceCode(code, currentId = "") {
  if (!code) return;
  const result = await query(
    "SELECT id FROM service_catalog WHERE lower(code) = lower($1) AND id <> $2 LIMIT 1",
    [code, currentId || ""]
  );
  if (result.rows.length) {
    const error = new Error("Ja existe um servico com esse codigo.");
    error.statusCode = 409;
    throw error;
  }
}

function normalizePayload(config, payload = {}) {
  const normalized = {};

  for (const key of config.writable) {
    if (!(key in payload)) continue;

    if (key === "active") {
      normalized[key] = normalizeBoolean(payload[key]);
    } else if (key === "quantity" || key === "thresholdHours" || key === "unitPrice" || key === "defaultValue") {
      normalized[key] = normalizeQuantity(payload[key]);
    } else if (key === "allowedClientIds") {
      normalized[key] = normalizeStringArray(payload[key]);
    } else {
      normalized[key] = typeof payload[key] === "string" ? payload[key].trim() : payload[key];
    }
  }

  return normalized;
}

function fromRow(row, resource) {
  if (resource === "clients") {
    return {
      id: row.id,
      tradeName: row.trade_name,
      legalName: row.legal_name,
      document: row.document,
      phone: row.phone,
      email: row.email,
      address: row.address,
      contactName: row.contact_name,
      notes: row.notes,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  if (resource === "products") {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      brand: row.brand,
      model: row.model,
      internalCode: row.internal_code,
      assetTag: row.asset_tag,
      quantity: Number(row.quantity || 0),
      unitPrice: Number(row.unit_price || 0),
      unit: row.unit,
      notes: row.notes,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  if (resource === "services") {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || row.notes,
      category: row.category,
      defaultPriority: row.default_priority,
      defaultValue: Number(row.default_value || 0),
      notes: row.notes,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  if (resource === "technicians") {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      specialty: row.specialty,
      notes: row.notes,
      allowedClientIds: normalizeStringArray(row.allowed_client_ids),
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  if (resource === "problemTypes") {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      defaultPriority: row.default_priority,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  if (resource === "priorityRules") {
    return {
      id: row.id,
      name: row.name,
      ruleType: row.rule_type,
      targetValue: row.target_value,
      priority: row.priority,
      thresholdHours: row.threshold_hours == null ? "" : Number(row.threshold_hours),
      notes: row.notes,
      active: row.active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  return {
    id: row.id,
    name: row.name,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listSettingsRecords(resource, search = "") {
  const config = getResourceConfig(resource);
  const term = search.trim();

  if (!term) {
    const result = await query(`SELECT * FROM ${config.table} ORDER BY created_at DESC`);
    return result.rows.map((row) => fromRow(row, resource));
  }

  const conditions = config.searchColumns.map((column) => `${column} ILIKE $1`).join(" OR ");
  const result = await query(
    `SELECT * FROM ${config.table} WHERE ${conditions} ORDER BY created_at DESC`,
    [`%${term}%`]
  );
  return result.rows.map((row) => fromRow(row, resource));
}

export async function findSettingsRecord(resource, id) {
  const config = getResourceConfig(resource);
  const result = await query(`SELECT * FROM ${config.table} WHERE id = $1`, [id]);
  return result.rows[0] ? fromRow(result.rows[0], resource) : null;
}

export async function createSettingsRecord(resource, payload) {
  const config = getResourceConfig(resource);
  const normalized = normalizePayload(config, payload);

  if (!normalized[config.required] || String(normalized[config.required]).trim().length < 2) {
    const error = new Error("Informe um nome com pelo menos 2 caracteres.");
    error.statusCode = 400;
    throw error;
  }

  if (resource === "services") {
    normalized.code = normalizeServiceCode(normalized.code) || await getNextServiceCode();
    normalized.defaultPriority = normalized.defaultPriority || null;
    await assertUniqueServiceCode(normalized.code);
  }

  const keys = Object.keys(normalized);
  const columns = keys.map((key) => config.columns[key]);
  const placeholders = keys.map((_, index) => `$${index + 2}`);
  const values = keys.map((key) => normalized[key]);

  const result = await query(
    `
      INSERT INTO ${config.table} (id, ${columns.join(", ")})
      VALUES ($1, ${placeholders.join(", ")})
      RETURNING *
    `,
    [randomUUID(), ...values]
  );

  return fromRow(result.rows[0], resource);
}

export async function updateSettingsRecord(resource, id, payload) {
  const config = getResourceConfig(resource);
  const current = await findSettingsRecord(resource, id);
  if (!current) {
    const error = new Error("Registro nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const normalized = normalizePayload(config, payload);
  if (resource === "services") {
    if ("code" in normalized) {
      normalized.code = normalizeServiceCode(normalized.code);
    }
    if (!normalized.code && !current.code) {
      normalized.code = await getNextServiceCode();
    }
    if ("defaultPriority" in normalized && !normalized.defaultPriority) {
      normalized.defaultPriority = null;
    }
    await assertUniqueServiceCode(normalized.code || current.code, id);
  }

  const keys = Object.keys(normalized);
  if (!keys.length) return current;

  if (config.required in normalized && String(normalized[config.required] || "").trim().length < 2) {
    const error = new Error("Informe um nome com pelo menos 2 caracteres.");
    error.statusCode = 400;
    throw error;
  }

  const assignments = keys.map((key, index) => `${config.columns[key]} = $${index + 2}`);
  const values = keys.map((key) => normalized[key]);
  const result = await query(
    `
      UPDATE ${config.table}
      SET ${assignments.join(", ")},
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...values]
  );

  return fromRow(result.rows[0], resource);
}

export async function deleteSettingsRecord(resource, id) {
  const config = getResourceConfig(resource);
  const result = await query(`DELETE FROM ${config.table} WHERE id = $1 RETURNING *`, [id]);
  if (!result.rows[0]) {
    const error = new Error("Registro nao encontrado.");
    error.statusCode = 404;
    throw error;
  }
  return fromRow(result.rows[0], resource);
}

export async function hasDuplicateSettingsRecord(resource, payload) {
  const config = getResourceConfig(resource);

  for (const column of config.duplicateColumns) {
    const key = Object.entries(config.columns).find(([, value]) => value === column)?.[0];
    const value = key ? payload[key] : null;
    if (!value) continue;

    const result = await query(
      `SELECT id FROM ${config.table} WHERE lower(${column}) = lower($1) LIMIT 1`,
      [String(value).trim()]
    );
    if (result.rows.length) return true;
  }

  return false;
}
