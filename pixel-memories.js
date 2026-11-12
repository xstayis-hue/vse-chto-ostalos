/* Пиксельные воспоминания: фон и персонаж на отдельных canvas. */
function drawPixelMemory(scene, index, person) {
  const background = scene.querySelector('.pixel-background');
  const foreground = scene.querySelector('.pixel-actor');
  if (!background || !foreground) return;
  const b = background.getContext('2d'), a = foreground.getContext('2d');
  const rect = (ctx, x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const r = (x, y, w, h, c) => rect(b, x, y, w, h, c);
  r(0, 0, 160, 120, '#303d3b');
  if (index === 4) {
    r(0, 0, 160, 63, '#687d7c'); r(0, 63, 160, 30, '#344f50'); r(0, 93, 160, 27, '#464a43');
    for (let x = 0; x < 160; x += 24) r(x, 73 + x % 7, 14, 1, '#91a19a');
  } else if (index === 2) {
    r(0, 0, 160, 78, '#596d6e'); r(0, 78, 160, 42, '#343d39');
    r(85, 23, 75, 65, '#293b3a'); r(90, 30, 70, 22, '#87928a');
    for (let x = 94; x < 160; x += 17) r(x, 30, 3, 22, '#394b46');
    r(0, 85, 160, 3, '#a49b7f');
  } else {
    for (let x = 0; x < 160; x += 16) r(x, 4, 1, 61, '#41504b');
    r(0, 62, 160, 5, '#1a2524'); r(0, 67, 160, 53, '#3d4540');
    for (let y = 72; y < 120; y += 10) r(0, y, 160, 1, '#27322f');
    r(91, 10, 52, 48, '#192524'); r(95, 14, 44, 40, '#788f8b');
    r(115, 14, 3, 40, '#354b48'); r(95, 33, 44, 3, '#354b48');
    r(7, 30, 30, 38, '#202b28'); r(10, 33, 24, 3, '#707166'); r(10, 47, 24, 3, '#707166');
    r(96, 81, 46, 5, '#74695a'); r(99, 86, 4, 22, '#484d43'); r(136, 86, 4, 22, '#484d43');
    if (index === 0) {
      r(38, 83, 46, 5, '#aeb9ac'); r(40, 88, 3, 18, '#aeb9ac'); r(80, 88, 3, 18, '#aeb9ac');
      // Новорождённый в светлой пелёнке, без взрослого лица и волос.
      r(49, 77, 25, 6, '#ded9c6'); r(52, 75, 8, 6, '#c5aa94'); r(60, 78, 11, 3, '#b9c8bd');
    }
    if (index === 3) { r(108, 75, 12, 5, '#161d1c'); r(111, 71, 6, 4, '#202b28'); }
  }
  if (index === 0) return; // Рождение: кроватка вместо случайного взрослого.
  const palettes = [
    {hair:'#45382f',skin:'#c5aa94',coat:'#89968a'},
    {hair:'#b1a07f',skin:'#d0b59e',coat:'#7e8990'},
    {hair:'#292d2b',skin:'#987b68',coat:'#8d8173'},
    {hair:'#80766a',skin:'#bba18e',coat:'#697e76'}
  ];
  const colors = palettes[(person.id || 0) % palettes.length];
  const hair = index === 4 ? '#a6a397' : colors.hair;
  const longerHair = person.gender === 'f';
  const draw = (blink = false) => {
    a.clearRect(0, 0, 160, 120);
    const p = (x,y,w,h,c) => rect(a,x,y,w,h,c);
    a.save();
    // Ребёнок меньше взрослого; положение ног остаётся на полу.
    if (index === 1) { a.translate(62, 108); a.scale(.72, .72); a.translate(-62, -108); }
    p(51,106,22,3,'#1b2220'); p(54,94,7,13,'#3b4440'); p(64,94,7,13,'#3b4440');
    p(53,105,9,3,'#302a27'); p(64,105,10,3,'#302a27');
    p(52,73,21,24,'#222d2a'); p(54,75,17,20,colors.coat); p(49,77,5,17,colors.coat); p(73,77,4,17,colors.coat);
    p(49,91,4,4,colors.skin); p(73,91,4,4,colors.skin); p(59,74,8,4,'#c5c7b2');
    if (longerHair) { p(49,57,5,24,hair); p(71,57,5,24,hair); }
    p(53,52,19,9,hair);
    p(55,59,15,15,colors.skin);
    p(59,74,7,3,colors.skin); // шея соединяет лицо с одеждой без тёмной полосы
    p(54,54,17,6,hair); p(53,58,4,7,hair); p(68,58,4,7,hair);
    p(58,65,2,blink ? 1 : 2,'#282b28'); p(66,65,2,blink ? 1 : 2,'#282b28'); p(61,70,4,1,'#987d70');
    a.restore();
  };
  draw();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const blink = () => {
      if (!foreground.isConnected) return;
      if (!document.hidden) { draw(true); setTimeout(() => { if (foreground.isConnected) draw(); }, 140); }
      setTimeout(blink, 4800);
    };
    setTimeout(blink, 4800);
  }
}
