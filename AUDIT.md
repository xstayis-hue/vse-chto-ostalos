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

## Remaining follow-up

- Verify the final build on iPhone and Android Telegram WebView.
- Add the repository remote if this canonical copy is to be pushed independently.
- Review the remaining asset attribution and the external Telegram SDK dependency.
