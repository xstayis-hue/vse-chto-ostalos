# Audit notes

This file records the audit summary used for the current cleanup pass.

## Audit pass 2026-11-28

A user-facing audit of the whole path (title → six frames → death → ascent →
space → ending) in a real browser, then the fixes it produced.

Fixed:
- Earth left the frame within seconds of the ascent: orbital speed carried it
  away while the camera sat still. The world now turns with the camera while
  the traveller is still near Earth, and a one-time line says the planet is
  behind.
- The ending was unreachable without a hidden condition. The signal now opens
  at 480 R from the Sun, the second "Прислушаться" says where to look, and the
  first listen no longer counts as the final one.
- The result was always empty: `RUN.memories` was never filled, so every run
  said "передавать было нечего". Fragments now count the scenes actually seen,
  and the signal branch belongs to the biography instead of a flag nobody set.
- The ending hid its buttons for 45 seconds. Now 20 (`?silence=0` for tests),
  and the copy no longer promises a silence it does not have.
- 72 scenes collapsed onto 35 plates, 11 of them onto one bedroom. Plates are
  now assigned as one table: closest in time, least used, never the same room
  twice in one life → 42 plates, max 4 uses.
- Small 9px text at 3.8:1 contrast → 6.3:1; the 320px title no longer wraps
  into five lines; the keepsake no longer sits under the buttons.
- The death screen was a black gap. The last room now stays behind the text.
- Heartbeat never played (`DyingFrame.attach` was never called); memory frames
  had no way out but a restart; the sound choice was not remembered; the back
  button did not exist inside Telegram; the native `confirm()` is now an
  in-app card.
- Sharing: verb agreed with the protagonist instead of the player, the name was
  not inflected, the branch was shouted in caps, and the link led to the site
  instead of the bot. Now the text is a readable sentence and the link opens
  `@pxaxspase_bot`.
- One Moon: the 3D scene drew Earth's real Moon plus a second duplicate.
- Second-person slips in three scenes ("мать сидела с тобой", "ваш смех").

Still open:
- Photographic plates are not cached offline by `sw.js` (large, first view
  needs network).
- Verify on physical iPhone and Android Telegram WebView.
- `assets/photographic/` (23 MB), `memory-world.js` and `pixel-memories.js` are
  still in the repository but not on the runtime path.
- Documents (PROMT.md, PROGRESS.md) still describe the 300-life / pixel-renderer
  version.

## Audit pass 2026-11-16

- Restored a long silence before the ending actions (45 s then; 20 s now).
- Share text no longer shows archive percent or expedition counts.
- `memory-world` WebGL renderer released on `pagehide`.
- `pixel-memories.js` removed from the main page (still used by `pixel-lab.html`).
- Removed unused `assets/milky-way-8k.jpg` and `assets/departure-orbit.mp4`.
- Bumped `?v=` and the service worker cache (`ostalos-experience-v2`).

## Remaining follow-up

- Decide: restore memory choices or remove the unused choice branches and 1500 blocks in `content.js`.
- Photographic plates are not cached offline by `sw.js` (large, first-view network needed).
- Verify the final build on iPhone and Android Telegram WebView.
- Review the remaining asset attribution and the external Telegram SDK dependency.

## Проверено после правок 2026-11-28

Путь целиком пройден в Chromium на 320×706: титул → шесть кадров → смерть →
взлёт → космос → сигнал → финал → «другая жизнь». Консоль без ошибок,
Lighthouse accessibility / best-practices / SEO — по 100. Резервный 2D-рендер
космоса проверен с отключённым `THREE`. `npm test`: 34/34.

Нужно проверить на живых устройствах: iPhone и Android в Telegram (звук,
«Сохранить» в WebView, нагрев на длинном полёте).
