# Mid90s Minifridge

### A minimal, centered sticker playground.

An interactive Three.js refrigerator and thirty-nine reference-led skate and band stickers on an animated pastel 90s shader stage. Hover the chrome handle to wake its neon glow, then click it to open a Windows 95 field with a modeled SURGE vending machine waiting in the distance. The fridge, hardware, printed paper, field, and vending machine remain real-time 3D. The interface uses high-contrast DM Sans typography and a wood-lined collection drawer, with the requested Revue font reserved for the top-left wordmark.

## Run it

**No setup:** open `Mid90s-Minifridge.html` in a modern browser. It includes Three.js, the HDRI, PBR maps, local typefaces, and all sticker artwork. No CDN, API key, or internet connection is needed.

**Edit the modular version:** Node 20.19+ or 22.12+ is recommended.

```bash
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. The server accepts preview-proxy hosts and binds to `0.0.0.0`.

```bash
npm run build       # Production static site in dist/
npm run standalone # Rebuild ../Mid90s-Minifridge.html with every asset embedded
```

The dependency is pinned to **Three.js 0.185.1**. The complete source uses ES modules; the standalone tool bundles them into one inline module.

> An embedded, sandboxed file preview can restrict local storage and downloads. For persistent arrangements and PNG downloads, use the live site or open the downloaded HTML in a normal browser tab. Interaction itself does not need storage or network access.

## Play

| Action             | Desktop                                                              | Touch / keyboard                                  |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------------- |
| Peel               | Hold a fridge sticker or drag one out of the collection              | Hold a drawer sticker, then drag                  |
| Re-stick           | Release over enamel                                                  | Lift your finger over enamel                      |
| Cancel a drop      | Release outside the fridge, or press Escape                          | Release outside the fridge                        |
| Explore            | Drag empty space to orbit; right-drag to pan                         | Drag empty space; two-finger pan                  |
| Zoom               | Scroll or use the + / − keyboard keys                                | Pinch                                             |
| Place from drawer  | Drag onto enamel, or click to pick then click the fridge             | Hold and drag, or tap to pick then tap the fridge |
| Keyboard placement | Focus a drawer card and press Enter; use arrows / brackets to adjust | Keyboard if connected                             |
| Open the fridge     | Hover, then click the chrome handle                                 | Tap the handle                                    |
| Travel the field   | Scroll to approach; drag to look around                             | Drag / pinch                                      |
| Reset camera       | Click the top-left wordmark; Esc exits the field                     | Tap the top-left wordmark                         |
| Move selected      | Arrow keys                                                           | Keyboard if connected                             |
| Rotate selected    | `[` / `]`                                                            | Keyboard if connected                             |
| Fine adjustment    | Hold Shift with arrow / bracket keys                                 | —                                                 |

Additional controls: three enamel finishes (Buttermilk, Sea glass, and Hunter green), optional gesture-unlocked peel/thunk sounds, wordmark-based view reset, a category-filtered wooden sticker drawer, custom image upload, and a two-click “Start fresh” reset. The reset/zoom/snapshot toolbar and normal-action hover/toast overlays have been removed. Snapshot export remains available through the inspection API, not as an on-screen control. Arrangements and custom stickers are stored locally on the current browser origin; nothing is uploaded to a server.

## Source structure

| File                                     | Responsibility                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/scene.js`                           | Renderer, animated pastel shader backdrop, camera, and damped OrbitControls                    |
| `src/portal.js`                          | Windows 95 field, 3D SURGE vending machine, field navigation, and portal state                 |
| `src/lighting.js`                        | Warm key, fill/rim lights, real HDRI + procedural fallback                                      |
| `src/textures.js`                        | Downloaded PBR maps, procedural micrograin/scuffs/fingerprint roughness                         |
| `src/fridge.js`                          | Rounded cabinet and single door, gasket, chrome hardware, condenser, placement surfaces         |
| `src/sticker-catalog.js`                 | Thirty-nine graphics, image paths, physical sizes, starting positions, and gallery categories   |
| `src/sticker-art.js`                     | Loads transparent reference cutouts; creates silver undersides, shadows and alpha masks         |
| `src/stickers.js`                        | Segmented meshes, two-sided materials, curl deformation, spring settling, resource disposal     |
| `src/interaction.js`                     | Alpha-aware raycasting, hold/drag/drop, surface constraints, pointer capture, keyboard gestures |
| `src/collection-drawer.js`               | Desktop/touch card gestures, vertical touch scrolling, pointer handoff, drawer opening/closing  |
| `src/brand-peel.js`                      | Shared-SVG middle crumples and edge curl, reflective back, timed press-down animation           |
| `src/drawer.css`                         | Wood texture, inset rails/compartments, drawer transitions and wordmark 3D layers               |
| `src/main.js`                            | Initialization/loading, dialogs, filters, upload/export, persistence, animation loop            |
| `src/utils.js`                           | Deterministic noise, asset helpers, local Web Audio effects                                     |
| `src/styles.css`                         | Responsive interface, embedded-compatible local fonts and reduced-motion support                |
| `src/minimal-theme.css`                  | Unified DM Sans UI, neutral palette, clean labels and restrained controls                       |
| `src/90s-portal-theme.css`               | High-contrast pastel-stage and Windows-field portal chrome                                      |
| `artwork/mid90s-minifridge-wordmark.svg` | Outlined Revue wordmark; no font binary or runtime font download                                |
| `tools/make-wordmark.py`                 | Regenerates the SVG and inline header from a separately obtained font file                      |
| `tools/standalone.mjs`                   | Offline single-file packaging                                                                   |

