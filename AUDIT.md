# Audit notes

This file records the audit summary used for the current cleanup pass.

## Current status

- Full browser prototype flow is playable.
- `npm test` passes 6 deterministic flight tests.
- Birth scene and memory choices are preserved.
- Cosmic events are opened through `Сканировать`.
- WebGL and canvas fallback paths are present.

## Cleanup completed

- Removed confirmed unused transition videos, duplicate Sun texture, local Telegram SDK copy and experimental model/variant files.
- Removed dead memory effect variables and unused scene state.
- Improved mobile memory layout, pixel canvas aspect ratio and text contrast.
- Added `CREDITS.md`.
- Fixed reduced motion text rendering, star opacity uniform, generated life numbering, overwrite confirmation and extended syntax coverage to `pixel-memories.js`.
- Added repository `origin`, `.gitignore`, package version/engine metadata and removed unused memory image assets.
- Removed dangling `image:` reference, dead signals state, phantom HUD writes (`#quality-state`, `#expedition-state`, `#d-sun-compact`), orphaned CSS blocks/keyframes; fixed archive numbering continuity (016–022).
- Converted the Sun surface texture to JPEG (`sun-api-candidate.jpg`, 2.0 MB → 0.27 MB).

## Remaining follow-up

- Verify the final build on iPhone and Android Telegram WebView.
- Review the remaining asset attribution and the external Telegram SDK dependency.
