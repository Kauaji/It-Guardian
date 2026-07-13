import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { getRoomGeometry, getRoomInterior, getRoomWalls, isRoomZone } from "./utils/roomGeometry.js";

function toColor(value, fallback = "#1f7a61") {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
}

export default function FloorPlanScene3D({ data, activeFloorId }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data) return undefined;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 260);
    const floor = data.floors?.find((entry) => entry.id === activeFloorId) || data.floors?.[0];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc");

    const camera = new THREE.PerspectiveCamera(44, width / height, 1, 5000);
    camera.position.set(0, 720, 780);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 360;
    controls.maxDistance = 1900;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.target.set(0, 0, 0);

    const ambient = new THREE.AmbientLight("#ffffff", 0.74);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight("#ffffff", 0.74);
    sun.position.set(-200, 500, 360);
    sun.castShadow = true;
    scene.add(sun);

    const floorWidth = Number(floor?.width || data.plan?.width || 1280);
    const floorHeight = Number(floor?.height || data.plan?.height || 820);
    const baseGeometry = new THREE.BoxGeometry(floorWidth, 10, floorHeight);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.82 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.receiveShadow = true;
    scene.add(base);

    const offsetX = floorWidth / 2;
    const offsetY = floorHeight / 2;
    const activeZones = (data.zones || []).filter((zone) => !activeFloorId || zone.floorId === activeFloorId);
    const activeObjects = (data.objects || []).filter((object) => !activeFloorId || object.floorId === activeFloorId);

    const addBox = ({ x, y, width: boxWidth, depth, height: boxHeight, color, opacity = 1, verticalOffset = 0, metalness = 0.02 }) => {
      const material = new THREE.MeshStandardMaterial({
        color: toColor(color, "#dbeafe"),
        transparent: opacity < 1,
        opacity,
        roughness: 0.72,
        metalness
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(boxWidth, boxHeight, depth), material);
      mesh.position.set(Number(x || 0) + boxWidth / 2 - offsetX, boxHeight / 2 + verticalOffset, Number(y || 0) + depth / 2 - offsetY);
      mesh.castShadow = boxHeight > 20;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };

    const createMaterial = (color, opacity = 1, metalness = 0.04) => new THREE.MeshStandardMaterial({
      color: toColor(color, "#1f7a61"),
      transparent: opacity < 1,
      opacity,
      roughness: 0.62,
      metalness
    });

    const addModelPart = (group, { x = 0, z = 0, y = 0, width: partWidth = 12, depth: partDepth = 12, height: partHeight = 12, color = "#1f7a61", opacity = 1, metalness = 0.04 }) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(partWidth, partHeight, partDepth), createMaterial(color, opacity, metalness));
      mesh.position.set(x, y + partHeight / 2, z);
      mesh.castShadow = partHeight > 8;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    const addCylinderPart = (group, { x = 0, z = 0, y = 0, radius = 8, height: partHeight = 12, color = "#1f7a61", opacity = 1 }) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, partHeight, 24), createMaterial(color, opacity, 0.08));
      mesh.position.set(x, y + partHeight / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };

    const addObjectModel = (object) => {
      const objectWidth = Number(object.width || 72);
      const objectDepth = Number(object.height || 52);
      const type = object.objectType || object.category || "object";
      const color = toColor(object.color, "#1f7a61");
      const accent = "#0f172a";
      const neutral = "#f8fafc";
      const group = new THREE.Group();
      group.position.set(Number(object.x || 0) + objectWidth / 2 - offsetX, 22, Number(object.y || 0) + objectDepth / 2 - offsetY);
      group.rotation.y = THREE.MathUtils.degToRad(Number(object.rotation || 0));

      if (["desk", "table", "meeting_table"].includes(type)) {
        addModelPart(group, { width: objectWidth, depth: objectDepth, height: 10, y: 36, color: "#a9825c" });
        const legOffsetX = objectWidth / 2 - 8;
        const legOffsetZ = objectDepth / 2 - 8;
        [
          [-legOffsetX, -legOffsetZ],
          [legOffsetX, -legOffsetZ],
          [-legOffsetX, legOffsetZ],
          [legOffsetX, legOffsetZ]
        ].forEach(([x, z]) => addModelPart(group, { x, z, width: 7, depth: 7, height: 36, color: "#6b4f35" }));
      } else if (type === "chair") {
        addModelPart(group, { width: objectWidth * 0.72, depth: objectDepth * 0.72, height: 10, y: 22, color });
        addModelPart(group, { z: objectDepth * 0.22, width: objectWidth * 0.72, depth: 8, height: 42, y: 22, color });
      } else if (["pc", "notebook"].includes(type)) {
        if (type === "pc") {
          addModelPart(group, { x: -objectWidth * 0.15, width: objectWidth * 0.5, depth: 7, height: 32, y: 34, color: "#2563eb" });
          addModelPart(group, { x: -objectWidth * 0.15, z: -2, width: objectWidth * 0.62, depth: 4, height: 40, y: 32, color: "#111827", opacity: 0.92 });
          addModelPart(group, { x: objectWidth * 0.28, width: 13, depth: objectDepth * 0.42, height: 42, y: 18, color: "#1f2937", metalness: 0.18 });
          addModelPart(group, { x: -objectWidth * 0.15, z: objectDepth * 0.18, width: objectWidth * 0.35, depth: 12, height: 5, y: 20, color: "#475569" });
        } else {
          addModelPart(group, { width: objectWidth * 0.72, depth: objectDepth * 0.52, height: 5, y: 18, color: "#334155" });
          addModelPart(group, { z: -objectDepth * 0.18, width: objectWidth * 0.7, depth: 5, height: 30, y: 21, color: "#1d4ed8" });
        }
      } else if (type === "printer") {
        addModelPart(group, { width: objectWidth * 0.88, depth: objectDepth * 0.74, height: 24, y: 16, color: neutral, metalness: 0.1 });
        addModelPart(group, { z: -objectDepth * 0.34, width: objectWidth * 0.72, depth: 8, height: 5, y: 30, color: "#cbd5e1" });
      } else if (["rack", "server"].includes(type)) {
        addModelPart(group, { width: objectWidth * 0.72, depth: objectDepth * 0.72, height: 90, y: 0, color: "#111827", metalness: 0.22 });
        for (let index = 0; index < 5; index += 1) {
          addModelPart(group, { z: -objectDepth * 0.38, y: 12 + index * 14, width: objectWidth * 0.56, depth: 3, height: 5, color });
        }
      } else if (["switch", "firewall", "router"].includes(type)) {
        addModelPart(group, { width: objectWidth * 0.88, depth: objectDepth * 0.64, height: 14, y: 18, color: "#334155", metalness: 0.18 });
        addModelPart(group, { z: -objectDepth * 0.32, width: objectWidth * 0.7, depth: 3, height: 4, y: 28, color });
      } else if (type === "access_point") {
        addCylinderPart(group, { radius: Math.min(objectWidth, objectDepth) * 0.28, height: 9, y: 22, color: neutral });
        addCylinderPart(group, { radius: Math.min(objectWidth, objectDepth) * 0.11, height: 11, y: 28, color });
      } else if (type === "door") {
        addModelPart(group, { width: objectWidth * 0.16, depth: objectDepth, height: 58, y: 0, color: "#bf8f5a" });
        addModelPart(group, { x: objectWidth * 0.18, width: 7, depth: 7, height: 7, y: 30, color: "#facc15", metalness: 0.45 });
      } else if (type === "window") {
        addModelPart(group, { width: objectWidth, depth: 5, height: 42, y: 22, color: "#bfdbfe", opacity: 0.72 });
        addModelPart(group, { width: objectWidth, depth: 7, height: 5, y: 22, color: "#64748b" });
      } else if (["outlet", "power_cable", "stabilizer_600", "stabilizer_1000", "extension_cord", "power_strip"].includes(type)) {
        const isStrip = ["power_strip", "extension_cord", "power_cable"].includes(type);
        addModelPart(group, { width: isStrip ? objectWidth * 0.9 : objectWidth * 0.58, depth: isStrip ? 11 : objectDepth * 0.5, height: isStrip ? 8 : 22, y: 12, color: "#f59e0b" });
        addModelPart(group, { x: objectWidth * 0.18, width: 5, depth: 5, height: 5, y: 21, color: accent });
      } else {
        addModelPart(group, { width: objectWidth, depth: objectDepth, height: Number(object.height3d || 42), y: 0, color, metalness: object.category === "asset" ? 0.18 : 0.04 });
      }

      scene.add(group);
      return group;
    };

    activeZones.forEach((zone) => {
      const geometry = zone.geometry || {};
      if (isRoomZone(zone)) {
        const room = getRoomGeometry(zone);
        const interior = getRoomInterior(zone);
        const walls = getRoomWalls(zone);
        const wallHeight = Number(zone.metadata?.room?.wallHeight || 110);
        addBox({ x: room.x, y: room.y, width: room.width, depth: room.height, height: 10, color: zone.color, opacity: 0.22, verticalOffset: 10 });
        addBox({ x: interior.x, y: interior.y, width: interior.width, depth: interior.height, height: 6, color: "#f8fafc", opacity: 0.88, verticalOffset: 17 });
        Object.values(walls).forEach((wall) => {
          addBox({
            x: wall.x,
            y: wall.y,
            width: wall.width,
            depth: wall.height,
            height: wallHeight,
            color: "#f8fafc",
            opacity: 0.82,
            verticalOffset: 18
          });
        });
        return;
      }
      const zoneWidth = Number(geometry.width || 180);
      const zoneHeight = Number(geometry.height || 120);
      addBox({ x: geometry.x || 0, y: geometry.y || 0, width: zoneWidth, depth: zoneHeight, height: 8, color: zone.color, opacity: 0.3, verticalOffset: 12 });
    });

    activeObjects.forEach(addObjectModel);

    const grid = new THREE.GridHelper(Math.max(floorWidth, floorHeight), 32, "#94a3b8", "#cbd5e1");
    grid.position.y = 18;
    scene.add(grid);

    let animationId = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
      scene.traverse((item) => {
        if (item.geometry) item.geometry.dispose();
        if (item.material) item.material.dispose?.();
      });
    };
  }, [activeFloorId, data]);

  return <div className="floor-plan-scene-3d" ref={containerRef} aria-label="Visualizacao 3D da planta" />;
}
