// Barril de compatibilidade da camada de API do cliente.
//
// A implementacao vive em `client/src/api/*.js`, dividida por dominio. Este arquivo
// preserva o contrato publico (todos os nomes antigos de api.js) e nao deve
// receber logica nova: adicione funcoes no modulo do dominio correspondente.
// O teste `api/exports.test.js` garante que o conjunto de nomes exportados nao muda.
export {
  API_BASE_URL,
  apiFetch,
  isPrivateNetworkUrl,
  resolveApiBaseUrl
} from "./api/http.js";
export * from "./api/auth.js";
export * from "./api/settings.js";
export * from "./api/dashboard.js";
export * from "./api/devices.js";
export * from "./api/segments.js";
export * from "./api/inventoryMaps.js";
export * from "./api/networkTopology.js";
export * from "./api/floorPlans.js";
export * from "./api/alerts.js";
export * from "./api/serviceOrders.js";
export * from "./api/serviceOrderSettings.js";
export * from "./api/serviceOrderSuggestions.js";
export * from "./api/scripts.js";
export * from "./api/preventives.js";
export * from "./api/remoteAssistance.js";
export * from "./api/users.js";
export * from "./api/productKeys.js";
export * from "./api/integrations.js";
export * from "./api/calendar.js";
export * from "./api/parts.js";
export * from "./api/catalog.js";
export * from "./api/public.js";
export * from "./api/realtime.js";
