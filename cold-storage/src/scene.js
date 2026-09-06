import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clamp } from "./utils.js";

function createShaderBackdrop() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uResolution;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p = p * 2.03 + vec2(7.1, 2.8);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        p.x *= uResolution.x / max(uResolution.y, 1.0);
        float time = uTime * 0.075;
        vec2 warp = vec2(
          sin(p.y * 3.7 + time * 1.4),
          cos(p.x * 3.2 - time * 1.1)
        ) * 0.16;
        vec2 q = p + warp + vec2(time * 0.22, -time * 0.12);
        float cloud = fbm(q * 0.92 + vec2(1.5, -0.7));
        float ribbons = 0.5 + 0.5 * sin(
          q.x * 3.65 + sin(q.y * 4.1 + cloud * 3.0) * 1.9 + time
        );
        ribbons = smoothstep(0.2, 0.82, ribbons);
        float glow = smoothstep(0.72, 0.05, abs(sin(q.x * 1.8 - q.y * 2.1 + cloud * 2.7)));

        vec3 rose = vec3(0.97, 0.63, 0.78);
        vec3 periwinkle = vec3(0.56, 0.66, 0.98);
        vec3 aqua = vec3(0.45, 0.94, 0.86);
        vec3 cream = vec3(1.0, 0.86, 0.76);
        vec3 lavender = vec3(0.74, 0.52, 0.94);
        vec3 color = mix(rose, periwinkle, smoothstep(0.12, 0.82, cloud));
        color = mix(color, aqua, smoothstep(0.45, 0.96, ribbons) * 0.7);
        color = mix(color, cream, smoothstep(0.34, 0.9, glow) * 0.42);
        color = mix(color, lavender, smoothstep(0.7, 1.0, cloud) * 0.48);

        float grain = (hash(vUv * uResolution + uTime) - 0.5) * 0.035;
        float vignette = smoothstep(1.55, 0.22, length(p * vec2(0.52, 0.72)));
        color = mix(vec3(0.17, 0.11, 0.29), color, 0.72 + vignette * 0.28);
        color += grain;
        gl_FragColor = vec4(max(color, 0.0), 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), material);
  mesh.name = "animated 90s shader backdrop";
  mesh.position.set(0, 0, -30);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}

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
  const backdrop = createShaderBackdrop();
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
    backdrop.material.uniforms.uResolution.value.set(width, height);

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
    backdrop.material.uniforms.uTime.value += dt;
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
      backdrop.geometry.dispose();
      backdrop.material.dispose();
      renderer.dispose();
    },
  };
}
