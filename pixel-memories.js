/* Deterministic 16-bit memory renderer. No generated assets, no random drift. */
function drawPixelMemory(scene, index, person) {
  const background = scene.querySelector('.pixel-background');
  const foreground = scene.querySelector('.pixel-actor');
  if (!background || !foreground) return;
  const b = background.getContext('2d'), a = foreground.getContext('2d');
  const W = 320, H = 180;
  const palettes = [
    { sky: '#172729', deep: '#0a1418', floor: '#303d39', light: '#a8b9a9', accent: '#c6a47a', skin: '#bd967f', hair: '#3b302d', coat: '#667f7a' },
    { sky: '#263337', deep: '#10191d', floor: '#3f4540', light: '#b3c3b5', accent: '#9ba86f', skin: '#cba48d', hair: '#514034', coat: '#7a8581' },
    { sky: '#1b2931', deep: '#0b1117', floor: '#344348', light: '#9caeae', accent: '#bd816d', skin: '#a98270', hair: '#272d32', coat: '#536b7b' },
    { sky: '#303135', deep: '#111317', floor: '#48433d', light: '#c3bba4', accent: '#b99a58', skin: '#c49a7d', hair: '#635044', coat: '#777267' },
  ];
  const pal = palettes[Math.abs(person?.id || 0) % palettes.length];
  const hash = (n) => Math.abs(Math.sin((person?.id || 0) * 91.7 + n * 17.13));
  const rect = (ctx, x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const line = (ctx, x1, y1, x2, y2, color, width = 2) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const text = (ctx, value, x, y, color) => { ctx.fillStyle = color; ctx.font = '8px monospace'; ctx.fillText(value, x, y); };
  const symbol = String(person?.symbol || '').toLowerCase();

  b.clearRect(0, 0, W, H);
  a.clearRect(0, 0, W, H);
  rect(b, 0, 0, W, H, pal.deep);
  rect(b, 0, 0, W, 112, pal.sky);
  for (let i = 0; i < 14; i++) {
    const x = (hash(i) * W) | 0;
    line(b, x, 12 + (hash(i + 30) * 70), x, 104, 'rgba(160,190,180,.12)', 2 + (i % 2));
  }

  if (index === 0) {
    // Birth: room, window, crib, no adult face.
    rect(b, 0, 112, W, 68, pal.floor);
    rect(b, 32, 27, 80, 70, '#101b1d'); rect(b, 40, 35, 64, 54, pal.light);
    line(b, 72, 35, 72, 89, '#526764', 3); line(b, 40, 62, 104, 62, '#526764', 3);
    rect(b, 126, 111, 112, 8, pal.light); rect(b, 132, 119, 5, 45, pal.light); rect(b, 227, 119, 5, 45, pal.light);
    rect(b, 144, 102, 62, 12, '#ded6bd');
    rect(a, 157, 91, 34, 10, '#d9d0b9'); rect(a, 163, 87, 14, 6, pal.skin); rect(a, 176, 92, 12, 4, '#b5c4b6');
    return;
  }

  if (index === 1) {
    // Childhood: domestic interior with an object that varies per life.
    rect(b, 0, 116, W, 64, pal.floor);
    rect(b, 226, 30, 62, 70, '#11191a'); rect(b, 232, 36, 50, 58, pal.light);
    rect(b, 46, 101, 116, 8, '#8a765b'); rect(b, 55, 109, 6, 42, '#625441'); rect(b, 147, 109, 6, 42, '#625441');
    if (symbol.includes('ключ') || symbol.includes('круж')) { rect(b, 195, 96, 11, 18, pal.accent); line(b, 201, 96, 214, 89, pal.accent, 3); }
    else if (symbol.includes('письм') || symbol.includes('конверт')) { rect(b, 196, 91, 28, 19, '#a4b1a1'); line(b, 196, 91, 210, 103, pal.accent, 2); line(b, 224, 91, 210, 103, pal.accent, 2); }
    else { rect(b, 198, 88, 16, 25, pal.accent); rect(b, 201, 84, 10, 5, pal.accent); }
  } else if (index === 2) {
    // Turning point: platform / road with a readable vanishing line.
    rect(b, 0, 110, W, 70, pal.floor); line(b, 0, 124, W, 124, pal.light, 2);
    for (let x = 0; x < W; x += 38) line(b, x, 135, x + 24, 135, '#69736c', 2);
    rect(b, 218, 30, 72, 60, '#142126'); rect(b, 224, 37, 58, 44, pal.light);
    line(b, 78, 105, 162, 105, pal.accent, 3); line(b, 120, 105, 120, 67, pal.accent, 2);
    text(b, 'ОТПРАВЛЕНИЕ', 212, 104, pal.light);
  } else if (index === 3) {
    // Voice: room, phone light, empty space around the figure.
    rect(b, 0, 116, W, 64, pal.floor); rect(b, 245, 36, 34, 68, '#151719');
    rect(b, 252, 45, 20, 38, '#758b82'); rect(b, 257, 54, 10, 3, pal.accent);
    rect(b, 42, 106, 94, 7, '#6f6554'); rect(b, 50, 113, 5, 38, '#4d4940'); rect(b, 124, 113, 5, 38, '#4d4940');
    line(b, 160, 28, 160, 103, 'rgba(180,200,190,.16)', 2);
  } else {
    // Farewell / after: horizon, water and one distant light.
    rect(b, 0, 0, W, 92, '#607576'); rect(b, 0, 92, W, 88, '#263d3e'); line(b, 0, 93, W, 93, pal.light, 1);
    for (let y = 112; y < 170; y += 14) line(b, 0, y, W, y + ((y / 14) % 2 ? 2 : -2), 'rgba(150,180,170,.25)', 1);
    rect(b, 265, 72, 4, 4, pal.accent); rect(b, 263, 70, 8, 8, 'rgba(201,168,106,.18)');
  }

  // Actor silhouette: pose and clothing vary deterministically by life and scene.
  const child = index === 1;
  const old = index >= 4;
  const x = 130 + Math.round((hash(index + 80) - .5) * 70);
  const base = 142;
  const scale = child ? .74 : old ? .96 : 1;
  const P = (xx, yy, ww, hh, c) => rect(a, x + xx * scale, base + yy * scale, ww * scale, hh * scale, c);
  P(-18, 0, 36, 4, '#17201f'); P(-13, -30, 8, 30, pal.coat); P(5, -30, 8, 30, pal.coat);
  P(-16, -56, 32, 29, pal.coat); P(-21, -50, 6, 20, pal.coat); P(15, -50, 6, 20, pal.coat);
  P(-8, -72, 16, 17, pal.skin); P(-11, -79, 22, 9, pal.hair); P(-13, -72, 5, 14, pal.hair); P(8, -72, 5, 14, pal.hair);
  P(-6, -62, 3, 3, '#1c2524'); P(5, -62, 3, 3, '#1c2524');
  if (index === 3) { P(20, -38, 9, 15, '#202827'); P(23, -35, 3, 7, pal.accent); }
  if (old) { line(a, x - 13, base - 38, x - 26, base - 13, pal.light, 2); line(a, x + 13, base - 38, x + 25, base - 13, pal.light, 2); }
}
