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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type =
    Number(THREE.REVISION) >= 185 ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = null;
  // The exterior deliberately clears to exact black. Keep a named scene node so
  // the portal can share the same visibility contract without adding scenery.
  const backdrop = new THREE.Object3D();
  backdrop.name = "minimal black exterior backdrop";
  backdrop.visible = false;
  scene.add(backdrop);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 120);
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

  let mode = "fridge";
  let defaultDistance = 14.2;
  let mobile = false;
  let resetTween = null;
  let fridgeMinDistance = 7;
  let fridgeMaxDistance = 18;
  const defaultTarget = new THREE.Vector3(0, -0.1, 0.26);
  const defaultDirection = new THREE.Vector3(0.3, 0.075, 1).normalize();

  function reset(instant = false, normal = null) {
    if (mode !== "fridge") return;
    const direction = normal
      ? new THREE.Vector3(normal.x, 0.085, normal.z).normalize()
      : defaultDirection;
    if (direction.lengthSq() < 0.2) direction.copy(defaultDirection);
    const toTarget = defaultTarget.clone();
    const toPosition = toTarget
      .clone()
      .addScaledVector(direction, defaultDistance);
    if (instant) setView(toPosition, toTarget, true);
    else setView(toPosition, toTarget, false);
  }

  function setView(position, target, instant = false) {
    resetTween = null;
    const toPosition = position.clone();
    const toTarget = target.clone();
    if (instant) {
      controls.target.copy(toTarget);
      camera.position.copy(toPosition);
      controls.update();
    } else {
      resetTween = { position: toPosition, target: toTarget };
    }
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    mobile = width <= 800;
    camera.aspect = width / height;
    const canvasRect = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    if (mode === "portal") {
      camera.clearViewOffset();
      camera.fov = width <= 560 ? 44 : 40;
      camera.updateProjectionMatrix();
      return;
    }

    camera.clearViewOffset();
    camera.fov = width <= 560 ? 36 : 34;
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
    const verticalFit = (5.8 * height) / (2 * halfFovTangent * availableHeight);
    const horizontalFit =
      (3.45 * height) / (2 * halfFovTangent * availableWidth);
    defaultDistance = 0.9 + Math.max(verticalFit, horizontalFit);
    fridgeMinDistance = width <= 560 ? 10 : mobile ? 8 : 7;
    fridgeMaxDistance = Math.max(defaultDistance * 1.48, fridgeMinDistance + 2);
    controls.minDistance = fridgeMinDistance;
    controls.maxDistance = fridgeMaxDistance;
    camera.updateProjectionMatrix();
    reset(true);
  }

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    resetTween = null;
    if (mode === "portal") {
      controls.minDistance = 3.8;
      controls.maxDistance = 32;
      controls.minPolarAngle = 0.24;
      controls.maxPolarAngle = Math.PI * 0.62;
      controls.enablePan = true;
      camera.fov = camera.aspect <= 0.7 ? 44 : 40;
    } else {
      controls.minDistance = fridgeMinDistance;
      controls.maxDistance = fridgeMaxDistance;
      controls.minPolarAngle = Math.PI * 0.34;
      controls.maxPolarAngle = Math.PI * 0.53;
      controls.enablePan = true;
      camera.fov = camera.aspect <= 0.7 ? 36 : 34;
    }
    camera.updateProjectionMatrix();
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
      const alpha = 1 - Math.exp(-dt * (mode === "portal" ? 3.2 : 7));
      camera.position.lerp(resetTween.position, alpha);
      controls.target.lerp(resetTween.target, alpha);
      if (camera.position.distanceToSquared(resetTween.position) < 0.00001) {
        camera.position.copy(resetTween.position);
        controls.target.copy(resetTween.target);
        resetTween = null;
      }
    }
    const before = controls.target.clone();
    if (mode === "portal") {
      controls.target.x = clamp(controls.target.x, -30, 30);
      controls.target.y = clamp(controls.target.y, -9, 12);
      controls.target.z = clamp(controls.target.z, -30, 30);
    } else {
      controls.target.x = clamp(controls.target.x, -2.5, 2.5);
      controls.target.y = clamp(controls.target.y, -1.7, 1.7);
      controls.target.z = clamp(controls.target.z, -1.5, 1.5);
    }
    camera.position.add(controls.target.clone().sub(before));
    if (controls.enabled) controls.update();
  }

  function stopMotion() {
    resetTween = null;
    const position = camera.position.clone();
    const target = controls.target.clone();
    const damping = controls.enableDamping;
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
    backdrop,
    update,
    reset,
    setView,
    setMode,
    stopMotion,
    zoom,
    get mode() {
      return mode;
    },
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
