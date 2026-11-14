/* Free on-device memory generator.
   Takes one of the pre-generated source plates and composes a unique frame
   per (life, scene): crop/pan, mirror, palette grade per decade and life,
   time-of-day light, weather, 16-bit quantise + dither, and pixel props.
   No network, no API: the same seed always gives the same frame. */
const MC_W = 480, MC_H = 270;
const MC_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function mcRng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Decade grade: old film is warm/brown, 70s green-yellow, 90s cold-magenta.
function mcGrade(year) {
  if (year < 1950) return { r: 1.08, g: 0.98, b: 0.80, sat: 0.35, lift: 14 };
  if (year < 1970) return { r: 1.04, g: 1.00, b: 0.86, sat: 0.60, lift: 10 };
  if (year < 1985) return { r: 1.02, g: 1.04, b: 0.88, sat: 0.75, lift: 8 };
  if (year < 2000) return { r: 1.00, g: 0.96, b: 1.04, sat: 0.70, lift: 6 };
  return { r: 0.96, g: 1.00, b: 1.06, sat: 0.65, lift: 4 };
}

function composeMemory(img, person, index, canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = MC_W; canvas.height = MC_H;
  const m = person?.memories?.[index] || {};
  const rnd = mcRng((Math.abs(person?.id || 1) * 2654435761) ^ (index * 40503));

  // 1. framing: each life sees a different part of the room
  const zoom = 1.08 + rnd() * 0.32;
  const sw = img.width / zoom, sh = img.height / zoom;
  const sx = rnd() * (img.width - sw), sy = (0.15 + rnd() * 0.7) * (img.height - sh);
  const mirror = rnd() < 0.5;
  ctx.save();
  if (mirror) { ctx.translate(MC_W, 0); ctx.scale(-1, 1); }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, MC_W, MC_H);
  ctx.restore();

  // 2. light: a seeded pool of warm or cold light, darkness elsewhere
  const year = typeof m.y === 'number' ? m.y : (person?.year || 1970) + 70;
  const night = m.time === 'night', dusk = m.time === 'dusk';
  const lx = MC_W * (0.2 + rnd() * 0.6), ly = MC_H * (0.25 + rnd() * 0.4);
  const light = ctx.createRadialGradient(lx, ly, 10, lx, ly, MC_W * (0.55 + rnd() * 0.3));
  const warm = night ? 'rgba(255,190,120,' : dusk ? 'rgba(255,170,110,' : 'rgba(230,235,220,';
  light.addColorStop(0, warm + (night ? 0.22 : 0.12) + ')');
  light.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = light; ctx.fillRect(0, 0, MC_W, MC_H);
  ctx.globalCompositeOperation = 'multiply';
  const dark = ctx.createRadialGradient(lx, ly, MC_W * 0.15, lx, ly, MC_W * 0.85);
  dark.addColorStop(0, 'rgba(255,255,255,1)');
  dark.addColorStop(1, night ? 'rgba(40,45,70,1)' : dusk ? 'rgba(110,80,90,1)' : 'rgba(150,150,150,1)');
  ctx.fillStyle = dark; ctx.fillRect(0, 0, MC_W, MC_H);
  ctx.globalCompositeOperation = 'source-over';

  // 3. weather, life-stage decay
  if (night && rnd() < 0.5) {
    ctx.fillStyle = 'rgba(190,205,220,.18)';
    for (let i = 0; i < 140; i++) { const x = rnd() * MC_W, y = rnd() * MC_H; ctx.fillRect(x | 0, y | 0, 1, 4 + (rnd() * 5 | 0)); }
  }
  const decay = index / 5;

  // 4. grade + 16-bit quantise with ordered dithering (5 bits/channel feel)
  const g = mcGrade(year);
  const hueShift = (rnd() - 0.5) * 0.12;
  const data = ctx.getImageData(0, 0, MC_W, MC_H);
  const d = data.data;
  const levels = 22 - Math.round(decay * 8);
  const step = 255 / (levels - 1);
  const sat = g.sat * (1 - decay * 0.5);
  for (let y = 0; y < MC_H; y++) {
    for (let x = 0; x < MC_W; x++) {
      const i = (y * MC_W + x) * 4;
      let r = d[i] * g.r, gg = d[i + 1] * (g.g + hueShift), b = d[i + 2] * (g.b - hueShift);
      const l = r * 0.3 + gg * 0.59 + b * 0.11;
      r = l + (r - l) * sat + g.lift; gg = l + (gg - l) * sat + g.lift; b = l + (b - l) * sat + g.lift;
      const th = (MC_BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * step;
      d[i] = Math.round((r + th) / step) * step;
      d[i + 1] = Math.round((gg + th) / step) * step;
      d[i + 2] = Math.round((b + th) / step) * step;
    }
  }
  ctx.putImageData(data, 0, 0);

  // 5. the life's own object, drawn as a small pixel sprite in the light
  mcProp(ctx, String(m.prop || person?.symbol || ''), lx, Math.min(MC_H - 30, ly + 60), rnd);
  return canvas;
}

