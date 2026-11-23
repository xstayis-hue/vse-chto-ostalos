# Credits

- `assets/three.min.js` - Three.js r160, MIT License.
- Planet and moon surface textures, Saturn ring map, Earth night lights and clouds: repository notes credit [Solar System Scope](https://www.solarsystemscope.com/textures/) and NASA imagery. Solar System Scope lists its textures under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Exact upstream mapping, including the Milky Way mosaic, still needs verification before redistribution under a specific license.
- `assets/star-catalog.js` - star positions and B-V colours from d3-celestial `stars.6` (Hipparcos / Yale Bright Star Catalogue, magnitudes ≤ 6).
- `assets/moons/{io,europa,ganymede,callisto,titan,triton}.jpg` - generated with PlusVibe `flux-3-klein` for this project.
- `assets/sun-api-candidate.jpg` - generated with PlusVibe `flux-3-klein` for this project.
- `assets/photographic/*-plate.jpg`, `*-actor.jpg`, `kitchen.jpg` - generated once during development with Seedream 5.0 Flash through PlusVibe. Scene backgrounds and actor cutouts are bundled locally. Runtime frame generation uses Canvas/WebGL only. Job IDs and confirmed charges are in `assets/photographic/*ledger.json`.

This project is a browser prototype of a Telegram Mini App.

## Rendering notes

`space-scene.js` renders linear light into a half-float target and applies one ACES
tonemap in the final composite pass, then encodes to sRGB. Material shaders therefore
must not tonemap on their own, and sRGB textures arrive already decoded by the GPU
(three.js uploads them as `SRGB8_ALPHA8` on WebGL2), so shaders sample them raw.
