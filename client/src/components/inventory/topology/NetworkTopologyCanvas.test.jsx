import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NetworkTopologyCanvas from "./NetworkTopologyCanvas.jsx";

const nodes = [
  { id: "node-a", assetId: "asset-a", nodeType: "asset", x: 800, y: 500 },
  { id: "node-b", assetId: "asset-b", nodeType: "asset", x: 1050, y: 500 }
];
const devicesById = new Map([
  ["asset-a", { id: "asset-a", name: "Servidor Alfa", type: "server", status: "online" }],
  ["asset-b", { id: "asset-b", name: "Servidor Beta", type: "server", status: "online" }]
]);
const groupNode = { id: "node-group", refId: "group-infra", nodeType: "group", x: 1200, y: 800 };
const segmentNode = { id: "node-segment", refId: "segment-servers", nodeType: "segment", x: 1400, y: 800 };
const clusterProps = {
  nodes: [...nodes, groupNode, segmentNode],
  clusterSummaryByRefId: new Map([
    ["group-infra", { name: "Infraestrutura", status: "online", segmentCount: 1, deviceCount: 2 }],
    ["segment-servers", { name: "Servidores", status: "online", deviceCount: 2 }]
  ])
};

function readViewBox(svg) {
  const [x, y, width, height] = svg.getAttribute("viewBox").split(" ").map(Number);
  return { x, y, width, height };
}

function pointer(target, type, options = {}) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: 100,
    clientY: 100,
    ...options
  });
  Object.defineProperties(event, {
    pointerId: { value: options.pointerId ?? 1 },
    pointerType: { value: "mouse" },
    isPrimary: { value: options.isPrimary ?? true }
  });
  fireEvent(target, event);
}

function renderCanvas(overrides = {}) {
  const props = {
    nodes,
    links: [],
    devicesById,
    segmentNameById: new Map(),
    clusterSummaryByRefId: new Map(),
    editMode: false,
    onNodeActivate: vi.fn(),
    onNodeDrag: vi.fn(),
    onNodeDragEnd: vi.fn(),
    onNodeOpen: vi.fn(),
    onSelectLink: vi.fn(),
    onCanvasBackgroundClick: vi.fn(),
    ...overrides
  };
  const result = render(<NetworkTopologyCanvas {...props} />);
  const svg = result.container.querySelector(".network-topology-canvas");
  Object.defineProperties(svg, {
    clientWidth: { value: 1600 },
    clientHeight: { value: 1000 }
  });
  svg.createSVGPoint = () => ({
    x: 0,
    y: 0,
    matrixTransform(matrix) {
      return { x: this.x * matrix.a + matrix.e, y: this.y * matrix.d + matrix.f };
    }
  });
  svg.getScreenCTM = () => {
    const box = readViewBox(svg);
    return { inverse: () => ({ a: box.width / 1600, d: box.height / 1000, e: box.x, f: box.y }) };
  };
  return { ...result, props, svg };
}