function mcProp(ctx, prop, x, y, rnd) {
  const p = prop.toLowerCase();
  const px = (cx, cy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + cx), Math.round(y + cy), w, h); };
  const o = 'rgba(8,8,10,.9)';
  if (!p || rnd() < 0.35) return;
  if (/ключ/.test(p)) { px(-1, -1, 12, 5, o); px(0, 0, 4, 3, '#a07a3a'); px(4, 1, 6, 1, '#b8904a'); px(8, 2, 1, 2, '#b8904a'); }
  else if (/конверт|письм/.test(p)) { px(-1, -1, 16, 11, o); px(0, 0, 14, 9, /син/.test(p) ? '#5a74a0' : '#d8cfb4'); px(0, 0, 7, 4, 'rgba(255,255,255,.15)'); }
  else if (/кружк|чашк/.test(p)) { px(-1, -1, 10, 11, o); px(0, 0, 8, 9, /зел/.test(p) ? '#4f7a55' : '#c9c3b0'); px(8, 2, 2, 4, '#8a8a80'); }
  else if (/кассет|лент/.test(p)) { px(-1, -1, 18, 11, o); px(0, 0, 16, 9, '#2a2a2e'); px(3, 3, 3, 3, '#cfc6b0'); px(10, 3, 3, 3, '#cfc6b0'); }
  else if (/часы/.test(p)) { px(-1, -1, 12, 12, o); px(0, 0, 10, 10, '#c8b88a'); px(4, 2, 1, 4, '#222'); }
  else if (/фото|снимок/.test(p)) { px(-1, -1, 14, 11, o); px(0, 0, 12, 9, '#e8e0cc'); px(1, 1, 10, 6, '#6b6660'); }
  else if (/билет/.test(p)) { px(-1, -1, 14, 7, o); px(0, 0, 12, 5, '#e9e4d2'); }
  else if (/шарф/.test(p)) { px(-1, -1, 22, 6, o); px(0, 0, 20, 4, /жёлт|желт/.test(p) ? '#c9a73e' : '#8a3c3c'); }
  else if (/лампа|свет/.test(p)) { px(-1, -12, 10, 16, o); px(0, -11, 8, 6, '#e8d290'); px(3, -5, 2, 8, '#555'); ctx.fillStyle = 'rgba(255,220,150,.12)'; ctx.beginPath(); ctx.arc(x + 4, y - 8, 26, 0, 7); ctx.fill(); }
}

const composedCache = new Map();
async function composedMemoryUrl(person, index) {
  const key = `${person?.id}-${index}`;
  if (composedCache.has(key)) return composedCache.get(key);
  const img = await loadMemoryImage(memoryImageUrl(person, index));
  if (!img) return null;
  const c = document.createElement('canvas');
  composeMemory(img, person, index, c);
  const url = c.toDataURL('image/png');
  composedCache.set(key, url);
  return url;
}
