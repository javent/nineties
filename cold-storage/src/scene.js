import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clamp } from "./utils.js";

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, innerWidth <= 800 ? 1.5 : 1.75),
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  // Three r185 uses physically correct light attenuation by default (no legacy switch).
  // r185 folded the deprecated PCFSoftShadowMap into its improved PCFShadowMap.
  // For older Three releases the requested PCFSoftShadowMap constant is still used.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type =
    Number(THREE.REVISION) >= 185 ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  // The environment lights the fridge but is never shown as a background.
  scene.background = new THREE.Color(0x000000);
  scene.fog = null;
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.rotateSpeed = 0.48;
  controls.zoomSpeed = 0.7;
  controls.panSpeed = 0.55;
  controls.minPolarAngle = Math.PI * 0.34;
  controls.maxPolarAngle = Math.PI * 0.53;
  controls.minDistance = 7.0;
  controls.maxDistance = 18;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  // Deliberately no room, ground plane, horizon, or decorative backdrop.
  let defaultDistance = 14.2,
    mobile = false,
    resetTween = null;
  const panBefore = new THREE.Vector3();
  const panDelta = new THREE.Vector3();
  const defaultTarget = new THREE.Vector3(0, -0.1, 0.26);
  const defaultDirection = new THREE.Vector3(0.3, 0.075, 1).normalize();
  function reset(instant = false, normal = null) {
    const direction = normal
      ? new THREE.Vector3(normal.x, 0.085, normal.z).normalize()
      : defaultDirection;
    if (direction.lengthSq() < 0.2) direction.copy(defaultDirection);
    const toTarget = defaultTarget.clone();
    const toPosition = toTarget
      .clone()
      .addScaledVector(direction, defaultDistance);
    if (instant) {
      controls.target.copy(toTarget);
      camera.position.copy(toPosition);
      controls.update();
    } else resetTween = { position: toPosition, target: toTarget };
  }
  function resize() {
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    mobile = width <= 800;
    camera.aspect = width / height;
    // The fridge is the subject: use a centered lens, with no editorial offset.
    camera.clearViewOffset();
    camera.fov = width <= 560 ? 36 : 34;

    // Fit symmetrically around the canvas center, keeping the chrome, feet and
    // stickers clear of the header, footer and finish swatches at any size.
    const canvasRect = canvas.getBoundingClientRect();
    const header = document.querySelector(".topbar")?.getBoundingClientRect();
    const footer = document
      .querySelector(".bottom-bar")
      ?.getBoundingClientRect();
    const finishes = document
      .querySelector(".finish-picker")
      ?.getBoundingClientRect();
    const topInset = (header ? header.bottom - canvasRect.top : 70) + 10;
    const bottomInset = (footer ? canvasRect.bottom - footer.top : 80) + 18;
    const sideInset = Math.max(
      24,
      finishes ? canvasRect.right - finishes.left + 8 : 24,
    );
    const availableHeight = Math.max(
      100,
      height - 2 * Math.max(topInset, bottomInset),
    );
    const availableWidth = Math.max(120, width - 2 * sideInset);
    const halfFovTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    // Projected dimensions of this fridge, including the lower feet and hardware.
    const verticalFit = (5.8 * height) / (2 * halfFovTangent * availableHeight);
    const horizontalFit =
      (3.45 * height) / (2 * halfFovTangent * availableWidth);
    defaultDistance = 0.9 + Math.max(verticalFit, horizontalFit);
    controls.minDistance = width <= 560 ? 10 : mobile ? 8 : 7;
    controls.maxDistance = Math.max(
      defaultDistance * 1.48,
      controls.minDistance + 2,
    );
    renderer.setSize(width, height, false);
    camera.updateProjectionMatrix();
    reset(true);
  }
  const onStart = () => {
    resetTween = null;
    document.body.classList.add("is-exploring");
  };
  let endTimer;
  const onEnd = () => {
    clearTimeout(endTimer);
    endTimer = setTimeout(
      () => document.body.classList.remove("is-exploring"),
      1500,
    );
  };
  controls.addEventListener("start", onStart);
  controls.addEventListener("end", onEnd);
  window.addEventListener("resize", resize);
  resize();

  function update(dt) {
    if (resetTween) {
      const alpha = 1 - Math.exp(-dt * 7);
      camera.position.lerp(resetTween.position, alpha);
      controls.target.lerp(resetTween.target, alpha);
      if (camera.position.distanceToSquared(resetTween.position) < 0.00001) {
        camera.position.copy(resetTween.position);
        controls.target.copy(resetTween.target);
        resetTween = null;
      }
    }
    // Bound panning so the object cannot be accidentally lost. Reuses scratch
    // vectors: this runs every frame, so clones here are pure GC churn.
    panBefore.copy(controls.target);
    controls.target.x = clamp(controls.target.x, -2.5, 2.5);
    controls.target.y = clamp(controls.target.y, -1.7, 1.7);
    controls.target.z = clamp(controls.target.z, -1.5, 1.5);
    camera.position.add(panDelta.copy(controls.target).sub(panBefore));
    if (controls.enabled) controls.update();
  }
  function stopMotion() {
    resetTween = null;
    const position = camera.position.clone(),
      target = controls.target.clone(),
      damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    camera.position.copy(position);
    controls.target.copy(target);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
  }
  function zoom(factor) {
    resetTween = null;
    const delta = camera.position.clone().sub(controls.target);
    delta.setLength(
      clamp(
        delta.length() * factor,
        controls.minDistance,
        controls.maxDistance,
      ),
    );
    resetTween = {
      position: controls.target.clone().add(delta),
      target: controls.target.clone(),
    };
  }
  return {
    scene,
    camera,
    renderer,
    controls,
    update,
    reset,
    stopMotion,
    zoom,
    get zoomPercent() {
      return Math.round(
        (defaultDistance / camera.position.distanceTo(controls.target)) * 100,
      );
    },
    dispose() {
      clearTimeout(endTimer);
      window.removeEventListener("resize", resize);
      controls.dispose();
      renderer.dispose();
    },
  };
}
