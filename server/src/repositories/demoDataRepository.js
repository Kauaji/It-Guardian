import { seedDemoCatalog } from "./demo/demoCatalogSeed.js";
import { seedDemoInventory } from "./demo/demoInventorySeed.js";
import { seedDemoServiceOrders } from "./demo/demoServiceOrderSeed.js";

/**
 * Dados operacionais de demonstracao, divididos por dominio de dados
 * (repositories/demo/*): inventario, catalogo (tecnicos, clientes, produtos,
 * servicos, tipos de problema) e ordens de servico. A ordem importa: as OS
 * referenciam clientes, servicos e maquinas criados antes.
 */
export async function seedDemoOperationalData() {
  await seedDemoInventory();
  await seedDemoCatalog();
  await seedDemoServiceOrders();
}
