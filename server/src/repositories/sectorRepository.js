import { randomUUID } from "node:crypto";
import { query } from "../database.js";
import { normalizePermissions } from "../permissions.js";

export async function listSectors() {
  const result = await query(
    "SELECT id, name, description, active, permissions, created_at, updated_at FROM sectors ORDER BY active DESC, name ASC"
  );
  return result.rows.map(fromRow);
}

export async function findSectorById(id) {
  const result = await query(
    "SELECT id, name, description, active, permissions, created_at, updated_at FROM sectors WHERE id = $1",
    [id]
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function findSectorByName(name) {
  const result = await query(
    "SELECT id, name, description, active, permissions, created_at, updated_at FROM sectors WHERE LOWER(name) = LOWER($1)",
    [name]
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function createSector({ name, description = "", active = true, permissions = [] }) {
  const result = await query(
    `
      INSERT INTO sectors (id, name, description, active, permissions)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING id, name, description, active, permissions, created_at, updated_at
    `,
    [randomUUID(), name.trim(), description?.trim() || null, Boolean(active), JSON.stringify(normalizePermissions(permissions))]
  );
  return fromRow(result.rows[0]);
}

export async function updateSector(id, payload = {}) {
  const current = await findSectorById(id);
  if (!current) return null;

  const result = await query(
    `
      UPDATE sectors
      SET name = $2,
          description = $3,
          active = $4,
          permissions = $5::jsonb,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, description, active, permissions, created_at, updated_at
    `,
    [
      id,
      (payload.name || current.name).trim(),
      Object.prototype.hasOwnProperty.call(payload, "description") ? payload.description?.trim() || null : current.description || null,
      Object.prototype.hasOwnProperty.call(payload, "active") ? payload.active !== false : current.active,
      JSON.stringify(normalizePermissions(payload.permissions ?? current.permissions))
    ]
  );

  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function updateSectorPermissions(id, permissions = []) {
  const result = await query(
    `
      UPDATE sectors
      SET permissions = $2::jsonb,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, description, active, permissions, created_at, updated_at
    `,
    [id, JSON.stringify(normalizePermissions(permissions))]
  );

  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function deactivateSector(id) {
  const result = await query(
    `
      UPDATE sectors
      SET active = FALSE,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, description, active, permissions, created_at, updated_at
    `,
    [id]
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function seedDefaultSectors() {
  const sectors = [
    [
      "sector-administracao",
      "Administracao",
      "Administradores e responsaveis pelo sistema.",
      ["admin.full"]
    ],
    [
      "sector-ti",
      "TI",
      "Equipe interna de tecnologia.",
      [
        "dashboard.view",
        "inventory.view",
        "inventory.create_asset",
        "inventory.edit_asset",
        "inventory.move_assets",
        "inventory.manage_segments",
        "inventory.view_machine",
        "inventory.print_qrcode",
        "service_orders.view",
        "service_orders.view_all",
        "service_orders.create",
        "service_orders.edit",
        "service_orders.assign",
        "service_orders.change_sector",
        "service_orders.change_status",
        "service_orders.finish",
        "service_orders.attendance",
        "service_orders.parts",
        "service_orders.print",
        "service_orders.settings"
      ]
    ],
    [
      "sector-support-n1",
      "Suporte N1",
      "Atendimento inicial e triagem.",
      ["service_orders.view", "service_orders.create", "service_orders.attendance", "service_orders.change_status"]
    ],
    [
      "sector-suporte-n2",
      "Suporte N2",
      "Atendimento tecnico avancado.",
      [
        "service_orders.view",
        "service_orders.create",
        "service_orders.edit",
        "service_orders.attendance",
        "service_orders.change_status",
        "service_orders.finish",
        "service_orders.parts"
      ]
    ],
    [
      "sector-infra",
      "Infraestrutura",
      "Servidores, manutencao e ativos fisicos.",
      [
        "inventory.view",
        "inventory.view_machine",
        "inventory.create_asset",
        "inventory.edit_asset",
        "inventory.move_assets",
        "service_orders.view",
        "service_orders.create",
        "service_orders.edit",
        "service_orders.attendance",
        "service_orders.change_status"
      ]
    ],
    [
      "sector-redes",
      "Redes",
      "Conectividade, ativos de rede e seguranca.",
      [
        "dashboard.view",
        "inventory.view",
        "inventory.view_machine",
        "inventory.create_asset",
        "service_orders.view",
        "service_orders.create",
        "service_orders.attendance",
        "service_orders.change_status"
      ]
    ],
    [
      "sector-financeiro",
      "Financeiro",
      "Usuarios do setor financeiro.",
      ["service_orders.view", "service_orders.create"]
    ],
    [
      "sector-diretoria",
      "Diretoria",
      "Gestores e diretoria.",
      ["dashboard.view", "service_orders.view", "service_orders.create"]
    ],
    [
      "sector-geral",
      "Geral",
      "Setor padrao para solicitacoes sem setor especifico.",
      []
    ]
  ];

  for (const [id, name, description, permissions] of sectors) {
    await query(
      `
        INSERT INTO sectors (id, name, description, active, permissions)
        VALUES ($1, $2, $3, TRUE, $4::jsonb)
        ON CONFLICT (id) DO NOTHING
      `,
      [id, name, description, JSON.stringify(normalizePermissions(permissions))]
    );
  }
}

function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    active: row.active !== false,
    permissions: normalizePermissions(row.permissions),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