## The peel, first

The important implementation is `Sticker.deform()` in `src/stickers.js`.

```js
// A plane has a 36 × 28 grid, and a selectable local peel direction.
q = x * direction.x + y * direction.y;
hinge = span - span * 1.49 * peelAmount;
radius = span * 0.555;

if (q > hinge) {
  theta = (q - hinge) / radius;
  shift = hinge + radius * Math.sin(theta) - q;
  x += direction.x * shift;
  y += direction.y * shift;
  z = radius * (1 - Math.cos(theta));
}
```

This is cylindrical bending, not merely translating/rotating a rigid card. Beyond 90° of bend, the **silver BackSide material becomes visible**. Front and back share the deformed geometry and alpha silhouette. Vertex normals are recomputed when the deformation changes, so specular reflections follow the curl. A small damped spring and lift settle the sheet on release.

The printed side casts double-sided soft shadows; its separate reflective back does not duplicate the shadow pass. An alpha-shaped, blurred contact layer supplies local occlusion. Shadow maps are only refreshed when the paper moves or bends.

**Why not `DecalGeometry` for these stickers?** A baked decal is useful for static, arbitrary curved geometry, but does not provide a regular bendable grid or an adhesive back. This version supports the fridge’s flat front, side, top, and back surfaces. Drops near rounded edges are inset so the paper remains supported; paper does not wrap across corners, door seams, or hardware. A scanned, irregular `.glb` would need a projection/conformity step added to this deformation system.

## Asset guide

### 1. Enamel / painted-metal PBR

