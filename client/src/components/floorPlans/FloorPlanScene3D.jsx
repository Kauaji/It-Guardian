import { useEffect, useRef } from "react";
import * as THREE from "three";

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

    activeZones.forEach((zone) => {
      const geometry = zone.geometry || {};
      const zoneWidth = Number(geometry.width || 180);
      const zoneHeight = Number(geometry.height || 120);
      const material = new THREE.MeshStandardMaterial({
        color: toColor(zone.color, "#dbeafe"),
        transparent: true,
        opacity: 0.3,
        roughness: 0.88
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(zoneWidth, 8, zoneHeight), material);
      mesh.position.set(Number(geometry.x || 0) + zoneWidth / 2 - offsetX, 12, Number(geometry.y || 0) + zoneHeight / 2 - offsetY);
      scene.add(mesh);
    });

    activeObjects.forEach((object) => {
      const objectWidth = Number(object.width || 72);
      const objectDepth = Number(object.height || 52);
      const objectHeight = Number(object.height3d || 42);
      const material = new THREE.MeshStandardMaterial({
        color: toColor(object.color, "#1f7a61"),
        roughness: 0.52,
        metalness: object.category === "asset" ? 0.18 : 0.04
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(objectWidth, objectHeight, objectDepth), material);
      mesh.castShadow = true;
      mesh.position.set(Number(object.x || 0) + objectWidth / 2 - offsetX, objectHeight / 2 + 12, Number(object.y || 0) + objectDepth / 2 - offsetY);
      mesh.rotation.y = THREE.MathUtils.degToRad(Number(object.rotation || 0));
      scene.add(mesh);
    });

    const grid = new THREE.GridHelper(Math.max(floorWidth, floorHeight), 32, "#94a3b8", "#cbd5e1");
    grid.position.y = 18;
    scene.add(grid);

    let frame = 0;
    let animationId = 0;
    const animate = () => {
      frame += 0.004;
      camera.position.x = Math.sin(frame) * 80;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
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
