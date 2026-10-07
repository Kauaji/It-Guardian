import { createSliceContext } from "./createSliceContext.jsx";

// Fatias do workspace autenticado. Cada uma e um objeto coeso produzido por
// useWorkspace e publicado pelo WorkspaceProvider:
//   navigation       visao ativa e acoes de navegacao (URL)
//   data             dados do servidor e setters (useDashboardData)
//   inventory        persistencia local + modelo derivado + filtros + selecao
//   inventoryActions movimentacao, manutencao, Backup, segmentos, grupos, abas, ativos
//   serviceOrders    acoes de Ordem de Servico
//   layout           sidebar, arrastar-e-soltar e impressao em lote
export const [NavigationProvider, useNavigation] = createSliceContext("useNavigation");
export const [DataProvider, useWorkspaceData] = createSliceContext("useWorkspaceData");
export const [InventoryProvider, useInventory] = createSliceContext("useInventory");
export const [InventoryActionsProvider, useInventoryActions] = createSliceContext("useInventoryActions");
export const [ServiceOrderActionsProvider, useServiceOrderActions] = createSliceContext("useServiceOrderActions");
export const [LayoutProvider, useLayout] = createSliceContext("useLayout");
