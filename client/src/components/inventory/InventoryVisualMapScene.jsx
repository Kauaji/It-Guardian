import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

function normalizeNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function createTextSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(255, 255, 255, 0.88)";
  context.strokeStyle = "rgba(15, 23, 42, 0.12)";
  context.lineWidth = 10;
  context.beginPath();
  if (typeof context.roundRect === "function") {
    context.roundRect(12, 24, 488, 80, 24);
  } else {
    context.rect(12, 24, 488, 80);
  }
  context.fill();
  context.stroke();
  context.fillStyle = "#0f172a";
  context.font = "700 34px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(text || "Objeto").slice(0, 22), 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.2, 0.55, 1);
  sprite.userData.isLabel = true;
  return sprite;
}

function buildObjectMesh(object, selectedId) {
  const width = normalizeNumber(object.width, 1);
  const depth = normalizeNumber(object.depth, 1);
  const height = normalizeNumber(object.height, 1);
  const color = object.color || (object.layer === "structure" ? "#64748b" : "#2563eb");
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: object.presetType === "rack" || object.presetType === "server" ? 0.12 : 0.02,
    transparent: object.presetType === "room" || object.presetType === "corridor",
    opacity: object.presetType === "room" || object.presetType === "corridor" ? 0.5 : 1
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(
    normalizeNumber(object.positionX, 0),
    normalizeNumber(object.positionY, 0) + height / 2,
    normalizeNumber(object.positionZ, 0)
  );
  mesh.rotation.set(
    THREE.MathUtils.degToRad(normalizeNumber(object.rotationX, 0)),
    THREE.MathUtils.degToRad(normalizeNumber(object.rotationY, 0)),
    THREE.MathUtils.degToRad(normalizeNumber(object.rotationZ, 0))
  );
  mesh.userData.objectId = object.id;

  const outline = new THREE.BoxHelper(mesh, selectedId === object.id ? "#0ea5e9" : "#0f172a");
  outline.material.transparent = true;
  outline.material.opacity = selectedId === object.id ? 0.95 : 0.18;

  const group = new THREE.Group();
  group.add(mesh);
  group.add(outline);

  if (object.layer === "assets") {
    const label = createTextSprite(object.label);
    label.position.set(mesh.position.x, mesh.position.y + height / 2 + 0.45, mesh.position.z);
    group.add(label);
  }

  return { group, mesh };
}

function normalizePoint(point) {
  if (!point) return null;
  return new THREE.Vector3(
    normalizeNumber(point.x, 0),
    normalizeNumber(point.y, 0.12),
    normalizeNumber(point.z, 0)
  );
}

function getConnectionLabel(connection) {
  return connection.label || connection.connectionType || "Conexao";
}

function buildConnectionLine(connection, selectedConnectionId) {
  const points = (connection.points || []).map(normalizePoint).filter(Boolean);
  if (points.length < 2) return null;

  const selected = selectedConnectionId === connection.id;
  const color = connection.color || (connection.layer === "electrical" ? "#f97316" : "#0ea5e9");
  const materialOptions = {
    color,
    linewidth: Math.max(1, normalizeNumber(connection.thickness, 2) + (selected ? 2 : 0)),
    transparent: true,
    opacity: selected ? 0.98 : 0.78
  };
  const material = connection.dashed
    ? new THREE.LineDashedMaterial({ ...materialOptions, dashSize: 0.42, gapSize: 0.22 })
    : new THREE.LineBasicMaterial(materialOptions);

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, material);
  line.userData.connectionId = connection.id;
  if (connection.dashed) line.computeLineDistances();

  const group = new THREE.Group();
  group.add(line);

  const endpointMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.04,
    transparent: true,
    opacity: selected ? 1 : 0.86
  });
  const endpointGeometry = new THREE.SphereGeometry(selected ? 0.13 : 0.09, 16, 16);
  points.forEach((point) => {
    const endpoint = new THREE.Mesh(endpointGeometry, endpointMaterial);
    endpoint.position.copy(point);
    endpoint.userData.connectionId = connection.id;
    group.add(endpoint);
  });

  const midpoint = points[Math.floor((points.length - 1) / 2)].clone().lerp(points[Math.ceil((points.length - 1) / 2)], 0.5);
  const label = createTextSprite(getConnectionLabel(connection));
  label.position.set(midpoint.x, midpoint.y + 0.35, midpoint.z);
  group.add(label);

  return { group, selectable: [line, ...group.children.filter((child) => child.userData.connectionId === connection.id && child !== line)] };
}

