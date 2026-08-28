import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import NetworkTopologyNode from "./NetworkTopologyNode.jsx";
import NetworkTopologyLink from "./NetworkTopologyLink.jsx";
import { topologyLinkKey, topologyNodeKey } from "./networkTopologyConnections.js";
import { isClusterNode } from "./networkTopologyModel.js";
import {
  DEFAULT_TOPOLOGY_VIEWBOX,
  fitTopologyViewBox,
  normalizeTopologyWheelDelta,
  zoomTopologyViewBox
} from "./networkTopologyViewport.js";

const DEFAULT_VIEWBOX = DEFAULT_TOPOLOGY_VIEWBOX;
const DRAG_THRESHOLD = 3;
const CLUSTER_ACTIVATION_DELAY = 300;

function capturePointer(target, pointerId) {
  try {
    target?.setPointerCapture?.(pointerId);
  } catch {
    // Touch or a quick double-click may already have released the pointer.
  }
}

function releasePointer(drag) {
  try {
    drag.captureTarget?.releasePointerCapture?.(drag.pointerId);
  } catch {
    // Capture can already be lost when the browser cancels a gesture.
  }
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
    linkDraftActive = false,
    linkDraftSourceNodeId,
    justAddedNodeId,
    justCreatedLinkId,
    onNodeActivate,
    onNodeDrag,
    onNodeDragEnd,
    onNodeOpen,
    onNavigateBack,
    backLabel = "Voltar",
    emptyState,
    onSelectLink,
    onCanvasBackgroundClick
  },
  ref
) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const pendingActivationRef = useRef(null);
  const latestActivationRef = useRef(onNodeActivate);
  const [viewBox, setViewBox] = useState(() => fitTopologyViewBox(nodes));
  const [draftPointer, setDraftPointer] = useState(null);
  const nodeScopeKey = JSON.stringify(nodes.map((node) => node.id).sort());

  const clearPendingActivation = useCallback(() => {
    if (pendingActivationRef.current !== null) {
      window.clearTimeout(pendingActivationRef.current);
      pendingActivationRef.current = null;
    }
  }, []);

  useEffect(() => {
    latestActivationRef.current = onNodeActivate;
  }, [onNodeActivate]);

  // A scope or mode change must not open an inspector from an earlier click.
  useEffect(() => clearPendingActivation, [clearPendingActivation, nodeScopeKey, editMode, linkDraftActive]);

  const activateNodeImmediately = useCallback((nodeId) => {
    clearPendingActivation();
    onNodeActivate(nodeId);
  }, [clearPendingActivation, onNodeActivate]);

  const activatePointerNode = useCallback((nodeId) => {
    clearPendingActivation();
    const node = nodes.find((entry) => entry.id === nodeId);
    if (!node) return;
    if (linkDraftActive || !isClusterNode(node)) {
      onNodeActivate(nodeId);
      return;
    }
    // Opening the inspector can move or cover a cluster before a second click.
    pendingActivationRef.current = window.setTimeout(() => {
      pendingActivationRef.current = null;
      latestActivationRef.current(nodeId);
    }, CLUSTER_ACTIVATION_DELAY);
  }, [clearPendingActivation, linkDraftActive, nodes, onNodeActivate]);

  const handleNodeOpen = useCallback((node) => {
    clearPendingActivation();
    onNodeOpen?.(node);
  }, [clearPendingActivation, onNodeOpen]);

  const handleSelectLink = useCallback((linkId) => {
    clearPendingActivation();
    onSelectLink(linkId);
  }, [clearPendingActivation, onSelectLink]);

  const getSvgPoint = useCallback((clientX, clientY, inverseMatrix) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const transform = inverseMatrix ?? svg.getScreenCTM()?.inverse();
    if (!transform) return { x: 0, y: 0 };
    const transformed = point.matrixTransform(transform);
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
      if (event.button !== 0 || event.isPrimary === false) return;
      const node = nodes.find((entry) => entry.id === nodeId);
      if (!node) return;

      clearPendingActivation();
      if (linkDraftActive || (!editMode && !isClusterNode(node))) {
        activateNodeImmediately(nodeId);
        return;
      }

      const inverseMatrix = svgRef.current?.getScreenCTM()?.inverse();
      const point = getSvgPoint(event.clientX, event.clientY, inverseMatrix);
      dragRef.current = {
        type: editMode ? "node" : "select",
        nodeId,
        pointerId: event.pointerId,
        captureTarget: event.currentTarget,
        inverseMatrix,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startSvgX: point.x,
        startSvgY: point.y,
        originX: node.x,
        originY: node.y,
        moved: false
      };
      capturePointer(event.currentTarget, event.pointerId);
    },
    [activateNodeImmediately, clearPendingActivation, editMode, getSvgPoint, linkDraftActive, nodes]
  );

  const handleSvgPointerDown = useCallback(
    (event) => {
      if (event.target !== svgRef.current) return;
      if (event.button !== 0 || event.isPrimary === false) return;
      clearPendingActivation();
      const inverseMatrix = svgRef.current?.getScreenCTM()?.inverse();
      const point = getSvgPoint(event.clientX, event.clientY, inverseMatrix);
      dragRef.current = {
        type: "pan",
        pointerId: event.pointerId,
        captureTarget: event.currentTarget,
        inverseMatrix,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startSvgX: point.x,
        startSvgY: point.y,
        startViewBox: viewBox,
        moved: false
      };
      capturePointer(event.currentTarget, event.pointerId);
    },
    [clearPendingActivation, getSvgPoint, viewBox]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (linkDraftActive && linkDraftSourceNodeId) {
        setDraftPointer({
          sourceNodeId: linkDraftSourceNodeId,
          ...getSvgPoint(event.clientX, event.clientY)
        });
      }
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      // Keep the original matrix while panning changes the viewBox.
      const point = getSvgPoint(event.clientX, event.clientY, drag.inverseMatrix);
      const dx = point.x - drag.startSvgX;
      const dy = point.y - drag.startSvgY;
      if (!drag.moved && Math.hypot(
        event.clientX - drag.startClientX,
        event.clientY - drag.startClientY
      ) > DRAG_THRESHOLD) {
        drag.moved = true;
        clearPendingActivation();
      }
      if (!drag.moved) return;

      if (drag.type === "node") {
        onNodeDrag(drag.nodeId, drag.originX + dx, drag.originY + dy);
        return;
      }

      if (drag.type === "pan") {
        setViewBox({
          ...drag.startViewBox,
          x: drag.startViewBox.x - dx,
          y: drag.startViewBox.y - dy
        });
      }
    },
    [clearPendingActivation, getSvgPoint, linkDraftActive, linkDraftSourceNodeId, onNodeDrag]
  );

  const handlePointerUp = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    releasePointer(drag);

    if (drag.type === "node") {
      if (drag.moved) {
        onNodeDragEnd?.(drag.nodeId);
      } else {
        activatePointerNode(drag.nodeId);
      }
      return;
    }

    if (drag.type === "select" && !drag.moved) {
      activatePointerNode(drag.nodeId);
      return;
    }

    if (drag.type === "pan" && !drag.moved) {
      clearPendingActivation();
      onCanvasBackgroundClick();
    }
  }, [activatePointerNode, clearPendingActivation, onCanvasBackgroundClick, onNodeDragEnd]);

  const handlePointerCancel = useCallback((event) => {
    clearPendingActivation();
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    releasePointer(drag);
    if (drag.type === "node" && drag.moved) {
      onNodeDrag(drag.nodeId, drag.originX, drag.originY);
    }
  }, [clearPendingActivation, onNodeDrag]);

  const handlePointerLeave = useCallback((event) => {
    setDraftPointer(null);
    const drag = dragRef.current;
    if (drag && !drag.captureTarget?.hasPointerCapture?.(drag.pointerId)) {
      handlePointerUp(event);
    }
  }, [handlePointerUp]);

  const handleWheel = useCallback(
    (event) => {
      event.preventDefault();
      if (dragRef.current) return;
      const point = getSvgPoint(event.clientX, event.clientY);
      const deltaMode = event.deltaMode;
      const delta = normalizeTopologyWheelDelta(event.deltaY, deltaMode, svgRef.current?.clientHeight);
      setViewBox((current) => zoomTopologyViewBox(current, point, delta));
    },
    [getSvgPoint]
  );

  useEffect(() => {
    const svg = svgRef.current;
    // A non-passive listener keeps canvas zoom from also scrolling the page.
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const nodeByRefKey = useMemo(() => new Map(nodes.map((node) => [topologyNodeKey(node), node])), [nodes]);
  const draftSource = linkDraftActive
    ? nodes.find((node) => node.id === linkDraftSourceNodeId)
    : null;

  return (
    <div className="network-topology-canvas-wrap">
      {onNavigateBack ? (
        <button
          type="button"
          className="network-topology-canvas-back"
          onClick={onNavigateBack}
          aria-label={backLabel}
          title={backLabel}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
      ) : null}
      <svg
        ref={svgRef}
        className="network-topology-canvas"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onPointerDown={handleSvgPointerDown}
        onPointerDownCapture={clearPendingActivation}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
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
            sourceNode={nodeByRefKey.get(topologyLinkKey(link, "source"))}
            targetNode={nodeByRefKey.get(topologyLinkKey(link, "target"))}
            devicesById={devicesById}
            clusterSummaryByRefId={clusterSummaryByRefId}
            selected={link.id === selectedLinkId}
            justCreated={link.id === justCreatedLinkId}
            onClick={handleSelectLink}
          />
        ))}
        {draftSource && draftPointer?.sourceNodeId === draftSource.id ? (
          <line
            className="network-topology-link-draft"
            x1={draftSource.x}
            y1={draftSource.y}
            x2={draftPointer.x}
            y2={draftPointer.y}
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="6 5"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            aria-hidden="true"
          />
        ) : null}
        {nodes.map((node) => (
          <NetworkTopologyNode
            key={node.id}
            node={node}
            device={devicesById.get(node.assetId)}
            clusterInfo={clusterSummaryByRefId?.get(node.refId) ?? null}
            segmentName={segmentNameById.get(devicesById.get(node.assetId)?.segmentId)}
            selected={node.id === selectedNodeId}
            isLinkSource={linkDraftActive && node.id === linkDraftSourceNodeId}
            isNew={node.id === justAddedNodeId}
            editMode={editMode && !linkDraftActive}
            linkDraftActive={linkDraftActive}
            onPointerDown={handleNodePointerDown}
            onActivate={activateNodeImmediately}
            onOpen={linkDraftActive || !onNodeOpen ? undefined : handleNodeOpen}
          />
        ))}
      </svg>
      {emptyState ? <div className="network-topology-canvas-empty">{emptyState}</div> : null}
    </div>
  );
});

export default NetworkTopologyCanvas;
