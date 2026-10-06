import { screen } from "@testing-library/react";

// Telas e modais exercitados pelos testes de acessibilidade (axe) e de contraste. Cada cenario
// abre a rota, espera os dados mockados (marcador de texto) e, se houver, abre um modal.
export const viewScenarios = [
  { name: "dashboard", path: "/", marker: null },
  { name: "avisos", path: "/avisos", marker: "Sugestões de OS" },
  { name: "ordens de serviço", path: "/ordens-de-servico", marker: "OS-001" },
  { name: "agenda", path: "/agenda", marker: "Planejamento operacional" },
  { name: "peças", path: "/pecas", marker: "Itens rastreados" },
  { name: "inventário", path: "/inventario", marker: "PC-01" }
];

export const modalScenarios = [
  {
    name: "detalhe da OS",
    path: "/ordens-de-servico",
    marker: "OS-001",
    open: async (user) => user.click(screen.getAllByText("OS-001")[0].closest("button"))
  },
  {
    name: "nova OS",
    path: "/ordens-de-servico",
    marker: "OS-001",
    open: async (user) => user.click(screen.getByRole("button", { name: "Nova Ordem de Serviço" }))
  },
  {
    name: "configurações gerais",
    path: "/",
    marker: null,
    open: async (user) => user.click(screen.getByRole("button", { name: /Configurações/ }))
  },
  {
    name: "adicionar widget (dashboard)",
    path: "/",
    marker: null,
    open: async (user) => {
      await user.click(screen.getByRole("button", { name: "Editar dashboard" }));
      await user.click(await screen.findByRole("button", { name: /Adicionar widget/ }));
    }
  },
  {
    name: "configurações de aviso",
    path: "/avisos",
    marker: "Sugestões de OS",
    open: async (user) => user.click(screen.getByRole("button", { name: "Configurações de aviso" }))
  },
  {
    name: "detalhe do aviso",
    path: "/avisos",
    marker: "Sugestões de OS",
    open: async (user) => user.click(screen.getAllByRole("button", { name: "Ver detalhes do aviso" })[0])
  },
  {
    name: "ficha da máquina",
    path: "/inventario",
    marker: "PC-01",
    open: async (user) => user.click(screen.getAllByRole("button", { name: "Ficha" })[0])
  },
  {
    name: "mover máquina",
    path: "/inventario",
    marker: "PC-01",
    open: null
  }
].filter((scenario) => scenario.open);
