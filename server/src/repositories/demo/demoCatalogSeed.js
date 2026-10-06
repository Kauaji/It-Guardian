import { query } from "../../database.js";
import {
  demoClients,
  demoProblemTypes,
  demoProducts,
  demoServices,
  demoTechnicians
} from "./demoCatalogData.js";

const technicianClientAccess = {
  "demo-tech-ana": ["demo-client-alfa", "demo-client-beta"],
  "demo-tech-bruno": ["demo-client-alfa"],
  "demo-tech-carla": ["demo-client-orion"],
  "demo-tech-diego": ["demo-client-beta", "demo-client-orion"]
};

// Tecnicos, clientes (e quais clientes cada tecnico atende), produtos,
// catalogo de servicos e tipos de problema.
export async function seedDemoCatalog() {
  for (const technician of demoTechnicians) {
    await query(
      `
        INSERT INTO technicians (id, name, email, phone, role, specialty, active)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        ON CONFLICT (id) DO NOTHING
      `,
      technician
    );
  }

  for (const client of demoClients) {
    await query(
      `
        INSERT INTO clients (
          id, trade_name, legal_name, document, phone, email, address, contact_name, active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
        ON CONFLICT (id) DO NOTHING
      `,
      client
    );
  }

  for (const [technicianId, clientIds] of Object.entries(technicianClientAccess)) {
    await query(
      "UPDATE technicians SET allowed_client_ids = $2::jsonb WHERE id = $1",
      [technicianId, JSON.stringify(clientIds)]
    );
  }

  for (const product of demoProducts) {
    await query(
      `
        INSERT INTO products (
          id, name, category, brand, model, internal_code, quantity, unit_price, unit, active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
        ON CONFLICT (id) DO NOTHING
      `,
      product
    );
  }

  for (const service of demoServices) {
    await query(
      `
        INSERT INTO service_catalog (id, code, name, category, default_priority, default_value, description, notes, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7, TRUE)
        ON CONFLICT (id) DO NOTHING
      `,
      service
    );
  }

  for (const problemType of demoProblemTypes) {
    await query(
      `
        INSERT INTO problem_types (id, name, category, default_priority, description, active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        ON CONFLICT (id) DO NOTHING
      `,
      problemType
    );
  }
}
