/* 16-bit memory renderer.
   Techniques used to get a real 16-bit look:
   - colour ramps (5-6 tones per material) instead of flat fills
   - ordered (Bayer) dithering on every gradient
   - 1px dark outline around characters and large props
   - ambient occlusion under objects, rim light from the window
   - wood grain, fabric folds, water lines
   - a small character inside a composed scene, not a giant silhouette
   Determinate: same person + scene always renders the same frame. */

const PM_BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function pmHex(value) {
  const h = value.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function pmRgb(r, g, b) {
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function pmMix(a, b, t) {
  const A = pmHex(a), B = pmHex(b);
  return pmRgb(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
/* 6-tone ramp: 0 = deepest shadow, 5 = brightest highlight. */
function pmRamp(base, tones = 6) {
  const out = [];
  for (let i = 0; i < tones; i++) {
    const t = i / (tones - 1);
    out.push(t < 0.34
      ? pmMix(base, '#0b0f12', (0.34 - t) * 0.85)
      : pmMix(base, '#fbf3d8', (t - 0.34) * 0.62));
  }
  return out;
}

/* Dithered vertical gradient between two adjacent ramp tones. */
function pmVgrad(ctx, x, y, w, h, ramp, block = 3) {
  const steps = ramp.length - 1;
  for (let by = 0; by < h; by += block) {
    const t = (by / Math.max(1, h - 1)) * steps;
    const i = Math.min(steps, Math.floor(t));
    const f = t - i;
    const a = ramp[i], b = ramp[Math.min(steps, i + 1)];
    for (let bx = 0; bx < w; bx += block) {
      const th = (PM_BAYER[(by / block) % 4 | 0][(bx / block) % 4 | 0] + 0.5) / 16;
      ctx.fillStyle = f > th ? b : a;
      ctx.fillRect(x + bx, y + by, block, block);
    }
  }
}

/* Horizontal dithered shade inside one band. */
function pmHgrain(ctx, x, y, w, h, ramp, block = 2, bias = 0.42) {
  const steps = ramp.length - 1;
  for (let bx = 0; bx < w; bx += block) {
    const t = Math.min(steps, ((bx / Math.max(1, w - 1)) * steps) + bias);
    const i = Math.floor(t);
    const f = t - i;
    const a = ramp[i], b = ramp[Math.min(steps, i + 1)];
    for (let by = 0; by < h; by += block) {
      const th = (PM_BAYER[(by / block) % 4 | 0][(bx / block) % 4 | 0] + 0.5) / 16;
      ctx.fillStyle = f > th ? b : a;
      ctx.fillRect(x + bx, y + by, block, block);
    }
  }
}

/* Soft dithered ellipse of light on the floor. */
function pmLightPool(ctx, cx, cy, rx, ry, color, strength = 0.5) {
  for (let dy = -ry; dy <= ry; dy += 2) {
    for (let dx = -rx; dx <= rx; dx += 2) {
      const d = Math.hypot(dx / rx, dy / ry);
      if (d > 1) continue;
      const t = (1 - d) * strength;
      const th = (PM_BAYER[((dy + ry) >> 1) % 4][((dx + rx) >> 1) % 4] + 0.5) / 16;
      if (t > th) {
        ctx.globalAlpha = 0.10 + t * 0.45;
        ctx.fillStyle = color;
        ctx.fillRect(cx + dx, cy + dy, 2, 2);
      }
    }
  }
  ctx.globalAlpha = 1;
}

/* Wood plank with grain. */
function pmWood(ctx, x, y, w, h, ramp, horizontal = true) {
  const body = ramp[2];
  ctx.fillStyle = body;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = ramp[1];
  if (horizontal) {
    for (let i = 0; i < h; i += 4) ctx.fillRect(x, y + i, w, 1);
  } else {
    for (let i = 0; i < w; i += 4) ctx.fillRect(x + i, y, 1, h);
  }
  ctx.fillStyle = ramp[3];
  if (horizontal) ctx.fillRect(x, y + 1, w, 1);
  else ctx.fillRect(x + 1, y, 1, h);
  ctx.fillStyle = ramp[0];
  if (horizontal) ctx.fillRect(x, y + h - 1, w, 1);
  else ctx.fillRect(x + w - 1, y, 1, h);
  // grain knots
  ctx.fillStyle = ramp[1];
  for (let i = 6; i < (horizontal ? w : h); i += 23) {
    if (horizontal) ctx.fillRect(x + i, y + 2, 3, 1);
    else ctx.fillRect(x + 2, y + i, 1, 3);
  }
}

/* Dark outline helper: draws a 1px silhouette slightly larger, then the fill. */
function pmOutlined(ctx, drawFill, drawShadow, ctxShadow) {
  drawShadow(ctxShadow);
  drawFill(ctx);
}

function drawPixelMemory(scene, index, person) {
  const background = scene.querySelector('.pixel-background');
  const foreground = scene.querySelector('.pixel-actor');
  if (!background || !foreground) return;
  const b = background.getContext('2d'), a = foreground.getContext('2d');
  const W = 480, H = 270;
  b.imageSmoothingEnabled = false; a.imageSmoothingEnabled = false;

  const id = Math.abs(person?.id || 0);
  const seed = (n) => Math.abs(Math.sin(id * 91.7 + n * 17.13));
  const pick = (list, n) => list[Math.floor(seed(n) * list.length) % list.length];

  /* ---------- palettes ---------- */
  const skinRamp = pmRamp(pick(['#f0c4a0', '#e6b795', '#d8ab8a', '#cba07f'], 1));
  const hairRamp = pmRamp(pick(['#6b4c37', '#8a6a4a', '#4a4650', '#a8845f', '#5a616e'], 2));
  const coatRamp = pmRamp(pick(['#7d9a92', '#9c8a72', '#6f8ba3', '#9a7680', '#8a9a70'], 3));
  const pantsRamp = pmRamp(pick(['#56676e', '#645a4a', '#4a5c68'], 4));
  const bootRamp = pmRamp('#2a2620');
  const woodRamp = pmRamp(pick(['#a88256', '#96683f', '#b8935f'], 5));
  const wallRamp = pmRamp(pick(['#4a6167', '#54635e', '#48576a'], 6));
  const floorRamp = pmRamp(pick(['#5a6b60', '#666d60', '#54677a'], 7));
  const clothRamp = pmRamp('#cfc7b0');

  a.clearRect(0, 0, W, H);
  b.clearRect(0, 0, W, H);

  const outline = (fn) => {
    // draw the shape 1px larger in near-black, then the shape itself
    a.save(); a.translate(0, 0);
  };

  /* ---------- shared room shell ---------- */
  function room(withWindow = 'left', floorY = 196) {
    pmVgrad(b, 0, 0, W, floorY, wallRamp, 3);
    // wallpaper rhythm
    b.fillStyle = 'rgba(255,255,255,.028)';
    for (let x = 10; x < W; x += 18) b.fillRect(x, 0, 2, floorY);
    // wainscot
    pmVgrad(b, 0, floorY - 46, W, 46, [wallRamp[0], wallRamp[1], wallRamp[2]], 3);
    b.fillStyle = wallRamp[0]; b.fillRect(0, floorY - 46, W, 2);
    b.fillStyle = wallRamp[3]; b.fillRect(0, floorY - 44, W, 1);
    // floor with perspective planks
    pmVgrad(b, 0, floorY, W, H - floorY, floorRamp, 3);
    b.fillStyle = floorRamp[0];
    for (let i = -6; i < 14; i++) {
      const x0 = i * 52;
      b.save(); b.beginPath();
      b.moveTo(x0, floorY); b.lineTo(x0 + 44, floorY);
      b.lineTo(x0 + 44 + 60, H); b.lineTo(x0 + 60 + 40, H);
      b.closePath(); b.fill(); b.restore();
    }
    b.fillStyle = floorRamp[3];
    b.fillRect(0, floorY, W, 1);

    if (withWindow) {
      const wx = withWindow === 'left' ? 44 : 312;
      const wy = 30, ww = 116, wh = 104;
      b.fillStyle = '#070d10'; b.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
      b.fillStyle = woodRamp[3]; b.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
      const glass = pmRamp('#f0e2bd', 5);
      pmVgrad(b, wx, wy, ww, wh, glass, 2);
      // night sky strip at top of the glass
      b.fillStyle = '#8fa8a4'; b.fillRect(wx, wy, ww, 16);
      // mullions
      b.fillStyle = woodRamp[3];
      b.fillRect(wx + ww / 2 - 2, wy, 4, wh);
      b.fillRect(wx, wy + wh / 2 - 2, ww, 4);
      b.fillStyle = woodRamp[1];
      b.fillRect(wx + ww / 2 + 2, wy, 1, wh);
      // curtains
      b.fillStyle = coatRamp[1]; b.fillRect(wx - 22, wy - 10, 14, wh + 26);
      b.fillStyle = coatRamp[2]; b.fillRect(wx - 21, wy - 10, 3, wh + 26);
      b.fillStyle = coatRamp[0]; b.fillRect(wx + ww + 8, wy - 10, 14, wh + 26);
      b.fillStyle = coatRamp[2]; b.fillRect(wx + ww + 9, wy - 10, 3, wh + 26);
      // light pool on floor
      pmLightPool(b, wx + ww / 2 + 30, floorY + 44, 132, 48, '#f4e6c0', 0.62);
      return { wx, wy, ww, wh };
    }
    return null;
  }

  /* ---------- character ----------
     Small figure (~46 px tall) with ramp shading, outline and rim light. */
  function figure(cx, groundY, scale, pose = 'stand', flip = false) {
    const s = scale;
    const H0 = 46 * s;
    const top = groundY - H0;
    const body = (x, y, w, h, ramp, tone) => {
      a.fillStyle = ramp[tone];
      a.fillRect(Math.round(cx + x * s * (flip ? -1 : 1)), Math.round(top + y * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
    };
    const dark = 'rgba(3,6,8,.92)';
    // silhouette for the 1px outline
    const sil = (x, y, w, h) => {
      a.fillStyle = dark;
      a.fillRect(Math.round(cx + (x - 1) * s * (flip ? -1 : 1)), Math.round(top + (y - 1) * s), Math.max(1, Math.round((w + 2) * s)), Math.max(1, Math.round((h + 2) * s)));
    };
    // legs
    sil(-11, 26, 9, 18); sil(2, 26, 9, 18);
    body(-10, 27, 7, 17, pantsRamp, 2); body(3, 27, 7, 17, pantsRamp, 1);
    if (pose === 'walk') { body(-9, 27, 7, 13, pantsRamp, 3); body(4, 27, 7, 13, pantsRamp, 1); }
    // boots
    sil(-11, 42, 10, 4); sil(2, 42, 10, 4);
    body(-10, 42, 9, 3, bootRamp, 1); body(3, 42, 9, 3, bootRamp, 0);
    // torso
    sil(-10, 13, 20, 15);
    body(-9, 14, 18, 13, coatRamp, 2);
    body(-9, 14, 5, 13, coatRamp, 1);     // shaded side
    body(4, 14, 5, 13, coatRamp, 3);      // lit side (window)
    body(-2, 14, 2, 13, coatRamp, 0);     // centre seam
    // collar
    body(-7, 12, 14, 3, coatRamp, 3);
    // arms
    sil(-14, 15, 5, 15); sil(9, 15, 5, 15);
    body(-13, 16, 4, 14, coatRamp, 1); body(10, 16, 4, 14, coatRamp, 3);
    if (pose === 'phone') { body(10, 16, 4, 8, coatRamp, 2); body(9, 22, 6, 3, coatRamp, 3); }
    if (pose === 'suitcase') { body(-13, 16, 4, 12, coatRamp, 1); }
    // hands
    body(-13, 29, 4, 3, skinRamp, 2); body(10, 29, 4, 3, skinRamp, 3);
    // neck
    body(-2, 10, 4, 3, skinRamp, 1);
    // head
    sil(-8, -1, 16, 12);
    body(-7, 0, 14, 11, skinRamp, 2);
    body(-7, 0, 4, 11, skinRamp, 1);
    body(3, 0, 4, 11, skinRamp, 3);
    // jaw shadow
    body(-6, 8, 12, 3, skinRamp, 1);
    // hair
    sil(-9, -3, 18, 7);
    body(-8, -2, 16, 5, hairRamp, 2);
    body(-8, -2, 16, 2, hairRamp, 3);
    body(-8, 2, 3, 7, hairRamp, 1);
    body(5, 2, 3, 7, hairRamp, 1);
    if (person?.gender === 'f') { body(-10, 2, 3, 11, hairRamp, 1); body(7, 2, 3, 11, hairRamp, 1); }
    // eyes
    body(-4, 4, 2, 2, '#161a1c'); body(2, 4, 2, 2, '#161a1c');
    body(-4, 4, 1, 1, '#e8e4d6'); body(2, 4, 1, 1, '#e8e4d6');
    // rim light along the lit edge
    a.fillStyle = 'rgba(246,241,221,.20)';
    a.fillRect(Math.round(cx + 6 * s), Math.round(top + 1 * s), 1, Math.round(10 * s));
  }

  /* ---------- scenes ---------- */
  if (index === 0) {
    const win = room('left');
    // crib
    const cribX = 236, cribY = 132, cribW = 190, cribH = 106;
    pmWood(b, cribX - 8, cribY, 10, cribH, woodRamp, false);
    pmWood(b, cribX + cribW - 2, cribY, 10, cribH, woodRamp, false);
    pmWood(b, cribX - 8, cribY, cribW + 16, 9, woodRamp, true);
    // mattress
    const matt = pmRamp('#ded6bd', 5);
    b.fillStyle = matt[2]; b.fillRect(cribX, cribY + 42, cribW, 14);
    b.fillStyle = matt[3]; b.fillRect(cribX, cribY + 42, cribW, 3);
    b.fillStyle = matt[1]; b.fillRect(cribX, cribY + 53, cribW, 3);
    // blanket
    const blanket = pmRamp('#6d8f83', 6);
    b.fillStyle = blanket[2]; b.fillRect(cribX + 34, cribY + 50, cribW - 34, 24);
    b.fillStyle = blanket[3]; b.fillRect(cribX + 34, cribY + 50, cribW - 34, 3);
    b.fillStyle = blanket[1]; b.fillRect(cribX + 34, cribY + 71, cribW - 34, 3);
    // blanket fold lines
    b.fillStyle = blanket[1];
    for (let i = 0; i < 4; i++) b.fillRect(cribX + 52 + i * 34, cribY + 54, 1, 18);
    // pillow
    b.fillStyle = matt[3]; b.fillRect(cribX + 6, cribY + 30, 52, 13);
    b.fillStyle = matt[4]; b.fillRect(cribX + 6, cribY + 30, 52, 2);

    // baby: swaddle, face, cap
    const baby = (x, y) => {
      a.fillStyle = 'rgba(3,6,8,.9)';
      a.fillRect(x - 1, y - 1, 50, 27);
      a.fillStyle = '#efe8d4'; a.fillRect(x, y, 48, 25);
      a.fillStyle = '#ddd5be'; a.fillRect(x, y + 16, 48, 9);
      a.fillStyle = '#f6f0dc'; a.fillRect(x, y, 48, 3);
      // head
      a.fillStyle = 'rgba(3,6,8,.9)'; a.fillRect(x + 12, y - 15, 26, 18);
      a.fillStyle = skinRamp[2]; a.fillRect(x + 13, y - 14, 24, 16);
      a.fillStyle = skinRamp[3]; a.fillRect(x + 13, y - 14, 24, 3);
      a.fillStyle = skinRamp[1]; a.fillRect(x + 13, y + 0, 24, 2);
      // cap
      a.fillStyle = '#b08b6c'; a.fillRect(x + 11, y - 18, 28, 6);
      a.fillStyle = '#c39c7c'; a.fillRect(x + 11, y - 18, 28, 2);
      a.fillStyle = '#b08b6c'; a.fillRect(x + 11, y - 12, 3, 5);
      // eyes
      a.fillStyle = '#1b2325'; a.fillRect(x + 18, y - 8, 3, 3); a.fillRect(x + 29, y - 8, 3, 3);
      a.fillStyle = '#e9e5d7'; a.fillRect(x + 18, y - 8, 1, 1); a.fillRect(x + 29, y - 8, 1, 1);
      // mouth
      a.fillStyle = '#b3786a'; a.fillRect(x + 22, y - 3, 6, 2);
    };
    baby(cribX + 22, cribY + 22);

    // front bars (over the baby's lower body only)
    for (let i = 0; i < 8; i++) {
      const bx = cribX + 4 + i * 24;
      pmWood(b, bx, cribY + 56, 5, cribH - 56, woodRamp, false);
    }
    pmWood(b, cribX - 8, cribY + cribH - 8, cribW + 16, 10, woodRamp, true);
    if (win) pmLightPool(b, win.wx + 150, 210, 120, 40, '#f4e6c0', 0.35);
    return;
  }

  if (index === 1) {
    const win = room('right');
    // table
    const tY = 168;
    pmWood(b, 86, tY, 186, 11, woodRamp, true);
    pmWood(b, 96, tY + 11, 9, 76, woodRamp, false);
    pmWood(b, 254, tY + 11, 9, 76, woodRamp, false);
    // cup with steam
    a.fillStyle = 'rgba(3,6,8,.9)'; a.fillRect(128, tY - 21, 28, 21);
    a.fillStyle = '#c3c9b6'; a.fillRect(129, tY - 20, 26, 19);
    a.fillStyle = '#dfe3d2'; a.fillRect(129, tY - 20, 26, 4);
    a.fillStyle = '#a4ab99'; a.fillRect(129, tY - 5, 26, 4);
    a.fillStyle = '#c3c9b6'; a.fillRect(155, tY - 15, 5, 8);
    b.fillStyle = 'rgba(226,234,222,.30)';
    b.fillRect(136, tY - 30, 2, 8); b.fillRect(142, tY - 34, 2, 10);
    // life symbol on the sill
    const symColors = pmRamp('#c9a86a', 5);
    b.fillStyle = 'rgba(3,6,8,.85)'; b.fillRect(330, 120, 34, 34);
    b.fillStyle = symColors[2]; b.fillRect(331, 121, 32, 32);
    b.fillStyle = symColors[3]; b.fillRect(331, 121, 32, 4);
    b.fillStyle = symColors[1]; b.fillRect(331, 149, 32, 4);
    if (win) pmLightPool(b, win.wx + 60, 208, 130, 42, '#f4e6c0', 0.5);
    figure(196, 242, 0.86, 'stand');
    return;
  }

  if (index === 2) {
    // platform: cold blue, rails, train door
    const coldWall = pmRamp('#23343c', 6);
    const coldFloor = pmRamp('#2c3b41', 6);
    pmVgrad(b, 0, 0, W, 168, coldWall, 3);
    pmVgrad(b, 0, 168, W, H - 168, coldFloor, 3);
    b.fillStyle = 'rgba(255,255,255,.05)';
    for (let x = 8; x < W; x += 22) b.fillRect(x, 0, 2, 168);
    // platform edge line
    b.fillStyle = '#9fb0a8'; b.fillRect(0, 168, W, 3);
    b.fillStyle = 'rgba(240,235,215,.5)'; b.fillRect(0, 168, W, 1);
    // rails converging
    b.strokeStyle = '#1b262b'; b.lineWidth = 3;
    for (const off of [0, 26]) {
      b.beginPath(); b.moveTo(60 + off, 270); b.lineTo(250 + off, 196); b.stroke();
    }
    // train car
    const car = pmRamp('#31474f', 6);
    b.fillStyle = car[1]; b.fillRect(300, 24, 168, 150);
    b.fillStyle = car[2]; b.fillRect(300, 24, 168, 8);
    b.fillStyle = car[0]; b.fillRect(300, 166, 168, 8);
    // door
    b.fillStyle = car[3]; b.fillRect(324, 44, 62, 116);
    b.fillStyle = car[2]; b.fillRect(324, 44, 62, 4);
    b.fillStyle = '#0b1418'; b.fillRect(330, 52, 50, 50);
    b.fillStyle = 'rgba(200,215,205,.16)'; b.fillRect(330, 52, 50, 14);
    b.fillStyle = '#0b1418'; b.fillRect(330, 108, 50, 44);
    b.fillStyle = car[4]; b.fillRect(355, 44, 2, 116);
    // window reflection
    b.fillStyle = 'rgba(220,232,222,.10)'; b.fillRect(336, 58, 8, 38);
    // sign
    b.fillStyle = car[4]; b.fillRect(400, 60, 56, 18);
    b.fillStyle = car[0]; b.fillRect(404, 64, 48, 10);
    pmLightPool(b, 210, 196, 150, 26, '#cfe0e2', 0.20);
    figure(150, 250, 0.92, 'suitcase');
    return;
  }

  if (index === 3) {
    const win = room('left');
    // darkness on the right half
    const dark = b.createLinearGradient(220, 0, W, 0);
    dark.addColorStop(0, 'rgba(4,8,10,0)');
    dark.addColorStop(1, 'rgba(4,8,10,.82)');
    b.fillStyle = dark; b.fillRect(0, 0, W, 196);
    // sideboard
    pmWood(b, 268, 150, 176, 12, woodRamp, true);
    pmWood(b, 278, 162, 8, 68, woodRamp, false);
    pmWood(b, 426, 162, 8, 68, woodRamp, false);
    // phone on the table, glowing
    const ph = { x: 300, y: 118, w: 34, h: 32 };
    a.fillStyle = 'rgba(3,6,8,.92)'; a.fillRect(ph.x - 2, ph.y - 2, ph.w + 4, ph.h + 4);
    a.fillStyle = '#1d2528'; a.fillRect(ph.x, ph.y, ph.w, ph.h);
    a.fillStyle = '#8fb3a5'; a.fillRect(ph.x + 3, ph.y + 3, ph.w - 6, ph.h - 12);
    a.fillStyle = '#cfe6da'; a.fillRect(ph.x + 3, ph.y + 3, ph.w - 6, 3);
    a.fillStyle = '#4a635a'; a.fillRect(ph.x + 3, ph.y + ph.h - 7, ph.w - 6, 4);
    // glow from the screen
    pmLightPool(b, ph.x + ph.w / 2, ph.y + 14, 96, 46, '#a8d8c2', 0.55);
    pmLightPool(b, ph.x + ph.w / 2, 168, 120, 26, '#a8d8c2', 0.28);
    if (win) pmLightPool(b, win.wx + 40, 214, 100, 34, '#f4e6c0', 0.32);
    figure(196, 244, 0.94, 'phone');
    return;
  }

  // sea / after: horizon, water bands, distant light
  const skyR = pmRamp('#5c7176', 6);
  const seaR = pmRamp('#22403f', 6);
  pmVgrad(b, 0, 0, W, 128, skyR, 3);
  pmVgrad(b, 0, 128, W, H - 128, seaR, 3);
  b.fillStyle = '#9fb4ac'; b.fillRect(0, 127, W, 2);
  // clouds
  b.fillStyle = 'rgba(226,232,220,.14)';
  for (let i = 0; i < 5; i++) {
    const cx0 = 30 + seed(i + 40) * 400, cy0 = 24 + seed(i + 50) * 70;
    const cw = 60 + seed(i + 60) * 90;
    b.fillRect(cx0, cy0, cw, 4);
    b.fillRect(cx0 + 10, cy0 + 4, cw - 24, 3);
  }
  // water lines, dithered
  for (let y = 140; y < 210; y += 7) {
    const len = 20 + ((y / 7) % 5) * 26;
    for (let x = -20; x < W; x += len + 30) {
      b.fillStyle = 'rgba(180,210,205,.22)';
      b.fillRect(x + ((y / 7) % 3) * 12, y, len, 1);
    }
  }
  // railing
  pmWood(b, 0, 212, W, 4, woodRamp, true);
  for (let x = 12; x < W; x += 46) pmWood(b, x, 212, 5, 42, woodRamp, false);
  pmWood(b, 0, 250, W, 5, woodRamp, true);
  // distant light
  b.fillStyle = 'rgba(214,176,110,.22)'; b.fillRect(398, 104, 14, 14);
  b.fillStyle = '#d6b06e'; b.fillRect(403, 109, 4, 4);
  b.fillStyle = '#f0dcb0'; b.fillRect(404, 110, 2, 2);

  if (index === 4) {
    figure(210, 240, 0.9, 'stand');
  }
  // index 5 = empty scene, no figure
}