describe("NetworkTopologyCanvas", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("arrasta itens automáticos junto dos nós salvos sem precisar adicioná-los", () => {
    const { svg, props } = renderCanvas({ editMode: true, nodes: [{ ...nodes[0], automatic: true }, nodes[1]] });
    pointer(screen.getByRole("button", { name: /^Servidor Alfa,/ }), "pointerdown");
    pointer(svg, "pointermove", { clientX: 160 });
    pointer(svg, "pointerup", { clientX: 160 });
    expect(props.onNodeDrag).toHaveBeenCalledOnce();
    expect(props.onNodeDragEnd).toHaveBeenCalledExactlyOnceWith("node-a");
    expect(props.onNodeActivate).not.toHaveBeenCalled();
  });

  it("mostra a volta acima do canvas sem selecionar ou arrastar um item", () => {
    const onNavigateBack = vi.fn();
    const { container, props } = renderCanvas({ onNavigateBack, backLabel: "Voltar para Infraestrutura" });
    const back = screen.getByRole("button", { name: "Voltar para Infraestrutura" });
    expect(container.querySelector(".network-topology-canvas-wrap")).toContainElement(back);
    fireEvent.click(back);
    expect(onNavigateBack).toHaveBeenCalledOnce();
    expect(props.onCanvasBackgroundClick).not.toHaveBeenCalled();
    expect(props.onNodeActivate).not.toHaveBeenCalled();
    expect(props.onNodeDrag).not.toHaveBeenCalled();
  });

  it("não mostra voltar na raiz e mantém a volta em mapas vazios", () => {
    const { rerender, props } = renderCanvas();
    expect(screen.queryByRole("button", { name: /^Voltar/ })).not.toBeInTheDocument();
    rerender(<NetworkTopologyCanvas {...props} nodes={[]} onNavigateBack={vi.fn()} backLabel="Voltar para Grupo A" emptyState={<p>Nenhum ativo</p>} />);
    expect(screen.getByRole("button", { name: "Voltar para Grupo A" })).toBeVisible();
    expect(screen.getByText("Nenhum ativo")).toBeVisible();
  });

  it("não distingue o item automático com avisos de prévia", () => {
    renderCanvas({ nodes: [{ ...nodes[0], automatic: true }] });
    expect(screen.getByRole("button", { name: "Servidor Alfa, ver ativo" })).not.toHaveClass("is-preview");
    expect(screen.queryByText(/não salva/i)).not.toBeInTheDocument();
  });

  it("aplica zoom suave ao redor do cursor sem rolar a página", () => {
    const { svg } = renderCanvas();
    const initial = readViewBox(svg);
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 100,
      deltaMode: 0,
      clientX: 400,
      clientY: 250
    });
    fireEvent(svg, event);
    const next = readViewBox(svg);
    const anchor = { x: initial.x + initial.width / 4, y: initial.y + initial.height / 4 };
    expect(event.defaultPrevented).toBe(true);
    expect(next.width / initial.width).toBeCloseTo(Math.exp(0.05));
    expect((anchor.x - next.x) / next.width).toBeCloseTo(0.25);
    expect((anchor.y - next.y) / next.height).toBeCloseTo(0.25);
  });

  it("instala um listener wheel não passivo e o remove ao desmontar", () => {
    const addListener = vi.spyOn(EventTarget.prototype, "addEventListener");
    const removeListener = vi.spyOn(EventTarget.prototype, "removeEventListener");
    const { svg, unmount } = renderCanvas();
    const listenerIndex = addListener.mock.calls.findIndex(([type, , options], index) => (
      type === "wheel" && options?.passive === false && addListener.mock.contexts[index] === svg
    ));
    expect(listenerIndex).toBeGreaterThanOrEqual(0);
    const callback = addListener.mock.calls[listenerIndex][1];
    unmount();
    expect(removeListener).toHaveBeenCalledWith("wheel", callback);
  });

  it("distingue clique de pan e não limpa a seleção depois de mover a câmera", () => {
    const { svg, props } = renderCanvas();
    const initial = readViewBox(svg);
    pointer(svg, "pointerdown");
    pointer(svg, "pointermove", { clientX: 130 });
    const first = readViewBox(svg);
    expect(first.x).toBeCloseTo(initial.x - 30 * initial.width / 1600);
    pointer(svg, "pointermove", { clientX: 160 });
    const second = readViewBox(svg);
    expect(second.x).toBeCloseTo(initial.x - 60 * initial.width / 1600);
    pointer(svg, "pointerup", { clientX: 160 });
    expect(props.onCanvasBackgroundClick).not.toHaveBeenCalled();
    expect(props.onNodeActivate).not.toHaveBeenCalled();
    pointer(svg, "pointerdown");
    pointer(svg, "pointermove", { clientX: 102 });
    pointer(svg, "pointerup", { clientX: 102 });
    expect(props.onCanvasBackgroundClick).toHaveBeenCalledTimes(1);
  });

  it("seleciona um nó no clique sem mover a câmera ou abrir o mapa", () => {
    const { svg, props } = renderCanvas();
    const initial = readViewBox(svg);
    const node = screen.getByRole("button", { name: /Servidor Alfa/ });
    pointer(node, "pointerdown");
    pointer(node, "pointerup");
    expect(props.onNodeActivate).toHaveBeenCalledExactlyOnceWith("node-a");
    expect(props.onNodeDrag).not.toHaveBeenCalled();
    expect(props.onNodeOpen).not.toHaveBeenCalled();
    expect(props.onCanvasBackgroundClick).not.toHaveBeenCalled();
    expect(readViewBox(svg)).toEqual(initial);
  });

  it("no modo de edição, seleciona um clique e só arrasta além do limiar em pixels", () => {
    const { svg, props } = renderCanvas({ editMode: true });
    const initial = readViewBox(svg);
    const node = screen.getByRole("button", { name: /Servidor Alfa/ });
    pointer(node, "pointerdown");
    pointer(svg, "pointermove", { clientX: 102 });
    pointer(svg, "pointerup", { clientX: 102 });
    expect(props.onNodeActivate).toHaveBeenCalledExactlyOnceWith("node-a");
    expect(props.onNodeDrag).not.toHaveBeenCalled();
    props.onNodeActivate.mockClear();
    pointer(node, "pointerdown");
    pointer(svg, "pointermove", { clientX: 160 });
    expect(props.onNodeDrag).toHaveBeenLastCalledWith("node-a", 800 + 60 * initial.width / 1600, 500);
    pointer(svg, "pointerup", { clientX: 160 });
    expect(props.onNodeDragEnd).toHaveBeenCalledExactlyOnceWith("node-a");
    expect(props.onNodeActivate).not.toHaveBeenCalled();
    expect(props.onCanvasBackgroundClick).not.toHaveBeenCalled();
  });

  it("ignora botões secundários e ponteiros que não iniciaram o gesto", () => {
    const { svg, props } = renderCanvas({ editMode: true });
    const initial = readViewBox(svg);
    const node = screen.getByRole("button", { name: /Servidor Alfa/ });
    pointer(node, "pointerdown", { button: 2 });
    pointer(svg, "pointermove", { clientX: 170 });
    pointer(svg, "pointerup");
    pointer(svg, "pointerdown", { isPrimary: false, pointerId: 2 });
    pointer(svg, "pointermove", { clientX: 170, pointerId: 2 });
    pointer(svg, "pointerup", { pointerId: 2 });
    expect(readViewBox(svg)).toEqual(initial);
    expect(props.onNodeActivate).not.toHaveBeenCalled();
    expect(props.onNodeDrag).not.toHaveBeenCalled();
    expect(props.onCanvasBackgroundClick).not.toHaveBeenCalled();
    pointer(svg, "pointerdown");
    pointer(svg, "pointermove", { clientX: 170, pointerId: 2 });
    pointer(svg, "pointerup", { pointerId: 2 });
    expect(readViewBox(svg)).toEqual(initial);
    pointer(svg, "pointerup");
    expect(props.onCanvasBackgroundClick).toHaveBeenCalledTimes(1);
  });

  it("cancela um gesto sem ativar nós e restaura uma posição arrastada", () => {
    const { svg, props } = renderCanvas({ editMode: true });
    const node = screen.getByRole("button", { name: /Servidor Alfa/ });
    pointer(node, "pointerdown");
    pointer(svg, "pointermove", { clientX: 170 });
    pointer(svg, "pointercancel");
    expect(props.onNodeDrag).toHaveBeenLastCalledWith("node-a", 800, 500);
    pointer(svg, "pointerup");
    expect(props.onNodeActivate).not.toHaveBeenCalled();
    expect(props.onNodeDragEnd).not.toHaveBeenCalled();
    pointer(svg, "pointerdown");
    pointer(svg, "pointercancel");
    pointer(svg, "pointerup");
    expect(props.onCanvasBackgroundClick).not.toHaveBeenCalled();
  });

  it("mantém a captura fora do canvas até soltar o ponteiro", () => {
    const { svg, props } = renderCanvas();
    const captured = new Set();
    svg.setPointerCapture = vi.fn((id) => captured.add(id));
    svg.hasPointerCapture = vi.fn((id) => captured.has(id));
    svg.releasePointerCapture = vi.fn((id) => captured.delete(id));
    pointer(svg, "pointerdown");
    pointer(svg, "pointermove", { clientX: 170 });
    pointer(svg, "pointerout", { relatedTarget: document.body });
    expect(svg.setPointerCapture).toHaveBeenCalledWith(1);
    expect(svg.releasePointerCapture).not.toHaveBeenCalled();
    pointer(svg, "pointerup", { clientX: 170 });
    expect(svg.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(props.onCanvasBackgroundClick).not.toHaveBeenCalled();
  });

  it("não muda o zoom durante um arraste ativo", () => {
    const { svg } = renderCanvas();
    const initial = readViewBox(svg);
    pointer(svg, "pointerdown");
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 100 });
    fireEvent(svg, event);
    expect(event.defaultPrevented).toBe(true);
    expect(readViewBox(svg)).toEqual(initial);
  });

  it("no modo de conexão permite escolher nós sem arrastá-los", () => {
    const { svg, props } = renderCanvas({ editMode: true, linkDraftActive: true });
    const node = screen.getByRole("button", { name: /Servidor Alfa/ });
    pointer(node, "pointerdown");
    pointer(svg, "pointermove", { clientX: 170 });
    pointer(svg, "pointerup", { clientX: 170 });
    expect(props.onNodeActivate).toHaveBeenCalledExactlyOnceWith("node-a");
    expect(props.onNodeDrag).not.toHaveBeenCalled();
    expect(props.onNodeDragEnd).not.toHaveBeenCalled();
    expect(node).not.toHaveClass("is-editable");
  });

  it("mostra uma linha guia até o ponteiro sem criar conexões persistidas", () => {
    const { svg, props, rerender } = renderCanvas({
      editMode: true,
      linkDraftActive: true,
      linkDraftSourceNodeId: "node-a"
    });
    expect(svg.querySelector(".network-topology-link-draft")).not.toBeInTheDocument();
    pointer(svg, "pointermove", { clientX: 600, clientY: 400 });
    const line = svg.querySelector(".network-topology-link-draft");
    const box = readViewBox(svg);
    expect(line).toHaveAttribute("x1", "800");
    expect(line).toHaveAttribute("y1", "500");
    expect(Number(line.getAttribute("x2"))).toBeCloseTo(box.x + 600 * box.width / 1600);
    expect(Number(line.getAttribute("y2"))).toBeCloseTo(box.y + 400 * box.height / 1000);
    expect(line).toHaveAttribute("stroke-dasharray", "6 5");
    expect(line).toHaveAttribute("pointer-events", "none");
    expect(svg.querySelectorAll(".network-topology-link")).toHaveLength(0);
    expect(props.links).toEqual([]);
    expect(props.onSelectLink).not.toHaveBeenCalled();
    expect(props.onNodeActivate).not.toHaveBeenCalled();
    rerender(<NetworkTopologyCanvas {...props} linkDraftActive={false} />);
    expect(svg.querySelector(".network-topology-link-draft")).not.toBeInTheDocument();
  });

  it("não reaproveita a guia de outra origem e a oculta ao sair do mapa", () => {
    const { svg, props, rerender } = renderCanvas({ linkDraftActive: true, linkDraftSourceNodeId: "node-a" });
    pointer(svg, "pointermove");
    expect(svg.querySelector(".network-topology-link-draft")).toBeInTheDocument();
    rerender(<NetworkTopologyCanvas {...props} linkDraftSourceNodeId="node-b" />);
    expect(svg.querySelector(".network-topology-link-draft")).not.toBeInTheDocument();
    pointer(svg, "pointermove");
    expect(svg.querySelector(".network-topology-link-draft")).toHaveAttribute("x1", "1050");
    pointer(svg, "pointerout", { relatedTarget: document.body });
    expect(svg.querySelector(".network-topology-link-draft")).not.toBeInTheDocument();
  });

  it("mantém conexões existentes selecionáveis sem tratá-las como clique no fundo", () => {
    const { svg, props } = renderCanvas({
      links: [{ id: "link-ab", sourceAssetId: "asset-a", targetAssetId: "asset-b", type: "ethernet" }]
    });
    const link = svg.querySelector(".network-topology-link");
    pointer(link, "pointerdown");
    pointer(link, "pointerup");
    fireEvent.click(link);
    expect(props.onSelectLink).toHaveBeenCalledExactlyOnceWith("link-ab");
    expect(props.onCanvasBackgroundClick).not.toHaveBeenCalled();
  });

  it("resolve conexões reais por tipo e ID mesmo entre nós automáticos com referências iguais", () => {
    const { svg } = renderCanvas({
      nodes: [
        { id: "inventory-default:asset:shared", assetId: "shared", nodeType: "asset", x: 800, y: 500, automatic: true },
        { id: "inventory-default:group:shared", refId: "shared", nodeType: "group", x: 1050, y: 600, automatic: true }
      ],
      devicesById: new Map([["shared", { name: "Servidor Alfa", type: "server", status: "online" }]]),
      clusterSummaryByRefId: new Map([["shared", { name: "Infraestrutura", status: "online", segmentCount: 1, deviceCount: 1 }]]),
      links: [{ id: "link-real", sourceType: "asset", sourceAssetId: "shared", targetType: "group", targetAssetId: "shared" }]
    });
    const line = svg.querySelector(".network-topology-link line");
    expect(line).toHaveAttribute("x1", "800");
    expect(line).toHaveAttribute("y1", "500");
    expect(line).toHaveAttribute("x2", "1050");
    expect(line).toHaveAttribute("y2", "600");
  });

  it.each([
    ["grupo", /Infraestrutura/, groupNode.id, false],
    ["segmento", /Servidores,/, segmentNode.id, false],
    ["grupo em edição", /Infraestrutura/, groupNode.id, true],
    ["segmento em edição", /Servidores,/, segmentNode.id, true]
  ])("aguarda 300 ms depois de soltar o clique no %s antes de mostrar o inspector", (_label, name, nodeId, editMode) => {
    vi.useFakeTimers();
    const { svg, props } = renderCanvas({ ...clusterProps, editMode });
    pointer(screen.getByRole("button", { name }), "pointerdown");
    act(() => vi.advanceTimersByTime(400));
    expect(props.onNodeActivate).not.toHaveBeenCalled();
    pointer(svg, "pointerup");
    act(() => vi.advanceTimersByTime(299));
    expect(props.onNodeActivate).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(props.onNodeActivate).toHaveBeenCalledExactlyOnceWith(nodeId);
    expect(props.onNodeOpen).not.toHaveBeenCalled();
  });

  it.each([false, true])("cancela a seleção pendente ao abrir um grupo com duplo clique (edição: %s)", (editMode) => {
    vi.useFakeTimers();
    const { svg, props } = renderCanvas({ ...clusterProps, editMode });
    const group = screen.getByRole("button", { name: /Infraestrutura/ });
    pointer(group, "pointerdown");
    pointer(svg, "pointerup");
    act(() => vi.advanceTimersByTime(160));
    pointer(group, "pointerdown");
    pointer(svg, "pointerup");
    fireEvent.doubleClick(group);
    act(() => vi.runAllTimers());
    expect(props.onNodeOpen).toHaveBeenCalledExactlyOnceWith(groupNode);
    expect(props.onNodeActivate).not.toHaveBeenCalled();
    expect(props.onNodeDrag).not.toHaveBeenCalled();
  });

  it("cancela uma seleção anterior quando o próximo gesto é arrastar o grupo", () => {
    vi.useFakeTimers();
    const { svg, props } = renderCanvas({ ...clusterProps, editMode: true });
    const group = screen.getByRole("button", { name: /Infraestrutura/ });
    pointer(group, "pointerdown");
    pointer(svg, "pointerup");
    act(() => vi.advanceTimersByTime(100));
    pointer(group, "pointerdown");
    pointer(svg, "pointermove", { clientX: 160 });
    pointer(svg, "pointerup", { clientX: 160 });
    act(() => vi.runAllTimers());
    expect(props.onNodeDrag).toHaveBeenCalledTimes(1);
    expect(props.onNodeDragEnd).toHaveBeenCalledExactlyOnceWith(groupNode.id);
    expect(props.onNodeActivate).not.toHaveBeenCalled();
  });

  it("não confunde um gesto de arrastar um grupo em visualização com clique", () => {
    vi.useFakeTimers();
    const { svg, props } = renderCanvas(clusterProps);
    pointer(screen.getByRole("button", { name: /Infraestrutura/ }), "pointerdown");
    pointer(svg, "pointermove", { clientX: 160 });
    pointer(svg, "pointerup", { clientX: 160 });
    act(() => vi.runAllTimers());
    expect(props.onNodeActivate).not.toHaveBeenCalled();
    expect(props.onNodeDrag).not.toHaveBeenCalled();
  });

  it.each(["asset", "cluster", "background", "link"])("descarta o clique pendente ao selecionar outro item: %s", (target) => {
    vi.useFakeTimers();
    const { svg, props } = renderCanvas({
      ...clusterProps,
      links: [{ id: "link-ab", sourceAssetId: "asset-a", targetAssetId: "asset-b" }]
    });
    pointer(screen.getByRole("button", { name: /Infraestrutura/ }), "pointerdown");
    pointer(svg, "pointerup");
    act(() => vi.advanceTimersByTime(100));
    if (target === "asset") {
      pointer(screen.getByRole("button", { name: /^Servidor Alfa,/ }), "pointerdown");
      pointer(svg, "pointerup");
    } else if (target === "cluster") {
      pointer(screen.getByRole("button", { name: /Servidores,/ }), "pointerdown");
      pointer(svg, "pointerup");
    } else if (target === "background") {
      pointer(svg, "pointerdown");
      pointer(svg, "pointerup");
    } else {
      const link = svg.querySelector(".network-topology-link");
      pointer(link, "pointerdown");
      pointer(link, "pointerup");
      fireEvent.click(link);
    }
    act(() => vi.runAllTimers());
    expect(props.onNodeActivate).not.toHaveBeenCalledWith(groupNode.id);
    if (target === "asset") expect(props.onNodeActivate).toHaveBeenCalledExactlyOnceWith("node-a");
    if (target === "cluster") expect(props.onNodeActivate).toHaveBeenCalledExactlyOnceWith(segmentNode.id);
    if (target === "background") expect(props.onCanvasBackgroundClick).toHaveBeenCalledTimes(1);
    if (target === "link") expect(props.onSelectLink).toHaveBeenCalledExactlyOnceWith("link-ab");
  });

  it("não deixa uma seleção atrasada depois de desmontar o canvas", () => {
    vi.useFakeTimers();
    const { svg, props, unmount } = renderCanvas(clusterProps);
    pointer(screen.getByRole("button", { name: /Infraestrutura/ }), "pointerdown");
    pointer(svg, "pointerup");
    unmount();
    act(() => vi.runAllTimers());
    expect(props.onNodeActivate).not.toHaveBeenCalled();
  });

  it("cancela a seleção ao trocar os nós do mapa ou entrar no modo de conexão", () => {
    vi.useFakeTimers();
    const { svg, props, rerender } = renderCanvas(clusterProps);
    const group = screen.getByRole("button", { name: /Infraestrutura/ });
    pointer(group, "pointerdown");
    pointer(svg, "pointerup");
    rerender(<NetworkTopologyCanvas {...props} nodes={nodes} />);
    act(() => vi.runAllTimers());
    expect(props.onNodeActivate).not.toHaveBeenCalled();
    rerender(<NetworkTopologyCanvas {...props} />);
    pointer(screen.getByRole("button", { name: /Infraestrutura/ }), "pointerdown");
    pointer(svg, "pointerup");
    rerender(<NetworkTopologyCanvas {...props} linkDraftActive />);
    act(() => vi.runAllTimers());
    expect(props.onNodeActivate).not.toHaveBeenCalled();
  });

  it("usa o callback atual sem abrir uma seleção com props antigas", () => {
    vi.useFakeTimers();
    const { svg, props, rerender } = renderCanvas(clusterProps);
    const currentActivate = vi.fn();
    pointer(screen.getByRole("button", { name: /Infraestrutura/ }), "pointerdown");
    pointer(svg, "pointerup");
    rerender(<NetworkTopologyCanvas {...props} onNodeActivate={currentActivate} />);
    act(() => vi.runAllTimers());
    expect(props.onNodeActivate).not.toHaveBeenCalled();
    expect(currentActivate).toHaveBeenCalledExactlyOnceWith(groupNode.id);
  });

  it("seleciona grupos imediatamente no modo de conexão sem abrir pelo duplo clique", () => {
    vi.useFakeTimers();
    const { svg, props } = renderCanvas({ ...clusterProps, linkDraftActive: true, editMode: true });
    const group = screen.getByRole("button", { name: /Infraestrutura/ });
    pointer(group, "pointerdown");
    expect(props.onNodeActivate).toHaveBeenCalledExactlyOnceWith(groupNode.id);
    pointer(svg, "pointerup");
    fireEvent.doubleClick(group);
    act(() => vi.runAllTimers());
    expect(props.onNodeActivate).toHaveBeenCalledTimes(1);
    expect(props.onNodeOpen).not.toHaveBeenCalled();
    expect(props.onNodeDrag).not.toHaveBeenCalled();
  });

  it("a seleção pelo teclado é imediata e cancela o clique pendente", () => {
    vi.useFakeTimers();
    const { svg, props } = renderCanvas(clusterProps);
    const group = screen.getByRole("button", { name: /Infraestrutura/ });
    pointer(group, "pointerdown");
    pointer(svg, "pointerup");
    fireEvent.keyDown(group, { key: " " });
    expect(props.onNodeActivate).toHaveBeenCalledExactlyOnceWith(groupNode.id);
    act(() => vi.runAllTimers());
    expect(props.onNodeActivate).toHaveBeenCalledTimes(1);
  });
});
