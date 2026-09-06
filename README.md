# ENTRE — Studies in stillness

A local art gallery built with React, Vite, Bun, Tailwind CSS, GSAP, and Three.js. Twenty distinct original artworks stand in a spacious room you can explore freely by dragging, scrolling, or using the keyboard.

## Run locally

From this directory:

```sh
bun install
bun run dev
```

Open the local address printed in the terminal. The development server binds to `127.0.0.1`, so it is available only on your computer. No hosting account, cloud service, API key, or backend is required. No external fonts or image services are used at runtime.

```sh
bun run build     # Type-check and create dist/
bun run preview   # Serve the production build locally
```

The generated `dist` folder is the production build. Use a local server to view it; opening its HTML directly from the filesystem will not load ES modules correctly.

## Explore

- **Drag in Move mode:** travel sideways and forward/backward through the room. Movement is continuous, with damping that eases toward your input and settles smoothly after release.
- **Scroll:** travel forward/backward; horizontal trackpad scrolling moves sideways.
- **Look mode:** drag to turn the camera. Shift + drag or right-button drag also looks around.
- **WASD or arrow keys:** walk. Q/E turns left/right. Click or drag the room first if a button has keyboard focus.
- **Touch:** drag to move, use Look mode to turn, and pinch to travel forward/backward.
- **Map:** the dot shows your position and facing direction. Select a numbered print to move to it.
- **Reset view** or the ENTRE wordmark returns to the entrance.
- Click a print to open its close-up. The caption follows the work nearest the center of your view.
- “The collection” opens all twenty works; select one to travel to its location.
- The sun/moon button changes the lighting. Dragging, wheel/trackpad travel, looking around, and keyboard movement share frame-rate-independent damping. The pause/play control disables damping and animated travel, following your reduced-motion preference initially.
- Press Escape to close an overlay. Movement pauses while an overlay is open.

The gallery has gentle outer boundaries and collision checks around the prints. You can walk around the sides and see both faces of every work. Guided travel from the map moves directly to a comfortable viewing position.

## Project map

- `src/main.tsx`: interface, collection, artwork details, and navigation.
- `src/GalleryScene.tsx`: room, prints, lighting, soft shadows, camera motion, and depth of field.
- `src/artworks.ts`: artwork content and local image paths.
- `src/navigation.ts`: artwork layout, room bounds, camera-relative travel, collision checks, and damping. `CAMERA_DAMPING` controls the response speed; lower values settle more slowly.
- `tests/navigation.test.ts`: movement and collision regression checks (`bun run test`).
- `src/styles.css`: typography, layout, responsive design, and image-based fallback.
- `public/art/`: original generated artwork images, compressed as local JPEGs.

The layout uses five staggered positions per row and currently contains twenty works across four rows. Update `artworks.ts` to replace the content. If adding further rows, expand the room bounds and back wall in `navigation.ts` and `GalleryScene.tsx`. Portrait images with a 2:3 ratio fit the prints best.

## Rendering choices

Three.js provides real geometry, camera perspective, shadow mapping, and a Bokeh postprocessing pass. GSAP transitions artwork positions and lighting. Canvas-generated radial gradients provide soft contact shadows and bounced daylight. The artwork textures themselves contain the fine photographic light and material detail; this is a real-time gallery, not a path-traced architectural render.

Rendering resolution is capped at 1.5× device pixel ratio on desktop and 1.25× on narrow screens. Depth of field follows the artwork in front of the camera. Rendering pauses when the browser tab is hidden. If WebGL initialization or image loading fails, a simpler image-based layout appears; all collection and detail controls remain available. On devices with limited graphics performance, the reduced-motion control simplifies motion but does not disable depth-of-field rendering.

The project includes twenty distinct original AI-generated digital artworks, stored locally. Artwork names, exhibition copy, and the ENTRE identity are sample content for this project. No Blender files are required; Blender can be introduced later if you want custom architectural models or baked lighting.

## Validation

- Five navigation regression checks pass (51 assertions), including room boundaries, collision tunneling, camera-relative movement, and accessible viewing locations.
- TypeScript checks pass.
- Vite production build passes.
- Local development route responds with HTTP 200.
- Browser verification: dragging moved the camera to a different set of artworks; the collection listed all twenty works; selecting work 20 traveled to and rendered that artwork. No browser console errors were reported during these checks.
- Vite uses polling to detect file changes reliably in this workspace, with a fixed local port to prevent a stale preview from silently pointing elsewhere.

Nothing has been deployed online.
