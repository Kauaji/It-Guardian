import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api.js";
import PartsInventoryPage from "./PartsInventoryPage.jsx";
import { devices, lastQuery, loaded, part, renderPage, resetApiMocks } from "./partsTestSupport.jsx";

vi.mock("../../api.js", async () => import("./partsApiMock.js"));

describe("PartsInventoryPage (kits por computador)", () => {
  beforeEach(resetApiMocks);

  describe("kits por computador", () => {
    const inUse = [
      part("k1", { name: "Ryzen", category: "Processador", inventoryState: "in_use", sourceAssetId: "asset-1" }),
      part("k2", { name: "SSD 1", category: "Armazenamento", inventoryState: "in_use", assignedAssetId: "asset-2" })
    ];
    const tabs = [
      { id: "tab-1", name: "Matriz", color: "#111111" },
      { id: "tab-2", name: "", color: "" }
    ];
    const hierarchy = {
      tabs,
      groups: [{ id: "g1", name: "Administrativo", tabId: "tab-1", segmentIds: ["seg-1"] }],
      segments: [{ id: "seg-1", name: "Financeiro", groupId: "g1", tabId: "tab-1", color: "" }]
    };

    it("alterna visões, reinicia filtros e consulta apenas peças em uso", async () => {
      api.fetchPartsInventory.mockResolvedValue({ parts: inUse });
      renderPage();
      await loaded();
      const views = document.querySelector(".parts-view-tabs");
      expect(within(views).getByRole("button", { name: /Peças por tipo/ })).toHaveClass("active");
      fireEvent.click(within(views).getByRole("button", { name: /Kits por computador/ }));
      await waitFor(() => expect(lastQuery().inventoryState).toBe("in_use"));
      expect(within(views).getByRole("button", { name: /Kits por computador/ })).toHaveClass("active");
      fireEvent.click(within(views).getByRole("button", { name: /Peças por tipo/ }));
      await waitFor(() => expect(lastQuery().inventoryState).toBe(""));
    });

    it("mostra mensagem quando não há kits", async () => {
      api.fetchPartsInventory.mockResolvedValue({ parts: [part("a")] });
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: /Kits por computador/ }));
      expect(await screen.findByText("Nenhum kit encontrado")).toBeInTheDocument();
    });

    it("expande kit, abre o ativo e recolhe", async () => {
      api.fetchPartsInventory.mockResolvedValue({ parts: inUse });
      const { onOpenAsset } = renderPage();
      fireEvent.click(await screen.findByRole("button", { name: /Kits por computador/ }));
      const kit = await screen.findByRole("button", { name: /PC Financeiro/ });
      expect(kit).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(kit);
      expect(kit).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("1 componente(s) físico(s)", { exact: false })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Abrir ativo/ }));
      expect(onOpenAsset).toHaveBeenCalledWith("asset-1");
      fireEvent.click(kit);
      expect(kit).toHaveAttribute("aria-expanded", "false");
    });

    it("organiza por aba/grupo/segmento, troca de aba e mostra vazio do ambiente", async () => {
      api.fetchPartsInventory.mockResolvedValue({
        parts: [{ ...inUse[0] }, part("k3", { name: "RAM", category: "Memória", inventoryState: "in_use", sourceAssetId: "asset-3" })]
      });
      renderPage({
        ...hierarchy,
        devices: [
          { id: "asset-1", alias: "PC Financeiro", tabId: "tab-1", segmentId: "seg-1", segmentName: "Financeiro" },
          { id: "asset-3", alias: "PC Outro", tabId: "tab-2", segmentId: "seg-x", segmentName: "Outros" }
        ]
      });
      fireEvent.click(await screen.findByRole("button", { name: /Kits por computador/ }));
      const nav = await screen.findByRole("navigation", { name: "Ambientes dos kits" });
      expect(within(nav).getByRole("button", { name: "Matriz" })).toHaveClass("active");
      expect(within(nav).getByRole("button", { name: "Novo ambiente" })).toBeInTheDocument();
      expect(screen.getByText("Administrativo")).toBeInTheDocument();
      expect(screen.getByText("1 máquina(s)")).toBeInTheDocument();
      expect(screen.getByText("1 máquina")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /PC Financeiro/ }));
      fireEvent.click(within(nav).getByRole("button", { name: "Novo ambiente" }));
      expect(within(nav).getByRole("button", { name: "Novo ambiente" })).toHaveClass("active");
      expect(screen.getByRole("button", { name: /PC Outro/ })).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("button", { name: /PC Financeiro/ })).not.toBeInTheDocument();
    });

    it("peça instalada leva ao kit, seleciona a aba e foca o cartão", async () => {
      api.fetchPartsInventory.mockResolvedValue({
        parts: [
          part("k9", { name: "Placa", category: "Placa-mãe", inventoryState: "in_use", assignedAssetId: "asset-1" }),
          part("k8", { name: "Fonte", category: "Fonte", inventoryState: "in_use", assignedAssetId: "asset-9" })
        ]
      });
      renderPage({ ...hierarchy });
      fireEvent.click((await screen.findByText("Placa")).closest("button"));
      const focused = await waitFor(() => {
        const el = document.querySelector(".computer-kit-card.is-focused");
        expect(el).toBeInTheDocument();
        return el;
      });
      expect(focused).toHaveAttribute("tabindex", "-1");
      await waitFor(() => expect(focused).toHaveFocus());
      expect(focused).toHaveClass("is-expanded");
      expect(lastQuery().inventoryState).toBe("in_use");
      expect(screen.getByRole("button", { name: "Matriz" })).toHaveClass("active");
    });

    it("peça com ativo desconhecido abre kit sem trocar de aba; sem ativo abre inspetor", async () => {
      api.fetchPartsInventory.mockResolvedValue({
        parts: [part("x", { name: "Órfã", inventoryState: "in_use" })]
      });
      api.fetchPartInventoryItem.mockResolvedValue({ part: part("x", { name: "Órfã", inventoryState: "in_use" }) });
      renderPage({ ...hierarchy });
      fireEvent.click((await screen.findByText("Órfã")).closest("button"));
      expect(await screen.findByRole("heading", { name: "Órfã" })).toBeInTheDocument();
      expect(api.fetchPartInventoryItem).toHaveBeenCalledWith("tok", "x");
    });

    it("corrige a aba ativa quando as abas mudam", async () => {
      api.fetchPartsInventory.mockResolvedValue({ parts: inUse });
      const { rerender } = renderPage({ ...hierarchy });
      fireEvent.click(await screen.findByRole("button", { name: /Kits por computador/ }));
      fireEvent.click(await screen.findByRole("button", { name: "Novo ambiente" }));
      rerender(
        <PartsInventoryPage
          token="tok"
          devices={devices}
          permissions={{}}
          tabs={[{ id: "tab-9", name: "Nova" }]}
          groups={[]}
          segments={[]}
        />
      );
      expect(await screen.findByRole("button", { name: "Nova" })).toHaveClass("active");
      rerender(<PartsInventoryPage token="tok" devices={devices} permissions={{}} tabs={[]} groups={[]} segments={[]} />);
      await waitFor(() => expect(screen.queryByRole("navigation", { name: "Ambientes dos kits" })).not.toBeInTheDocument());
    });
  });
});
