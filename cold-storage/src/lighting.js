import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { asset, withTimeout } from "./utils.js";

export function setupLighting(scene, renderer) {
  RectAreaLightUniformsLib.init();
  const key = new THREE.DirectionalLight(0xfff3e3, 2.6);
  key.position.set(-3.7, 6.2, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -5;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 25;
  key.shadow.normalBias = 0.012;
  key.shadow.bias = -0.00015;
  key.shadow.radius = 3;
  scene.add(key);
  const hemisphere = new THREE.HemisphereLight(0xecf0f4, 0x373b40, 0.8);
  scene.add(hemisphere);
  const fill = new THREE.RectAreaLight(0xe5edf7, 3.4, 4, 7);
  fill.position.set(4, 1.5, 5);
  fill.lookAt(0, 0.3, 0);
  scene.add(fill);
  const strip = new THREE.RectAreaLight(0xfff2e5, 4.3, 1.1, 5);
  strip.position.set(-4, 3, 1.5);
  strip.lookAt(0, 0.5, 0);
  scene.add(strip);
  const rim = new THREE.DirectionalLight(0xdfebf7, 1.65);
  rim.position.set(2, 5, -5);
  scene.add(rim);
  // Soft studio lighting keeps the enamel, chrome and paper readable on black.

  // Fast offline fallback, replaced by the bundled, real HDRI below.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const room = new RoomEnvironment();
  let envTarget = pmrem.fromScene(room, 0.04);
  room.dispose();
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.55;
  scene.environmentRotation.y = -0.65;
  const ready = (async () => {
    try {
      // REPLACE with any .hdr from Poly Haven: a garage/kitchen works particularly well.
      const hdr = await withTimeout(
        new HDRLoader().loadAsync(asset("studio_small_09_1k.hdr")),
      );
      const next = pmrem.fromEquirectangular(hdr);
      hdr.dispose();
      envTarget.dispose();
      envTarget = next;
      scene.environment = envTarget.texture;
      scene.environmentIntensity = 0.52;
    } catch (error) {
      console.info(
        "HDRI unavailable; using the procedural studio reflection environment.",
        error.message,
      );
    } finally {
      pmrem.dispose();
    }
  })();
  return {
    ready,
    dispose: () => {
      envTarget.dispose();
      key.shadow.dispose();
    },
  };
}