The project includes **downloaded** 1K painted-metal maps from [ambientCG PaintedMetal012](https://ambientcg.com/a/PaintedMetal012). These are not placeholder URLs. They are compressed for the web, and the color/wear intensity is deliberately blended down in `makeEnamelTextures()` to suggest cared-for enamel rather than a badly rusted surface. Fine grain, small scratches, and fingerprint-oil variation are procedural supplements. The model is not a scanned refrigerator.

Replace these local files with your own PBR set:

```
public/assets/enamel-color.jpg       # sRGB base color
public/assets/enamel-normal.jpg      # Linear OpenGL / +Y tangent-space normal
public/assets/enamel-roughness.jpg   # Linear roughness, not glossiness
```

Use [ambientCG](https://ambientcg.com/) or [Poly Haven textures](https://polyhaven.com/textures) for replacement painted-metal/enamel materials. Both libraries publish their assets under CC0; see the [ambientCG license](https://docs.ambientcg.com/license/) and [Poly Haven license](https://polyhaven.com/license).

For Buttermilk and Sea glass, `fridge.js` uses metalness `0.67`, clearcoat `0.48`, and roughness multiplier `0.67`; their existing aged PBR maps are unchanged. Hunter green replaces the former Harvest gold slot with a deep `#183b29` satin enamel: constant roughness `0.42`, a paint-like metalness of `0.10`, specular intensity `0.22`, clearcoat `0.06`, clearcoat roughness `0.28`, and very faint normal detail (`0.004`). Its color/scuff and roughness maps are bypassed for a smooth, clean finish; selecting another color restores its original maps. Saved `gold` selections automatically resolve to `hunter`.

### 2. HDRI

Bundled: [Poly Haven — Studio Small 09](https://polyhaven.com/a/studio_small_09), **1K HDR**, by Sergej Majboroda, CC0. It is prefiltered with PMREM for chrome, enamel, and adhesive reflections. The HDRI affects reflections only; the visible exterior is the animated shader backdrop and the interior uses the field portal.

To change the room, choose a garage, workshop, kitchen, or soft studio environment from [Poly Haven HDRIs](https://polyhaven.com/hdris), add its `.hdr` to `public/assets`, and change the `asset(...)` filename in `lighting.js`. A 1K–2K HDR is a good web compromise. A procedural `RoomEnvironment` remains available if the HDR cannot load.

### 3. Your own sticker PNGs

The easiest route is **The sticker collection → Add your own sticker**. Transparent PNG or WEBP gives a die-cut shape; JPEG produces a rectangular sticker. Files stay on the device. Upload limits are 8 MB and 16 megapixels, with a maximum of 30 stickers on the fridge. Uploaded artwork is resized for rendering, then used to generate a matching silver back and contact shadow automatically.

From an ES module after initialization:

```js
import { asset, loadImage } from "./utils.js";

const image = await loadImage(asset("garage-crew.png"));
const sticker = await stickers.addCustom(image, "Garage Crew", {
  id: "custom-garage-crew",
});
sticker.setPlacement({ surface: "front", u: 0.3, v: -0.8 });
stickers.onChange();
```

Place `garage-crew.png` in `public/assets/`. Use a stable, unique ID and avoid adding it a second time if it was already restored from local storage. Run `npm run standalone` again to embed newly added local assets.

### 4. An optional scanned / modeled fridge

For a higher-detail production model, search [Sketchfab for “retro refrigerator”](https://sketchfab.com/search?type=models&q=retro%20refrigerator). Check the **individual model’s download availability, license, and attribution requirements**—Sketchfab is not a uniformly CC0 library.

Load a selected `.glb` with Three’s `GLTFLoader`, substitute it for the procedural cabinet in `fridge.js`, and update the placement surfaces and raycast mesh list. Do not assume an arbitrary GLB shares this model’s dimensions or axes. If embedding it in the standalone build, add `.glb: 'model/gltf-binary'` to the packager’s MIME table.

## Reference-led sticker collection

The original fictional skate/surf artwork has been replaced with the supplied reference graphics and four matching classic-brand references. **The fridge stays centered; the removed hero text does not return.** Each graphic is an individual, transparent die-cut texture—not a photograph of a whole sticker sheet.

- **Established logos:** Santa Cruz, Creature, Vans, Zumiez, 187 Killer Pads, Bullet, Independent.
- **Established graphics:** Pat Duffy, Speed Face, Spitfire, Toy Machine, Alien Workshop, Journeys, Rainbow Melt.

Ten designs are isolated directly from `s-l1200-2.jpg`. The first photo guides the Santa Cruz / Speed Wheels / Bullet / Independent additions. Matching higher-resolution references were used for these four additions rather than magnifying the small collection photograph. **Rainbow Melt** is a descriptive label for the figure in the reference, not an asserted brand identification. The selection evokes the skate-shop aesthetic; it is not a claim that every pictured sticker was released in the 1990s.

Editable transparent PNG masters are in `artwork/stickers/`. Production textures are compact WebP files with alpha in `public/assets/sticker-*.webp`. All are embedded by the standalone builder.

`src/sticker-catalog.js` controls the image, physical dimensions, angle and initial placement. Preserve the image aspect ratio when changing a size. `StickerManager.loadCatalog()` loads the art concurrently and updates the loading indicator. Missing replacement files get an explicit, usable **IMAGE UNAVAILABLE** placeholder.

To update a PNG master and re-optimize it:

```bash
# Optional image tooling; not required to run or build the supplied website.
pip install pillow
python tools/optimize_stickers.py
npm run standalone
```

`tools/extract_stickers.py` documents the optional extraction of the ten supplied-photo designs. It expects the reference photo at `../uploads/s-l1200-2.jpg` and requires Pillow, NumPy, and OpenCV. The already-extracted masters ship with the source; the original uploads are not repackaged.

**Credits and reuse:** these are recognizable brand graphics, not newly invented logos or CC0 sticker art. See [STICKER-CREDITS.md](STICKER-CREDITS.md) for provenance and source URLs. Brand/artwork rights remain with their owners; source attribution is not permission for commercial redistribution. The PBR/HDRI CC0 terms below do not apply to the stickers.

**Saved layouts and rename:** the established fourteen IDs and default positions are unchanged. Ten new IDs are appended. The renamed app reads `mid90s-minifridge-v1` first and falls back to the previous `cold-storage-v1` key, preserving saved placements, finish, sound, and uploaded graphics. The original allowance of **16 custom uploads** remains available in addition to the built-in collection (now 39 + 16 = 55). The `window.coldStorage` inspection alias is retained for existing integrations; the canonical API is `window.mid90sMinifridge`.

## Ten-sticker expansion

All ten designs from the latest supplied `s-l1200-3.jpg` photograph have been added, not substituted for existing artwork:

| New sticker               | Default location |
| ------------------------- | ---------------- |
| Black Label               | Left side        |
| Alien Workshop · Spectrum | Left side        |
| Anti Hero                 | Left side        |
| DVS                       | Left side        |
| Independent · Crossbar    | Left side        |
| Plan B                    | Left side        |
| Element                   | Left side        |
| Krooked                   | Left side        |
| Krux                      | Upper right side |
| éS                        | Right side       |

This established skate set contains **24 built-ins: 15 logos and 9 graphics**. They remain available alongside the 15 band additions described below; drawer picks now use the drag/tap placement workflow. The original placements are preserved, so the new graphics occupy available side panels rather than covering the established front collage.

Each new graphic has its own transparent PNG master, optimized alpha WebP texture, two-sided deformable mesh, reflective back, contact shadow, and alpha-aware picking. The pale grid/tabletop in the photograph is not part of a sticker. `tools/extract-expansion.py` documents the extraction; the ready-to-use assets are included.

The app, document title, accessible wordmark name, snapshot branding/download name, package name, and canonical deliverables are now **Mid90s Minifridge**. The top-left SVG was regenerated from the requested Revue font; other typography is unchanged. The font-use notes still apply.

The standalone tool writes `../Mid90s-Minifridge.html` and refreshes the old `../Cold-Storage.html` filename as a compatibility alias for earlier download links. The source archive is `Mid90s-Minifridge-Source.zip`.

## Wooden drawer + band pack

The supplied `90s-bands-sticker-pack.jpg` adds **15 connected die-cut band graphics**, bringing the collection to **39** (15 skate logos, 9 skate graphics, 15 bands). Foo Fighters, Radiohead, and Nirvana each retain their connected emblem-and-name backing as one sticker.

The existing 24 stickers keep their placements. The new band graphics start **in the drawer**, ready to place, rather than covering the existing arrangement. The band pack appears first in the collection and has a dedicated **Bands** filter. All 39 have their own full-resolution front, silver back, alpha mask and deformable mesh; a sticker resting in the drawer is not rendered or raycast in the 3D scene.

### Grab and place

- **Mouse:** drag or briefly hold a card to lift its actual 3D sticker into the scene. The drawer slides away so the canvas can receive the drop.
- **Touch:** a quick vertical swipe over a card scrolls the drawer; a hold or horizontal pull picks up the sticker. Scroll momentum is disabled under reduced motion.
- **Click / tap alternative:** click or tap a card to pick it up, then click/tap the fridge to place it. Escape cancels.
- **Keyboard:** focus a card and press Enter to place/select it; arrows and brackets adjust it. The drawer's instructions and the About dialog document these controls.
- **Already placed:** dragging its card moves the existing sticker—it does not create a duplicate. Placed stickers have a small checkmark in the drawer.
- **Invalid drop / cancellation:** an unplaced sticker returns to the drawer; an already-placed sticker returns to its prior position. No informational toast is shown.

### Shader stage, handle affordance, and field portal

The fridge now sits in a procedural pastel shader stage inspired by the supplied abstract 90s reference. The stage uses animated warped color ribbons, soft grain, and a dark plum edge falloff, while the header, wordmark, finish picker, icons, and footer use ink-dark glass treatments for reliable contrast.

The chrome handle is a first-class raycast target. Hovering changes its chrome color, adds emissive magenta light, enables a larger additive glow tube, and reveals an “Open the fridge” hint. Clicking swaps to a second Three.js mode: the supplied field image becomes the Windows desktop-style horizon, a green 3D SURGE machine is assembled from rounded cabinet parts, textured graphics, payment hardware, an extruded can, a turquoise pallet, and the supplied vending-machine photo as a small side decal. The portal has relaxed orbit bounds, scroll dolly navigation, a distance readout, and Esc / Back to fridge controls.

### Quieter scene and revised badge

The floating sticker-name/drag/selection overlays and finish-change toasts are removed. Error messages are retained where needed; unavailable storage is reported in the drawer's save note instead of a color-change toast. There is no reset/zoom/snapshot toolbar. Scroll/pinch and the + / − keys still zoom, and clicking the top-left wordmark resets the view without changing the sticker arrangement.

The Revue wordmark uses 56 connected CSS-3D paper strips sharing its original SVG outline. Hover raises three uneven ridges through the middle of the lettering, with upward displacement, perspective and directional fold shading, while retaining the metallic edge curl. At desktop size the strongest middle fold lifts roughly 32 px toward the viewer and about 9 px upward. Integrated, shared strip endpoints keep the lettering connected rather than separating it into floating slices. Clicking still flattens every fold in a 150 ms press-down gesture and resets the camera. The original unsliced SVG is shown at rest for sharp text and no idle animation work. Reduced-motion preferences soften the effect. The font remains confined to this wordmark.

The Evercool manufacturer badge is now one centered group. Its texture is trimmed to its visible lettering, the chrome star sits approximately 0.055 scene units from the script, and the lockup leaves approximately 0.269 scene units below the top of the door. The original badge styling is otherwise retained.

### Wood asset and persistence

The drawer uses the downloaded **ambientCG Wood051** color texture, with a mild brightness/color adjustment and optimized JPEG encoding. Inset CSS rails, compartments, shadows and a small metal pull supply the depth cues. Source: https://ambientcg.com/a/Wood051 — CC0, https://docs.ambientcg.com/license/. This is a textured interface panel, not a return of the removed 3D room background.

Saved format version 3 adds the `placed` Boolean. Older stored stickers without that field remain on the fridge. Old layouts, finishes and all 16 custom uploads are retained. Total capacity is now 39 built-ins plus 16 uploads. A reset returns the band set to the drawer and keeps the established default skate arrangement.

## Minimal art direction

- **Background:** the fridge uses a custom animated GLSL pastel shader backdrop. The inside state uses the supplied `field.jpg` horizon and a navigable field plane; the portal's bright wallpaper and UI panels are kept readable with navy ink and translucent light glass.
- **Typography:** interface labels, menus, dialogs and export labels use **DM Sans**. Only the top-left `Mid90s Minifridge` wordmark uses the requested **Revue Regular**, from the user-specified Font.Download page, rendered as a responsive inline SVG using the actual font outlines and HarfBuzz shaping. No global font-family change is made. The vintage appliance badge and sticker artwork retain their original lettering.
- **Wordmark embedding and terms:** `artwork/mid90s-minifridge-wordmark.svg` is the vector master; the same paths are inlined in the `#home` button. Revue is rendered from the actual font using HarfBuzz shaping, so the existing CSS-3D peel and click-to-reset animation continues to work. The font binary is not shipped. The supplied source labels Revue **free for personal use**; obtain an appropriate license before public/commercial use. Converting text to SVG does not remove licensing obligations. See `licenses/Revue-Usage-Notes.txt`. Source: [Font.Download](https://font.download/font/revue).
- **Finish picker:** rounded-square color chips (22 × 22 px) sit inside 32 × 32 px buttons. Zero padding and grid centering make the selected white border exactly concentric on desktop, tablet and mobile. Transparent borders reserve the same space in unselected states; hover does not scale or shift the chip.
- **Controls:** neutral black/gray stage controls and centered square finish swatches; the collection panel uses wood and muted brass tones. No floating sticker tooltips or normal finish-change toasts. The header is the reset control; the old view toolbar is absent.
- **Lighting:** soft, near-neutral studio key/fill/rim lighting keeps the enamel and chrome readable on black. The HDRI is used only for reflections; it is not displayed as scenery. Metallic adhesive backs and sticker contact shadows remain intact.
- **Editing:** the original viewer treatment remains in `src/minimal-theme.css`; stage and portal chrome live in `src/90s-portal-theme.css`. The standalone packager embeds both together with `src/styles.css`, `src/drawer.css`, the reference images, wood image, and local font files. Scene/background and camera framing are in `src/scene.js`.
- **Continuity:** the fridge remains centered across viewport sizes. Existing sticker IDs, layouts, uploads, finishes and sound preferences are retained; the revised drawer-placement controls are documented above.

To regenerate the outlined wordmark after obtaining the font and appropriate permission:

```bash
pip install fonttools uharfbuzz
python tools/make-wordmark.py /path/to/reve.ttf
npm run standalone
```

The generator updates both the SVG master and the inline header. It does not copy the font into the project. The `#home .brand-wordmark` CSS rule controls display size; it is independent of the rest of the typography.

## Rendering / performance notes

- ACES Filmic tone mapping, sRGB output, physically correct current Three lighting, real PMREM reflections, warm key/fill/rim setup, soft shadows and contact occlusion on a true black backdrop.
- In **r185**, Three merged the deprecated `PCFSoftShadowMap` behavior into `PCFShadowMap`. The code chooses the current PCF implementation on r185 and the older soft-shadow constant on older releases.
- A 60 fps **target**, not a hardware guarantee. Pixel ratio is capped at 1.75 on desktop and 1.5 on mobile; changing paper meshes recompute normals, idle ones do not. Rendering pauses in hidden tabs. Shadow maps are not re-rendered for a simple camera orbit.
- No heavy bloom, physics engine, remote API, or postprocessing chain. Specular sheen comes from the PBR/HDRI setup.
- Removed custom stickers dispose their geometries, materials, and textures. Page teardown also releases scene resources.
- Reduced-motion preferences simplify the curl response. Keyboard selection is available in the collection. Touch gestures use pointer capture and `touch-action: none`.
- No ground plane is rendered in the exterior fridge view. The field portal intentionally adds a large grass plane so scroll navigation has a horizon and a place for the SURGE machine's shadow; alpha-shaped contact shadows remain on the fridge underneath stickers.
- Default desktop inspection for this edition: 117 main-pass draw calls and approximately 129,154 main-pass triangles. These are scene-complexity observations, not a measured hardware frame rate.

## Checks

```bash
npx playwright install --with-deps chromium
npm run standalone
node tools/test-drawer.mjs
node tools/test-inventory.mjs
node tools/test-wordmark.mjs
node tools/test-hunter-green.mjs
```

The drawer check covers all 39 cutouts, initial inventory state, the compact badge, removed overlays/toolbar, quiet color changes, hover and click wordmark states, mouse drag-to-place, invalid drops, click-to-place, persisted placement, touch drawer scrolling, and real touch handoff onto the fridge. The inventory check covers keyboard placement/adjustment, Escape, existing fridge dragging, all 16 legacy uploads, and an offline opaque-origin sandboxed preview.

Tests step the physics manually on a software GPU; they are not hardware frame-rate benchmarks. `window.mid90sMinifridge` exposes `app`, `fridge`, `stickers`, `interaction`, `collection`, `brandPeel`, `takeSnapshot`, `save`, `reset`, and `pause(true/false)`. The legacy `window.coldStorage` alias remains available.

## Credits / licenses

- Three.js: MIT, included in `licenses/Three-MIT.txt`.
- ambientCG PaintedMetal012, ambientCG Wood051, and Poly Haven Studio Small 09: CC0; asset/license links above.
- DM Sans, Instrument Serif, IBM Plex Mono, and Barlow Condensed: SIL Open Font License. Permanent Marker: Apache License 2.0. Full license files are in `licenses/` and embedded as notices in the standalone HTML.
- Header wordmark: Revue Regular, rendered as SVG from the requested Font.Download source. The source lists personal-use permission only; public/commercial use needs appropriate licensing. No font binary is shipped. See `licenses/Revue-Usage-Notes.txt`.
- Sticker graphics: supplied photos and credited brand references; see `STICKER-CREDITS.md`. They are not claimed as original project illustrations or CC0 assets. The fridge geometry and interface design are made for this project. No analytics, accounts, or tracking pixels are included.
