// Quem pode LER os catalogos de apoio (clientes, produtos, servicos, tipos de
// problema, regras de prioridade, setores): quem trabalha com Ordens de
// Servico. Antes, qualquer usuario autenticado -- mesmo sem nenhuma
// permissao -- lia a lista de clientes (documento, telefone, endereco).
export const serviceOrderCatalogReaders = [
  "service_orders.view",
  "service_orders.create",
  "service_orders.edit",
  "service_orders.assign",
  "service_orders.attendance",
  "service_orders.parts",
  "service_orders.settings",
  "service_orders.create_from_alert"
];
