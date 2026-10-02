import { render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { describe, expect, it, vi } from "vitest";
import { InventoryProvider, LayoutProvider } from "../context/workspaceContexts.js";
import InventoryDragLayer from "./InventoryDragLayer.jsx";

// O DragOverlay real so renderiza durante um arraste de verdade; aqui ele
// apenas repassa os filhos para podermos inspecionar o que a camada monta.
vi.mock("@dnd-kit/core", async (importOriginal) => ({
  ...(await importOriginal()),
  DragOverlay: ({ children }) => <div data-testid="drag-overlay">{children}</div>
}));
vi.mock("../../components/inventory/AssetDragCompactOverlay.jsx", () => ({
  default: (props) => (
    <div data-testid="asset-overlay">
      {props.asset.name}|{props.alias}|{String(props.selected)}|{props.selectionCount}|{props.segmentColor}
    </div>
  )
}));
vi.mock("../../components/inventory/SegmentDragOverlay.jsx", () => ({
  default: (props) => (
    <div data-testid="segment-overlay">
      {props.segment.name}|{props.count}|{props.groupName}
    </div>
  )
}));
vi.mock("../../components/inventory/BulkAssetLabelPrint.jsx", () => ({
  default: (props) => <div data-testid="bulk-print">{props.assets.length}|{Object.keys(props.aliases).join(",")}</div>
}));

function renderLayer({ drag = {}, selectedIds = [] } = {}) {
  const inventory = {
    model: { activeSegments: [{ id: "s1", color: "#123456" }] },
    persistence: { machineAliases: { d1: "Caixa 1" } },
    selection: { selectedAssetIds: new Set(selectedIds) }
  };
  const layout = {
    bulkPrint: { bulkPrintAssets: [{ id: "d1" }], handleBulkPrintReady: vi.fn() },
    drag: {
      activeDragMachine: null,
      activeDragSegment: null,
      activeDragSegmentCount: 0,
      activeDragSegmentGroupName: "",
      ...drag
    }
  };
  return render(
    <DndContext>
      <InventoryProvider value={inventory}>
        <LayoutProvider value={layout}>
          <InventoryDragLayer />
        </LayoutProvider>
      </InventoryProvider>
    </DndContext>
  );
}

describe("InventoryDragLayer", () => {
  it("sem arraste mostra so a area de impressao em lote", () => {
    renderLayer();
    expect(screen.queryByTestId("asset-overlay")).not.toBeInTheDocument();
    expect(screen.queryByTestId("segment-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("bulk-print")).toHaveTextContent("1|d1");
  });

  it("arrastando um ativo mostra o overlay com apelido, cor do segmento e quantidade selecionada", () => {
    renderLayer({
      drag: { activeDragMachine: { id: "d1", name: "PC-01", segmentId: "s1" } },
      selectedIds: ["d1", "d2"]
    });
    expect(screen.getByTestId("asset-overlay")).toHaveTextContent("PC-01|Caixa 1|true|2|#123456");
    expect(screen.queryByTestId("segment-overlay")).not.toBeInTheDocument();
  });

  it("ativo arrastado fora da selecao aparece sem contagem", () => {
    renderLayer({ drag: { activeDragMachine: { id: "d9", name: "Solto", segmentId: "x" } }, selectedIds: ["d1"] });
    expect(screen.getByTestId("asset-overlay")).toHaveTextContent("Solto||false|0|");
  });

  it("arrastando um segmento mostra o overlay com a contagem e o grupo", () => {
    renderLayer({
      drag: {
        activeDragSegment: { id: "s1", name: "Redes" },
        activeDragSegmentCount: 3,
        activeDragSegmentGroupName: "Andar 1"
      }
    });
    expect(screen.getByTestId("segment-overlay")).toHaveTextContent("Redes|3|Andar 1");
  });
});
