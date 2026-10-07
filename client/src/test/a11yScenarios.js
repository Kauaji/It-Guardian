import { screen, within } from "@testing-library/react";

// Telas e modais exercitados pelos testes de acessibilidade (axe) e de contraste. Cada cenario
// abre a rota, espera os dados mockados (marcador de texto) e, se houver, abre um modal.
export const viewScenarios = [
  { name: "dashboard (com widgets)", path: "/", marker: "Disponibilidade de Ativos" },
  { name: "avisos", path: "/avisos", marker: "Sugestões de OS" },
  { name: "ordens de serviço", path: "/ordens-de-servico", marker: "OS-001" },
  { name: "agenda (com eventos)", path: "/agenda", marker: "Visita urgente" },
  { name: "peças", path: "/pecas", marker: "SSD NVMe" },
  { name: "inventário", path: "/inventario", marker: "PC-01" }
];

const orderTab = (label) => ({
  name: `detalhe da OS: aba ${label}`,
  path: "/ordens-de-servico",
  marker: "OS-001",
  open: async (user) => {
    await user.click(screen.getAllByText("OS-001")[0].closest("button"));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: label }));
  }
});

const alertTab = (label) => ({
  name: `avisos: aba ${label}`,
  path: "/avisos",
  marker: "Sugestões de OS",
  // abas internas nao sao dialogos: o cenario abre a aba e depois o detalhe do primeiro item, se houver
  open: async (user) => user.click(screen.getByRole("button", { name: label })),
  noDialog: true
});

export const modalScenarios = [
  ...["Atendimento", "Máquina", "SLA", "Agenda", "Checklist", "Scripts", "Anexos", "Avaliação", "Histórico"].map(orderTab),
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
    marker: "Disponibilidade de Ativos",
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
    name: "novo agendamento (agenda)",
    path: "/agenda",
    marker: "Visita urgente",
    open: async (user) => user.click(screen.getAllByRole("button", { name: /^Novo agendamento em/ })[10])
  },
  {
    name: "editar agendamento (agenda)",
    path: "/agenda",
    marker: "Visita urgente",
    open: async (user) => user.click(screen.getAllByText("Visita urgente")[0].closest("button"))
  },
  {
    name: "peças: kits por computador",
    path: "/pecas",
    marker: "SSD NVMe",
    open: async (user) => {
      await user.click(screen.getByRole("button", { name: /kits por computador/i }));
      await user.click(await screen.findByRole("button", { name: /PC-01/i }));
      await screen.findAllByText("Ryzen 5");
      await user.click(screen.getByRole("button", { name: /Cadastrar peça/i }));
    }
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

// Abas internas da Central de Avisos (sem dialogo).
export const tabScenarios = ["Preventivas"].map(alertTab);