export default function InventoryVisualMapScene({
  map,
  objects,
  connections = [],
  selectedObjectId,
  selectedConnectionId,
  layers,
  showGrid,
  cameraAction,
  onSelectObject,
  onSelectConnection
}) {
  const hostRef = useRef(null);
  const selectableMeshesRef = useRef([]);
  const cameraContextRef = useRef(null);
  const cameraStateRef = useRef(null);
  const selectObjectRef = useRef(onSelectObject);
  const selectConnectionRef = useRef(onSelectConnection);

  selectObjectRef.current = onSelectObject;
  selectConnectionRef.current = onSelectConnection;

  const visibleObjects = useMemo(
    () => objects.filter((object) => layers?.[object.layer] !== false),
    [layers, objects]
  );

  const visibleConnections = useMemo(
    () => connections.filter((connection) => layers?.[connection.layer] !== false),
    [connections, layers]
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !map) return undefined;

    const width = host.clientWidth || 860;
    const height = host.clientHeight || 480;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc");

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 1000);
    const mapWidth = normalizeNumber(map.width, 30);
    const mapDepth = normalizeNumber(map.depth, 20);
    const maxMapDimension = Math.max(mapWidth, mapDepth);
    const initialCameraPosition = new THREE.Vector3(
      mapWidth * 0.35,
      Math.max(mapDepth, 14),
      mapDepth * 0.82
    );
    const savedCameraState = cameraStateRef.current?.mapId === map.id ? cameraStateRef.current : null;
    camera.position.copy(savedCameraState?.position || initialCameraPosition);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = false;
    host.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.target.copy(savedCameraState?.target || new THREE.Vector3(0, 0, 0));
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 4;
    controls.maxDistance = maxMapDimension * 2.4;

    const ambient = new THREE.HemisphereLight("#ffffff", "#cbd5e1", 2.1);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight("#ffffff", 1.25);
    directional.position.set(10, 18, 8);
    scene.add(directional);

    const floorGeometry = new THREE.BoxGeometry(mapWidth, 0.08, mapDepth);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.85 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -0.04;
    scene.add(floor);

    if (showGrid) {
      const gridScale = Math.max(0.1, normalizeNumber(map.scale, 1));
      const divisions = Math.min(400, Math.max(8, Math.round(maxMapDimension / gridScale)));
      const grid = new THREE.GridHelper(maxMapDimension, divisions);
      grid.material.opacity = 0.32;
      grid.material.transparent = true;
      scene.add(grid);
    }

    const selectableMeshes = [];
    for (const object of visibleObjects) {
      const { group, mesh } = buildObjectMesh(object, selectedObjectId);
      selectableMeshes.push(mesh);
      scene.add(group);
    }

    for (const connection of visibleConnections) {
      const builtConnection = buildConnectionLine(connection, selectedConnectionId);
      if (!builtConnection) continue;
      selectableMeshes.push(...builtConnection.selectable);
      scene.add(builtConnection.group);
    }
    selectableMeshesRef.current = selectableMeshes;

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 0.28 };
    const pointer = new THREE.Vector2();

    function handlePointerDown(event) {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);
      const [hit] = raycaster.intersectObjects(selectableMeshesRef.current, false);
      const connectionId = hit?.object?.userData?.connectionId || null;
      if (connectionId) {
        selectConnectionRef.current?.(connectionId);
        return;
      }
      selectObjectRef.current?.(hit?.object?.userData?.objectId || null);
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    function render() {
      renderer.render(scene, camera);
    }

    function resetCamera() {
      controls.target.set(0, 0, 0);
      camera.position.copy(initialCameraPosition);
      camera.near = 0.1;
      camera.far = Math.max(1000, maxMapDimension * 10);
      camera.updateProjectionMatrix();
      controls.update();
      render();
    }

    function fitMap() {
      const distance = Math.max(8, maxMapDimension * 1.35);
      controls.target.set(0, 0, 0);
      camera.position.set(distance * 0.48, distance * 0.72, distance * 0.88);
      camera.lookAt(controls.target);
      controls.update();
      render();
    }

    function focusSelection() {
      const selected = visibleObjects.find((object) => object.id === selectedObjectId);
      if (!selected) return;
      const target = new THREE.Vector3(
        normalizeNumber(selected.positionX, 0),
        normalizeNumber(selected.positionY, 0) + normalizeNumber(selected.height, 1) / 2,
        normalizeNumber(selected.positionZ, 0)
      );
      const direction = camera.position.clone().sub(controls.target).normalize();
      const objectSize = Math.max(
        normalizeNumber(selected.width, 1),
        normalizeNumber(selected.depth, 1),
        normalizeNumber(selected.height, 1)
      );
      controls.target.copy(target);
      camera.position.copy(target).add(direction.multiplyScalar(Math.max(4, objectSize * 4)));
      camera.lookAt(target);
      controls.update();
      render();
    }

    controls.addEventListener("change", render);
    cameraContextRef.current = { fitMap, focusSelection, resetCamera };
    render();

    const resizeObserver = new ResizeObserver(([entry]) => {
      const nextWidth = Math.max(320, Math.round(entry.contentRect.width));
      const nextHeight = Math.max(280, Math.round(entry.contentRect.height));
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
      render();
    });
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      cameraStateRef.current = {
        mapId: map.id,
        position: camera.position.clone(),
        target: controls.target.clone()
      };
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      controls.removeEventListener("change", render);
      controls.dispose();
      scene.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          const disposeMaterial = (material) => {
            if (material.map) material.map.dispose();
            material.dispose();
          };
          if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
          else disposeMaterial(child.material);
        }
      });
      renderer.dispose();
      host.replaceChildren();
      selectableMeshesRef.current = [];
      cameraContextRef.current = null;
    };
  }, [map, selectedConnectionId, selectedObjectId, showGrid, visibleConnections, visibleObjects]);

  useEffect(() => {
    if (!cameraAction?.revision) return;
    const context = cameraContextRef.current;
    if (!context) return;
    if (cameraAction.type === "selection") context.focusSelection();
    else if (cameraAction.type === "reset") context.resetCamera();
    else context.fitMap();
  }, [cameraAction]);

  if (!map) {
    return (
      <div className="inventory-visual-map-canvas empty">
        <strong>Nenhum mapa selecionado.</strong>
      </div>
    );
  }

  return (
    <div
      className="inventory-visual-map-canvas"
      ref={hostRef}
      role="img"
      aria-label={`Cena 3D do mapa ${map.name || "sem nome"}. Arraste para orbitar e use a roda do mouse para aproximar.`}
      tabIndex={0}
    />
  );
}
