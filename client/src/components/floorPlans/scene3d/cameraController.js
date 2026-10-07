import * as THREE from "three";
import { easeCamera, getFloorPlanCameraPreset } from "./cameraPresets.js";

const TWEEN_DURATION_MS = 520;
const DAMPING_AFTER_START_MS = 1400;
const DAMPING_AFTER_END_MS = 900;
const DEFAULT_DAMPING_MS = 760;

/**
 * Movimento da camera: troca de vista animada (ou instantanea com movimento
 * reduzido/preview) e amortecimento do OrbitControls enquanto o usuario
 * interage. `dispose` cancela quadros pendentes e remove os ouvintes.
 */
export function createCameraController({ camera, controls, contentFrame, preview, reducedMotion, render, lifecycle }) {
  let dampingFrameId = null;
  let cameraFrameId = null;
  let dampingUntil = 0;

  const stopCameraTween = () => {
    if (cameraFrameId != null) cancelAnimationFrame(cameraFrameId);
    cameraFrameId = null;
  };

  const runDamping = () => {
    dampingFrameId = null;
    if (lifecycle.disposed) return;
    controls.update();
    render();
    if (performance.now() < dampingUntil) dampingFrameId = requestAnimationFrame(runDamping);
  };

  const startDamping = (duration = DEFAULT_DAMPING_MS) => {
    if (reducedMotion) return;
    dampingUntil = Math.max(dampingUntil, performance.now() + duration);
    if (dampingFrameId == null) dampingFrameId = requestAnimationFrame(runDamping);
  };

  const setCameraView = (nextView) => {
    const preset = getFloorPlanCameraPreset(
      nextView,
      contentFrame.width,
      contentFrame.height,
      camera.aspect,
      camera.fov,
      contentFrame.centerX,
      contentFrame.centerZ
    );
    stopCameraTween();

    if (reducedMotion || preview) {
      camera.position.copy(preset.position);
      controls.target.copy(preset.target);
      controls.update();
      render();
      return;
    }

    const originPosition = camera.position.clone();
    const originTarget = controls.target.clone();
    const startedAt = performance.now();
    const animateCamera = (timestamp) => {
      if (lifecycle.disposed) return;
      const progress = THREE.MathUtils.clamp((timestamp - startedAt) / TWEEN_DURATION_MS, 0, 1);
      const eased = easeCamera(progress);
      camera.position.lerpVectors(originPosition, preset.position, eased);
      controls.target.lerpVectors(originTarget, preset.target, eased);
      controls.update();
      render();
      if (progress < 1) cameraFrameId = requestAnimationFrame(animateCamera);
      else cameraFrameId = null;
    };
    cameraFrameId = requestAnimationFrame(animateCamera);
  };

  const handleControlStart = () => {
    stopCameraTween();
    startDamping(DAMPING_AFTER_START_MS);
  };
  const handleControlEnd = () => startDamping(DAMPING_AFTER_END_MS);

  controls.addEventListener("start", handleControlStart);
  controls.addEventListener("change", render);
  controls.addEventListener("end", handleControlEnd);

  const dispose = () => {
    if (dampingFrameId != null) cancelAnimationFrame(dampingFrameId);
    stopCameraTween();
    controls.removeEventListener("start", handleControlStart);
    controls.removeEventListener("change", render);
    controls.removeEventListener("end", handleControlEnd);
  };

  return { setCameraView, dispose };
}
