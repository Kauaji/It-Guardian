import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import NetworkTopologyNode from "./NetworkTopologyNode.jsx";
import NetworkTopologyLink from "./NetworkTopologyLink.jsx";
import { DEFAULT_TOPOLOGY_VIEWBOX, fitTopologyViewBox } from "./networkTopologyViewport.js";

const DEFAULT_VIEWBOX = DEFAULT_TOPOLOGY_VIEWBOX;
const MIN_WIDTH = 400;
const MAX_WIDTH = 6000;
const DRAG_THRESHOLD = 3;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const NetworkTopologyCanvas = forwardRef(function NetworkTopologyCanvas(
  {
    nodes,
    links,
    devicesById,
    segmentNameById,
    clusterSummaryByRefId,
    editMode,
    selectedNodeId,
    selectedLinkId,
    linkDraftSourceNodeId,
    justAddedNodeId,
    justCreatedLinkId,
    onNodeActivate,
    onNodeDrag,
    onNodeDragEnd,
    onNodeOpen,
    onSelectLink,
    onCanvasBackgroundClick
  },
  ref
) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [viewBox, setViewBox] = useState(() => fitTopologyViewBox(nodes));

  const getSvgPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = point.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      centerView: () => setViewBox(DEFAULT_VIEWBOX),
      fitToNodes: () => {
        const svg = svgRef.current;
        const ratio = svg?.clientWidth && svg?.clientHeight ? svg.clientWidth / svg.clientHeight : 1.6;
        setViewBox(fitTopologyViewBox(nodes, ratio));
      }
    }),
    [nodes]
  );

  const handleNodePointerDown = useCallback(
    (nodeId, event) => {
      event.stopPropagation();
      const node = nodes.find((entry) => entry.id === nodeId);
      if (!node) return;

      if (!editMode) {
        onNodeActivate(nodeId);
        return;
      }

      const point = getSvgPoint(event.clientX, event.clientY);
      dragRef.current = {
        type: "node",
        nodeId,
        startSvgX: point.x,
        startSvgY: point.y,
        originX: node.x,
        originY: node.y,
        moved: false
      };
      try {
        event.target.setPointerCapture?.(event.pointerId);
      } catch {
        // Pointer pode ja nao estar ativo (ex.: toque rapido/duplo) - captura e so uma
        // otimizacao para o arrastar continuar recebendo eventos fora do elemento.
      }
    },
    [editMode, getSvgPoint, nodes, onNodeActivate]
  );

  const handleSvgPointerDown = useCallback(
    (event) => {
      if (event.target !== svgRef.current) return;
      const point = getSvgPoint(event.clientX, event.clientY);
      dragRef.current = { type: "pan", startSvgX: point.x, startSvgY: point.y, startViewBox: viewBox };
    },
    [getSvgPoint, viewBox]
  );

  const handlePointerMove = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const point = getSvgPoint(event.clientX, event.clientY);

      if (drag.type === "node") {
        const dx = point.x - drag.startSvgX;
        const dy = point.y - drag.startSvgY;
        if (!drag.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
          drag.moved = true;
        }
        if (drag.moved) {
          onNodeDrag(drag.nodeId, drag.originX + dx, drag.originY + dy);
        }
        return;
      }

      if (drag.type === "pan") {
        const dx = point.x - drag.startSvgX;
        const dy = point.y - drag.startSvgY;
        setViewBox({
          ...drag.startViewBox,
          x: drag.startViewBox.x - dx,
          y: drag.startViewBox.y - dy
        });
      }
    },
    [getSvgPoint, onNodeDrag]
  );

  const handlePointerUp = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (drag.type === "node") {
      if (drag.moved) {
        onNodeDragEnd(drag.nodeId);
      } else {
        onNodeActivate(drag.nodeId);
      }
      return;
    }

    if (drag.type === "pan" && !drag.moved) {
      onCanvasBackgroundClick();
    }
  }, [onCanvasBackgroundClick, onNodeActivate, onNodeDragEnd]);

  const handleWheel = useCallback(
    (event) => {
      event.preventDefault();
      const point = getSvgPoint(event.clientX, event.clientY);
      const scaleFactor = event.deltaY > 0 ? 1.12 : 1 / 1.12;

      setViewBox((current) => {
        const newWidth = clamp(current.width * scaleFactor, MIN_WIDTH, MAX_WIDTH);
        const newHeight = newWidth * (current.height / current.width);
        const ratioX = (point.x - current.x) / current.width;
        const ratioY = (point.y - current.y) / current.height;
        return {
          x: point.x - ratioX * newWidth,
          y: point.y - ratioY * newHeight,
          width: newWidth,
          height: newHeight
        };
      });
    },
    [getSvgPoint]
  );

  const nodeByRefKey = useMemo(() => new Map(nodes.map((node) => [node.assetId ?? node.refId, node])), [nodes]);

  return (
    <div className="network-topology-canvas-wrap">
      <svg
        ref={svgRef}
        className="network-topology-canvas"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onPointerDown={handleSvgPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      >
        <defs>
          <pattern
            id="network-topology-grid"
            width={48}
            height={48}
            patternUnits="userSpaceOnUse"
          >
            <path d="M 48 0 L 0 0 0 48" className="network-topology-grid-line" />
          </pattern>
        </defs>
        <rect
          x={viewBox.x - 800}
          y={viewBox.y - 800}
          width={viewBox.width + 1600}
          height={viewBox.height + 1600}
          fill="url(#network-topology-grid)"
          pointerEvents="none"
        />
        {links.map((link) => (
          <NetworkTopologyLink
            key={link.id}
            link={link}
            sourceNode={nodeByRefKey.get(link.sourceAssetId)}
            targetNode={nodeByRefKey.get(link.targetAssetId)}
            devicesById={devicesById}
            clusterSummaryByRefId={clusterSummaryByRefId}
            selected={link.id === selectedLinkId}
            justCreated={link.id === justCreatedLinkId}
            onClick={onSelectLink}
          />
        ))}
        {nodes.map((node) => (
          <NetworkTopologyNode
            key={node.id}
            node={node}
            device={devicesById.get(node.assetId)}
            clusterInfo={clusterSummaryByRefId?.get(node.refId) ?? null}
            segmentName={segmentNameById.get(devicesById.get(node.assetId)?.segmentId)}
            selected={node.id === selectedNodeId}
            isLinkSource={node.id === linkDraftSourceNodeId}
            isNew={node.id === justAddedNodeId}
            editMode={editMode}
            onPointerDown={handleNodePointerDown}
            onActivate={onNodeActivate}
            onOpen={onNodeOpen}
          />
        ))}
      </svg>
    </div>
  );
});

export default NetworkTopologyCanvas;
