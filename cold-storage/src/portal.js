import * as THREE from "three";

/** A real window in the doorway. Every transition frame the field is rendered
 *  into a render target from a camera whose pose is the main camera's pose
 *  translated into field space (the doorway maps to a "gate" at the field
 *  spawn). The doorway plane then samples that render in screen space, so the
 *  opening behaves like true glass: correct parallax while the door swings,
 *  and when the camera reaches the threshold the doorway fills the frame with
 *  exactly what the field camera will show — the scene swap is invisible. */

const DOOR_ANCHOR = new THREE.Vector3(0, 0.14, 1.0);

export function createPortal(renderer) {
  const group = new THREE.Group();
  group.name = "field portal";
  group.visible = false;
  const viewCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 700);
  viewCamera.name = "portal view camera";
  let target = null;
  const bufferSize = new THREE.Vector2();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      portalMap: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */ `
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    // Screen-space sampling: whatever sliver of the plane the door reveals
    // shows the matching sliver of the field render. The target stores the
    // usual tone-mapped linear output, so only the sRGB step runs here.
    fragmentShader: /* glsl */ `
      uniform sampler2D portalMap;
      uniform vec2 resolution;
      void main() {
        gl_FragColor = texture2D(portalMap, gl_FragCoord.xy / resolution);
        #include <colorspace_fragment>
      }
    `,
  });
  // In front of the cabinet's face (z = 1.01) so the view is never buried in
  // enamel; the closed door still conceals it completely.
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 4.95), material);
  plane.name = "bliss doorway";
  plane.position.set(0, 0.14, 1.02);
  group.add(plane);
  const light = new THREE.RectAreaLight(0xe4f7e2, 0, 2.6, 4.8);
  light.position.set(0, 0.14, 1.03);
  light.lookAt(0, 0.14, 8);
  group.add(light);

  function ensureTarget() {
    renderer.getDrawingBufferSize(bufferSize);
    const width = Math.min(2048, Math.max(2, Math.round(bufferSize.x)));
    const height = Math.min(2048, Math.max(2, Math.round(bufferSize.y)));
    if (target && target.width === width && target.height === height) return;
    target?.dispose();
    target = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      samples: 4,
    });
    material.uniforms.portalMap.value = target.texture;
  }
  /** Render the field as seen "through" the doorway for the current camera. */
  function renderView(field, mainCamera) {
    ensureTarget();
    material.uniforms.resolution.value.copy(bufferSize);
    viewCamera.fov = mainCamera.fov;
    viewCamera.aspect = mainCamera.aspect;
    viewCamera.updateProjectionMatrix();
    viewCamera.position
      .copy(mainCamera.position)
      .sub(DOOR_ANCHOR)
      .add(field.gate);
    viewCamera.quaternion.copy(mainCamera.quaternion);
    viewCamera.updateMatrixWorld(true);
    renderer.setRenderTarget(target);
    renderer.render(field.scene, viewCamera);
    renderer.setRenderTarget(null);
  }
  function setAmount(t) {
    group.visible = t > 0.001;
    light.intensity = 12 * t;
  }
  return {
    group,
    plane,
    viewCamera,
    renderView,
    setAmount,
    dispose() {
      target?.dispose();
      plane.geometry.dispose();
      material.dispose();
    },
  };
}
