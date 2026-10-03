# ENTRE — editable Blender gallery

Open `../entre-gallery.blend` in Blender. Created and verified with Blender 5.1.2.

The scene recreates the current website's 20 original artworks, woven translucent screens, narrow bronze frames, honed stone floor, window piers, ceiling ribs, and warm daylight. Cycles lighting approximates the web design rather than producing an identical WebGL image.

## Editing the scene

- **02 · Artwork displays**: each numbered collection contains an **ART** parent. Move or rotate that parent to keep its screen, front/reverse prints, frames, and foot together. The painting subjects are image textures on editable 3D prints, not separately sculpted objects.
- All 20 artwork images are **packed into the blend file**. It can be moved without a separate textures folder. To replace an image, open the artwork material's labelled image texture node.
- **01 · Architecture**: room and window geometry. The ceiling is hidden only in the editing viewport; it still renders. Screens stop just below the ceiling ribs to avoid intersecting surfaces.
- **03 · Warm daylight**: sun, window area lights, and entrance fill. Rotate the sun to change shadow direction; adjust its Angle to change softness.
- **04 · Cameras**: entrance, flower detail, and room overview. Each camera has a named focus target. Move the target or change F-Stop to adjust depth of field.

Press **Numpad 0** for the active camera and **F12** to render. Saved final settings: Cycles, 1920 × 1080, 96 samples, denoising. `preview.png` is a 1200 × 675 verification render.

## Rebuilding

`scene-data.json` records the current website's titles, asset paths, and artwork positions. `build_scene.py` creates the scene from those records and the existing files in `../public/art/`.

From the project folder, with Blender available on your command path:

```sh
blender --background --python blender/build_scene.py -- --preview
```

This rebuilds `entre-gallery.blend` in the project root. Save any personal Blender edits separately before rebuilding. The script retains Blender's normal previous-save backup.

Blender edits do not automatically update the React/Three.js website, and website edits do not automatically update this file.
