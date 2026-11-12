/* «Всё, что от меня ОСТАЛОСЬ» — вертикальная демка.
   Космос: вид от первого лица (глаза сущности), свободный полёт.
   Без зависимостей. */

// ---------- утилиты ----------
const $ = (s, r = document) => r.querySelector(s);
const stage = $("#stage");
const flash = $("#flash");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// короткий миг/затемнение экрана
function flashOn(ms = 900) {
  flash.classList.add("on");
  setTimeout(() => flash.classList.remove("on"), 140);
  setTimeout(() => {}, ms);
}

// ---------- звук (WebAudio, тихий слой) ----------
const AudioLayer = {
  ctx: null, master: null, drone: null, started: false,
  ensure() {
    if (this.started) return;
    try {
      const C = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = C;
      this.master = C.createGain(); this.master.gain.value = 0.0; this.master.connect(C.destination);
      // низкий гул: два слегка расстроенных осциллятора
      const g = C.createGain(); g.gain.value = 0.5; g.connect(this.master);
      const f = C.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 220; f.connect(g);
      [55, 55.7, 110.4].forEach((freq, i) => {
        const o = C.createOscillator(); o.type = i === 2 ? "triangle" : "sine";
        o.frequency.value = freq;
        const og = C.createGain(); og.gain.value = i === 2 ? 0.12 : 0.4;
        o.connect(og); og.connect(f); o.start();
      });
      // шум-статика
      const len = C.sampleRate * 2, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.25;
      const noise = C.createBufferSource(); noise.buffer = buf; noise.loop = true;
      const ng = C.createGain(); ng.gain.value = 0.02;
      const nf = C.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 800; nf.Q = 0.6;
      noise.connect(nf); nf.connect(ng); ng.connect(this.master); noise.start();
      this.drone = this.master;
      this.started = true;
    } catch { /* без звука тоже ок */ }
  },
  fade(to, t = 2) {
    if (!this.ctx) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(to, this.ctx.currentTime + t);
  },
  ping(freq = 520, dur = 0.5, vol = 0.12) {
    if (!this.ctx) return;
    const C = this.ctx, o = C.createOscillator(), g = C.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, C.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, C.currentTime + dur);
    o.connect(g); g.connect(C.destination);
    o.start(); o.stop(C.currentTime + dur);
  },
  whisper() { // «голос»: тихий шумовой всплеск
    if (!this.ctx) return;
    const C = this.ctx, len = C.sampleRate * 1.4, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2) * 0.4;
    const s = C.createBufferSource(); s.buffer = buf;
    const f = C.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 900; f.Q = 2;
    const g = C.createGain(); g.gain.value = 0.5;
    s.connect(f); f.connect(g); g.connect(C.destination); s.start();
  }
};

// ---------- печатная машинка ----------
function typeText(el, text, speed = 26) {
  if (!el) return Promise.resolve(); // экран уже сменился — печатать некуда
  return new Promise((done) => {
    el.textContent = "";
    const cur = document.createElement("i");
    cur.className = "cursor";
    el.appendChild(cur);
    let i = 0;
    (function step() {
      if (!el.isConnected) { done(); return; } // экран сменился посреди печати
      if (i < text.length) {
        cur.insertAdjacentText("beforebegin", text[i++]);
        setTimeout(step, speed);
      } else { cur.remove(); done(); }
    })();
  });
}

// ---------- данные жизни ----------
let LIFE = {
  name: "Никифор Вельский",
  num: "№ 4 918 220 773",
  place: "Белое море",
  year: "1998",
  desire: "услышать, как лёд ломается весной",
  last: "Я ещё успею",
  memories: [
    { y: "1998", h: "Ты появился в месте, которое не запомнишь.", p: "Дождь по стеклу. Белый свет. Чужая ладонь. где-то далеко — голос, который потом будет сниться.", fx: "rain", n: 26 },
    { y: "2003", h: "Вещи могут лопаться без звука.", p: "Пять лет. Ты долго смотрел на лёд и ждал, когда он ответит. Он молчал до весны.", fx: "ice", n: 14 },
    { y: "2018", h: "Ты мог уехать. Ты не уехал.", p: "Причина решения не сохранилась. Сохранился только вес платформы под ногами в тот вечер.", fx: "split", n: 0 },
    { y: "2029", h: "Ты позвонил ещё три раза.", p: "НЕТ ОТВЕТА. Некоторые голоса не возвращаются. Телефон на столе до сих пор помнит твой палец.", fx: "room", n: 0 },
    { y: "2041", h: "Некоторые моменты становятся последними позже.", p: "Серое море. Низкое небо. Фигура вдали, которая так и осталась вдали.", fx: "sea", n: 0 },
  ],
};

// Сто детерминированных записей: комбинации вручную написанных фрагментов,
// а не сто отдельных видеороликов или биографий, сгенерированных ИИ.
const firstNames = ['Анна','Михаил','Вера','Даниил','Алина','Илья','Мария','Лев','София','Никита','Елена','Артём','Нина','Павел','Дарья','Максим','Ольга','Роман','Мила','Алексей'];
const surnames = ['Вельская','Вельский','Миронова','Миронов','Лебедева','Лебедев','Орлова','Орлов','Соколова','Соколов','Белоусова','Белоусов','Волкова','Волков','Морозова','Морозов','Крылова','Крылов','Тихонова','Тихонов'];
const places = ['Белое море','Казань','Владивосток','Тбилиси','Минск','Калининград','Алматы','Пермь','Мурманск','Томск'];
const desires = ['вернуться к морю','услышать знакомый голос','сохранить дом','посадить сад','увидеть северное сияние','найти потерянное письмо','дождаться весны','простить себя','научиться играть','увидеть мир'];
const endings = ['Я ещё успею','Как хорошо, что мы встретились','Я помню этот свет','Ничего страшного','Передай им привет','Пусть будет весна','Я почти вспомнил','Спасибо за всё','Я дома','Завтра будет лучше'];
const childhood = ['В окне дрожал дождь.','Двор пах после грозы.','На подоконнике стояла чашка.','Первый снег растаял на ладони.','Дома всегда горел свет.','Поезд уходил за горизонт.','Море звучало даже ночью.','На полу лежали цветные карандаши.','Кто-то тихо пел на кухне.','Солнце оставляло полосы на стене.'];
const middle = ['Однажды пришлось выбирать между домом и дорогой.','Встреча на остановке изменила всё.','Долгие годы проходили спокойно.','Мечта оказалась дальше, чем казалось.','Однажды пришло письмо без обратного адреса.','Рядом оказался человек, которого не ждали.','Работа отнимала время, но давала надежду.','В незнакомом городе появилось чувство дома.','Одно решение сохранилось в памяти навсегда.','Потерянное не всегда удаётся вернуть.'];
const lifePool = Array.from({length:100}, (_, i) => {
  const gender = i % 2 ? 'm' : 'f';
  const name = `${firstNames[i % 20]} ${surnames[i % 20]}`;
  const place = places[Math.floor(i / 2) % 10];
  // Пока используются общие исторические иллюстрации; не выдаём их за будущее.
  const year = 1940 + (i * 7 % 26);
  const desire = desires[Math.floor(i / 10)];
  const last = endings[(i * 7) % 10];
  return { id:i, gender, name, num:`№ ${String(4918220000 + i).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`, place, year,
    desire, last, memories:[
      { y:String(year), h:'В день твоего рождения шёл дождь.', p:'Ты никогда не вспомнишь этот свет.', fx:'rain', n:18 },
      { y:String(year+7), h:'На кухне кто-то тихо пел.', p:'Голос теряется раньше, чем мелодия.', fx:'ice', n:0 },
      { y:String(year+24), h:'Поезд ушёл без тебя.', p:gender === 'f' ? 'Ты ещё долго стояла на платформе.' : 'Ты ещё долго стоял на платформе.', fx:'split', n:0 },
      { y:String(year+43), h:'Ночью раздался звонок.', p:'Некоторые разговоры продолжаются всю жизнь.', fx:'room', n:0 },
      { y:String(year+68), h:gender === 'f' ? 'Однажды ты увидела море в последний раз.' : 'Однажды ты увидел море в последний раз.', p:gender === 'f' ? 'Ты тогда ещё не знала.' : 'Ты тогда ещё не знал.', fx:'sea', n:0 }
    ] };
});
let offeredLives = [];
function pickLives() {
  const shuffled = [...lifePool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  offeredLives = shuffled.slice(0, 5);
  LIFE = offeredLives[0];
}

// ---------- рендер экранов ----------
function render(html) { stage.innerHTML = html; }

async function titleScreen() {
  AudioLayer.ensure(); AudioLayer.fade(0.0001, 0.1);
  render(`
    <div class="screen title-screen">
      <div class="title-topline"><span>ARCHIVE / 01</span><span>ПОСЛЕ ЧЕЛОВЕКА</span></div>
      <div class="title-wrap">
        <div class="eyebrow">запись найдена · отправитель неизвестен</div>
        <h1 class="title serif">Всё, что от меня<span class="ost" data-t="ОСТАЛОСЬ">ОСТАЛОСЬ</span></h1>
        <p class="title-description">Они думали, что после последнего вдоха<br>никто не услышит тишину.</p>
        <div class="start-row">
          <button class="button primary title-button" data-go="choose">Войти в архив <span>↗</span></button>
        </div>
      </div>
      <div class="title-bottomline"><span>СИСТЕМА НЕ ОБНАРУЖИЛА ВЛАДЕЛЬЦА</span><span>НАУШНИКИ РЕКОМЕНДУЮТСЯ</span></div>
    </div>`);
}

async function chooseScreen() {
  render(`
    <div class="screen archive-screen">
      <div class="life-card">
        <div class="archive-header"><span>АРХИВ / ЗАПИСЬ 01</span><span>● СВЯЗЬ УСТАНОВЛЕНА</span></div>
        <div class="eyebrow archive-kicker">пять записей · один свидетель</div>
        <h2 class="serif">Кем ты был<span> до тишины?</span></h2>
        <div class="life-count">ВЫБЕРИ ЗАПИСЬ. ТЫ УВИДИШЬ ТОЛЬКО ТО, ЧТО НЕ УСПЕЛО ИСЧЕЗНУТЬ.</div>
        <div class="life-options">${offeredLives.map(person => `<button class="life-option ${person.id === LIFE.id ? 'selected' : ''}" data-life="${person.id}" aria-pressed="${person.id === LIFE.id}"><span>${person.name}</span><small>${person.year} · ${person.place}</small></button>`).join('')}</div>
        <div class="fields">
          <div class="field"><span>ОБЪЕКТ</span><b class="mono-digits">${LIFE.num}</b></div>
          <div class="field"><span>ИМЯ</span><b>${LIFE.name}</b></div>
          <div class="field"><span>МЕСТО</span><b>${LIFE.place}</b></div>
          <div class="field"><span>ГОД РОЖДЕНИЯ</span><b class="mono-digits">${LIFE.year}</b></div>
          <div class="field"><span>ОСНОВНОЕ ЖЕЛАНИЕ</span><b>${LIFE.desire}</b></div>
          <div class="field"><span>СОСТОЯНИЕ</span><b style="color:var(--danger)">НЕ НАЙДЕНО</b></div>
          <div class="lastline">ПОСЛЕДНЯЯ МЫСЛЬ · ЗАПИСЬ ПОВРЕЖДЕНА</div>
        </div>
        <div class="row">
          <button class="button primary" data-go="mem">Прожить эту жизнь <span>↗</span></button>
          <button class="button ghost" data-go="reroll">Другая пятёрка</button>
        </div>
      </div>
    </div>`);
}

async function memoryScreen(idx) {
  const m = LIFE.memories[idx];
  const total = LIFE.memories.length;
  const extra = m.fx === "rain" ? `<i style="left:${Array.from({length: m.n}, (_, k) => `${(k * 97) % 101}`).join('%;left:')}%"></i>` : "";
  const rain = m.fx === "rain"
    ? Array.from({ length: m.n }, () => `<i style="left:${Math.random() * 100}%;animation-duration:${0.7 + Math.random() * 0.9}s;animation-delay:${Math.random() * 1.2}s"></i>`).join("")
    : "";
  const cracks = m.fx === "ice"
    ? Array.from({ length: 9 }, (_, k) => `<i style="top:${6 + k * 10.5}%;left:${Math.random() * 20}%;transform:rotate(${(Math.random() * 24 - 12).toFixed(1)}deg);animation-delay:${(k * 0.28).toFixed(2)}s"></i>`).join("")
    : "";
  render(`
    <div class="memory-stage">
      <div style="padding: calc(16px + env(safe-area-inset-top)) 20px 0; display:flex; justify-content:space-between">
        <span class="eyebrow">ВОСПОМИНАНИЕ ${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
        <span class="eyebrow">${LIFE.name}</span>
      </div>
      <div class="scene">
        <div class="fx ${m.fx}">${rain}${cracks}${extra}</div>
        ${m.fx === "room" ? '<div class="fx phone"></div>' : ""}
        <div class="caption">
          <div class="yeartag">${m.y}</div>
          <h2 class="serif" id="cap-h"></h2>
          <p id="cap-p"></p>
        </div>
      </div>
      <div class="bar"><i style="width:${((idx + 1) / total) * 100}%"></i></div>
      <div class="scene-foot">
        <span class="faint" style="font-size:10px">память сохраняется неполностью</span>
        <button class="button primary" data-go="${idx + 1 < total ? "next" : "death"}">${idx + 1 < total ? "Дальше" : "Продолжить"}</button>
      </div>
    </div>`);
  const heading = $("#cap-h"), description = $("#cap-p");
  await typeText(heading, m.h, 20);
  if (heading?.isConnected) await typeText(description, m.p, 10);
}

function transitionToSpace() {
  const variant = LIFE.id % 5;
  render(`<div class="departure departure-${variant}" role="status" aria-label="Переход в космос"><video class="departure-video" autoplay muted playsinline preload="auto" src="assets/departure-hospital.mp4"></video><div class="departure-orbit"></div><div class="departure-light"></div><span>СОЗНАНИЕ ОТДЕЛЯЕТСЯ</span></div>`);
  AudioLayer.ping(180 + variant * 30, 1.2, 0.04);
  const video = $('.departure-video');
  video.addEventListener('playing', () => video.parentElement?.classList.add('video-playing'), { once: true });
  let completed = false;
  const finish = () => { if (!completed && $('.departure')) { completed = true; spaceScreen(); } };
  video.addEventListener('ended', finish, { once: true });
  video.addEventListener('error', () => setTimeout(finish, 2600), { once: true });
  video.play().catch(() => setTimeout(finish, 2600));
  setTimeout(finish, 9000);
}

async function deathScreen() {
  render(`
    <div class="memory-stage">
      <div class="scene">
        <div class="fx whiteout"></div>
        <div class="caption" style="color:#1a221f">
          <div class="yeartag" style="color:#3c4a45">СЕРДЦЕБИЕНИЕ: НЕ ОБНАРУЖЕНО</div>
          <h2 class="serif" id="death-h"></h2>
          <p id="death-p" style="color:#39443f"></p>
        </div>
      </div>
      <div class="scene-foot">
        <span class="faint" style="font-size:10px;color:#39443f">объект больше не числится среди живых</span>
        <button class="button primary" data-go="space" style="border-color:#41534d;color:#101815">Открыть глаза</button>
      </div>
    </div>`);
  await typeText($("#death-h"), LIFE.gender === 'f' ? "Ты умерла." : "Ты умер.", 90);
  await typeText($("#death-p"), "Это не было похоже на конец.", 40);
}

// ============================================================
//  КОСМОС: вид от первого лица. Ты — сущность. Камера = глаза.
// ============================================================
function spaceScreen() {
  render(`
    <canvas id="space"></canvas>
    <div class="hud">
      <div class="hud-row">
        <div class="panel">
          <div class="eyebrow">объект · ${LIFE.name}</div>
          <p>СОСТОЯНИЕ: <b>ПОСЛЕ</b></p>
          <p>ПАМЯТЬ: <b>${LIFE.memories.length} ФРАГМЕНТА</b></p>
        </div>
        <div class="panel" style="text-align:right">
          <div class="eyebrow">навигация</div>
          <p>ДО ЗЕМЛИ: <b id="d-earth">—</b></p>
          <p>ДО СОЛНЦА: <b id="d-moon">—</b></p>
          <p>БЛИЖЕЙШИЙ: <b id="d-near">—</b></p>
          <p>СКОРОСТЬ: <b id="v-now">0.00</b></p>
        </div>
      </div>
      <div class="hud-row" style="align-items:flex-end">
        <div class="dpad" id="dpad">
          <button class="dbtn" data-th="f" aria-label="вперёд">▲</button>
          <button class="dbtn" data-th="l" aria-label="влево">◀</button>
          <button class="dbtn" data-th="b" aria-label="назад">▼</button>
          <button class="dbtn" data-th="r" aria-label="вправо">▶</button>
        </div>
        <div class="stick" id="stick" aria-label="тяга"><i></i></div>
        <div class="keys">
          <button class="button" id="k-scan">Сканировать</button>
          <button class="button ghost" id="k-slow">Стоп</button>
        </div>
      </div>
    </div>
    <div class="hint" id="hint">МЫШЬ — ВЗГЛЯД · WASD / КНОПКИ — ТЯГА · НА МОБИЛЬНОМ: СВАЙП И ДЖОЙСТИК</div>
    <div id="overlay-host"></div>`);

  AudioLayer.ensure();
  AudioLayer.fade(0.16, 3); // тихий гул включается при выходе в космос
  flashOn();

  const canvas = $("#space"), ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;

  // --- камера (глаза сущности): старт у Земли, взгляд на Солнце ---
  const cam = { yaw: -2.47, pitch: 0, pos: { x: 77, y: 1.2, z: 98 }, vel: { x: 0, y: 0, z: 0 } };
  const FOV = 1.05; // радиан по горизонтали

  // --- Солнечная система: Солнце в (0,0,0), планеты на сжатых орбитах вокруг него ---
  // 1 а.е. = 120 R⊕. Игрок стартует у Земли (дистанция 120 от Солнца), видит его прямо перед собой.
  const AU = 120;
  const ORB = (a, ang) => ({ x: Math.cos(ang) * a * AU, z: Math.sin(ang) * a * AU });
  const SUN = { name: "СОЛНЦЕ", x: 0, y: 0, z: 0, r: 18, sun: true, marks: [],
    hi: "rgba(255,252,240,1)", mid: "rgba(255,236,180,1)", lo: "rgba(255,205,110,1)", night: "#ffb050",
    line: "СОЛНЦЕ · ВБЛИЗИ ОНО СЛИШКОМ БОЛЬШОЕ. СИСТЕМА НЕ МОЖЕТ ОПРЕДЕЛИТЬ, ГДЕ ЗАКАНЧИВАЕТСЯ СВЕТ И НАЧИНАЕТСЯ ПАМЯТЬ." };
  const E_ANG = 0.9;
  const EARTH = { name: "ЗЕМЛЯ", ...ORB(1, E_ANG), y: 0, r: 1,
    hi: "rgba(168,205,214,1)", mid: "rgba(52,92,112,1)", lo: "rgba(12,22,30,1)", night: "#010409",
    atmo: true, marks: [],
    line: "ЗЕМЛЯ · ОГНИ ГОРОДОВ ПОГАСЛИ ЦЕЛИКОМ. НО КТО-ТО ВКЛЮЧИЛ ОДИН." };
  const MOON = { name: "ЛУНА", x: EARTH.x + 1.2, y: 0.6, z: EARTH.z - 3.2, r: 0.273,
    hi: "rgba(200,204,200,1)", mid: "rgba(128,133,128,1)", lo: "rgba(24,28,26,1)", night: "#050706",
    marks: [],
    line: "ЛУНА · НА ПОВЕРХНОСТИ СВЕТЯЩЕЕСЯ ОКНО. ТАМ, ГДЕ БЫЛА ТВОЯ КОМНАТА." };
  const PLANETS = [
    { name: "МЕРКУРИЙ", ...ORB(0.39, 2.4), y: -0.8, r: 0.38,
      hi: "rgba(190,178,160,1)", mid: "rgba(110,100,88,1)", lo: "rgba(30,28,25,1)", night: "#050404",
      marks: [{ a: -0.25, b: -0.2, r: 0.2, c: "rgba(60,54,46,0.9)" }, { a: 0.3, b: 0.25, r: 0.15, c: "rgba(60,54,46,0.85)" }],
      line: "МЕРКУРИЙ · ПОВЕРХНОСТЬ КАК ОБЛОЖКА ДНЕВНИКА, КОТОРЫЙ НИКОГДА НЕ ЧИТАЛИ." },
    { name: "ВЕНЕРА", ...ORB(0.72, 4.4), y: 0.9, r: 0.95,
      hi: "rgba(235,214,170,1)", mid: "rgba(180,150,105,1)", lo: "rgba(60,48,30,1)", night: "#070502",
      marks: [], atmo: true, atmoColor: "rgba(220,190,130,0.25)",
      line: "ВЕНЕРА · ОБЛАКА ДВИЖУТСЯ БЫСТРЕЕ, ЧЕМ ВРАЩАЕТСЯ ПЛАНЕТА. ЗДЕСЬ НИКОГДА НЕ БЫЛО НИКОГО." },
    { name: "МАРС", ...ORB(1.52, 0.2), y: 1.2, r: 0.53,
      hi: "rgba(215,150,110,1)", mid: "rgba(140,80,55,1)", lo: "rgba(40,22,15,1)", night: "#060302",
      marks: [{ a: -0.3, b: 0.1, r: 0.22, c: "rgba(90,45,30,0.8)" }, { a: 0.25, b: -0.35, r: 0.16, c: "rgba(235,235,235,0.7)" }],
      line: "МАРС · НА ПОВЕРХНОСТИ ОБЪЕКТ, КОТОРОГО НЕ БЫЛО В КАТАЛОГАХ. ФОРМА ЗНАКОМА. ПРИЧИНА НЕТ." },
    { name: "ЮПИТЕР", ...ORB(2.8, 3.1), y: 3.5, r: 5.5,
      hi: "rgba(228,208,180,1)", mid: "rgba(165,130,100,1)", lo: "rgba(50,38,28,1)", night: "#070503",
      marks: [{ a: -0.35, b: 0.2, r: 0.16, c: "rgba(190,90,70,0.8)" }, { a: 0.15, b: -0.3, r: 0.3, c: "rgba(220,200,175,0.5)" }, { a: 0.4, b: 0.05, r: 0.22, c: "rgba(150,110,85,0.6)" }, { a: -0.1, b: 0.45, r: 0.18, c: "rgba(200,175,150,0.5)" }],
      line: "ЮПИТЕР · НА ОРБИТЕ СПУТНИК С ТВОИМ ИМЕНЕМ. ОН ПЕРЕДАЕТ ЕГО ДАЛЬШЕ. КОМУ — НЕИЗВЕСТНО." },
    { name: "САТУРН", ...ORB(4.2, 5.3), y: -2.8, r: 4.6, ring: true,
      hi: "rgba(230,214,180,1)", mid: "rgba(170,150,115,1)", lo: "rgba(55,45,32,1)", night: "#060503",
      marks: [{ a: 0.2, b: -0.25, r: 0.25, c: "rgba(210,190,155,0.5)" }],
      line: "САТУРН · КОЛЬЦА СОСТОЯТ ИЗ ОБЛОМКОВ ЧЕГО-ТО, ЧТО БЫЛО ЦЕЛЫМ. СИСТЕМА НЕ УТОЧНЯЕТ ЧЕМ." },
    { name: "УРАН", ...ORB(5.8, 1.7), y: 4.2, r: 2,
      hi: "rgba(180,220,225,1)", mid: "rgba(110,160,170,1)", lo: "rgba(30,50,55,1)", night: "#030607", atmo: true, atmoColor: "rgba(160,210,215,0.2)",
      marks: [], line: "УРАН · ПЛАНЕТА ЛЕЖИТ НА БОКУ. ЗДЕСЬ ЭТО ВЫГЛЯДИТ НЕ КАК ОСОБЕННОСТЬ, А КАК ПОЗА." },
    { name: "НЕПТУН", ...ORB(7.2, 3.9), y: -3.5, r: 1.9,
      hi: "rgba(140,170,230,1)", mid: "rgba(70,95,160,1)", lo: "rgba(20,28,55,1)", night: "#020308", atmo: true, atmoColor: "rgba(130,160,220,0.22)",
      marks: [{ a: -0.2, b: -0.3, r: 0.2, c: "rgba(40,55,100,0.7)" }],
      line: "НЕПТУН · ПОСЛЕДНЯЯ ПЛАНЕТА. ДАЛЬШЕ СИСТЕМА ПЕРЕСТАЕТ ОТВЕЧАТЬ НА ВОПРОС «ЧТО ДАЛЬШЕ»." },
  ];
  const BODIES = [SUN, EARTH, MOON, ...PLANETS];
  // Художественно ускоренное движение: орбиты заметны в игровом времени,
  // но это не точные эфемериды и не реальная скорость планет.
  const orbiting = [EARTH, ...PLANETS].map((body, index) => ({
    body, radius: Math.hypot(body.x, body.z), angle: Math.atan2(body.z, body.x),
    speed: [0.0012, 0.003, 0.002, 0.0008, 0.00035, 0.00022, 0.00013, 0.00008][index]
  }));
  const moonOffset = { x: MOON.x - EARTH.x, z: MOON.z - EARTH.z };

  // Реальные сферы WebGL; существующий canvas остаётся резервным вариантом.
  let space3d = null;
  if (window.THREE) {
    try {
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(stage.clientWidth, stage.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.className = 'space-webgl';
      canvas.insertAdjacentElement('afterend', renderer.domElement);
      const scene = new THREE.Scene();
      const sky = new THREE.TextureLoader().load('assets/milky-way-8k.jpg');
      sky.mapping = THREE.EquirectangularReflectionMapping;
      sky.colorSpace = THREE.SRGBColorSpace;
      sky.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      scene.background = sky;
      // Звёзды — отдельные точки, а не увеличенные пиксели панорамы.
      // Фиксированная последовательность сохраняет рисунок между запусками.
      let starSeed = 73841;
      const starRandom = () => { starSeed = (starSeed * 1664525 + 1013904223) >>> 0; return starSeed / 4294967296; };
      const starCount = 2800;
      const starPositions = new Float32Array(starCount * 3);
      const starColors = new Float32Array(starCount * 3);
      const starSizes = new Float32Array(starCount);
      for (let i = 0; i < starCount; i++) {
        const y = starRandom() * 2 - 1, angle = starRandom() * Math.PI * 2;
        const r = Math.sqrt(1 - y * y), radius = 1800;
        starPositions.set([Math.cos(angle) * r * radius, y * radius, Math.sin(angle) * r * radius], i * 3);
        const brightness = 0.24 + Math.pow(starRandom(), 3) * 0.76;
        const warmth = starRandom();
        starColors.set([brightness * (warmth < .18 ? 1 : .83), brightness * .9, brightness * (warmth < .18 ? .72 : 1)], i * 3);
        starSizes[i] = 1.2 + Math.pow(starRandom(), 5) * 3.8;
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
      starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
      const starMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexColors: true,
        vertexShader: `attribute float size; varying vec3 vColor; uniform float uTime; void main(){ vColor=color; vec4 mvPosition=modelViewMatrix*vec4(position,1.0); float pulse=0.82+0.18*sin(uTime*(0.35+size*.12)+position.x*.017); gl_PointSize=size*pulse; gl_Position=projectionMatrix*mvPosition; }`,
        fragmentShader: `varying vec3 vColor; void main(){ float d=length(gl_PointCoord-vec2(.5)); float a=smoothstep(.5,.06,d); gl_FragColor=vec4(vColor,a); }`
      });
      const starField = new THREE.Points(starGeometry, starMaterial);
      starField.frustumCulled = false;
      scene.add(starField);

      // Процедурные туманности: не одна размытая панорама, а несколько
      // полупрозрачных облаков, которые медленно меняют яркость и смещаются.
      const nebulaTexture = (hue, seed) => {
        const c = document.createElement('canvas'); c.width = 768; c.height = 512;
        const x = c.getContext('2d');
        x.clearRect(0, 0, c.width, c.height);
        for (let i = 0; i < 22; i++) {
          const px = ((seed * 97 + i * 173) % 1000) / 1000 * c.width;
          const py = ((seed * 53 + i * 311) % 1000) / 1000 * c.height;
          const rx = 55 + ((seed + i * 41) % 150), ry = 25 + ((seed + i * 23) % 90);
          const g = x.createRadialGradient(px, py, 0, px, py, Math.max(rx, ry));
          g.addColorStop(0, `hsla(${hue},72%,64%,${0.12 + (i % 4) * 0.025})`);
          g.addColorStop(.38, `hsla(${hue + 18},68%,45%,${0.06 + (i % 3) * 0.018})`);
          g.addColorStop(1, `hsla(${hue + 30},60%,25%,0)`);
          x.save(); x.translate(px, py); x.scale(1, ry / rx); x.translate(-px, -py);
          x.fillStyle = g; x.fillRect(px - rx, py - rx, rx * 2, rx * 2); x.restore();
        }
        const texture = new THREE.CanvasTexture(c);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
      };
      const nebulaGroup = new THREE.Group();
      const nebulaDefs = [
        { p: [-560, 110, -720], s: [720, 420], hue: 205, opacity: .72, seed: 3 },
        { p: [390, -120, -860], s: [620, 360], hue: 285, opacity: .52, seed: 9 },
        { p: [-850, 310, 180], s: [540, 300], hue: 178, opacity: .43, seed: 17 },
        { p: [720, 260, 520], s: [650, 360], hue: 32, opacity: .32, seed: 25 },
        { p: [0, -420, -1050], s: [900, 300], hue: 224, opacity: .35, seed: 31 }
      ];
      const nebulaSprites = nebulaDefs.map((n, i) => {
        const material = new THREE.SpriteMaterial({ map: nebulaTexture(n.hue, n.seed), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: n.opacity, color: 0xffffff });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(...n.p); sprite.scale.set(n.s[0], n.s[1], 1); sprite.userData = { base: n.opacity, phase: i * 1.7 };
        nebulaGroup.add(sprite); return sprite;
      });
      scene.add(nebulaGroup);
      scene.add(new THREE.AmbientLight(0x4f6075, 0.55));
      const light = new THREE.PointLight(0xffefce, 3, 0, 0);
      light.position.set(0, 0, 0); scene.add(light);
      const camera = new THREE.PerspectiveCamera(55, stage.clientWidth / stage.clientHeight, 0.03, 5000);
      const geometry = new THREE.SphereGeometry(1, 64, 40);
      const loader = new THREE.TextureLoader();
      const names = { 'СОЛНЦЕ':'sun', 'ЗЕМЛЯ':'earth', 'ЛУНА':'moon', 'МЕРКУРИЙ':'mercury', 'ВЕНЕРА':'venus', 'МАРС':'mars', 'ЮПИТЕР':'jupiter', 'САТУРН':'saturn', 'УРАН':'uranus', 'НЕПТУН':'neptune' };
      const meshes = [];
      for (const body of BODIES) {
        const texture = loader.load(`assets/${names[body.name]}.jpg`);
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = body.sun ? new THREE.MeshBasicMaterial({ map: texture, color: 0xffdbac }) : new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(body.x, body.y, body.z); mesh.scale.setScalar(body.r);
        scene.add(mesh); meshes.push(mesh);
        if (body.ring) {
          const rings = new THREE.Mesh(new THREE.RingGeometry(body.r * 1.3, body.r * 2.1, 96), new THREE.MeshBasicMaterial({ color: 0xc8b898, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
          rings.rotation.x = Math.PI / 2.3; rings.position.copy(mesh.position); scene.add(rings);
          mesh.userData.orbitalRings = rings;
        }
      }
      space3d = { renderer, scene, camera, meshes, starField, starMaterial, nebulaGroup, nebulaSprites };
    } catch (error) { console.warn('WebGL недоступен; используется резервный рендер', error); }
  }

  // звёзды: точки на далёкой сфере (3D, вращаются с камерой => настоящий параллакс вокруг)
  const STARS = Array.from({ length: 900 }, () => {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return { x: s * Math.cos(a), y: u, z: s * Math.sin(a), m: 0.3 + Math.random() * 0.7, c: Math.random() };
  });
  // тусклая пылевая полоса (млечный путь)
  const DUST = Array.from({ length: 260 }, () => {
    const a = Math.random() * Math.PI * 2;
    const band = (Math.random() - 0.5) * 0.35;
    const x = Math.cos(a), y0 = Math.sin(a) * 0.42 + band, z = Math.sin(a);
    const n = Math.hypot(x, y0, z);
    return { x, y: y0 / n, z: z / n, m: 0.12 + Math.random() * 0.3 };
  });

  const state = { dead: false, raf: 0, t: 0, thrust: { x: 0, y: 0 }, events: { earth: false, moon: false, far: false }, scanT: 0 };

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = stage.clientWidth; H = stage.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  addEventListener("resize", resize);

  // --- ориентация камеры: yaw/pitch -> базис (с учётом «дыхания») ---
  function basis(yaw = cam.yaw, pitch = cam.pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    return {
      f: { x: sy * cp, y: sp, z: cy * cp },              // вперёд
      r: { x: cy, y: 0, z: -sy },                        // вправо
      u: { x: -sy * sp, y: cp, z: -cy * sp },            // вверх
    };
  }
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

  // проекция мировой точки в экран; возвращает {x, y, depth, ok}
  function project(p, B) {
    const rx = p.x - cam.pos.x, ry = p.y - cam.pos.y, rz = p.z - cam.pos.z;
    const cx = dot({ x: rx, y: ry, z: rz }, B.r);
    const cyv = dot({ x: rx, y: ry, z: rz }, B.u);
    const cz = dot({ x: rx, y: ry, z: rz }, B.f);
    if (cz <= 0.01) return { ok: false };
    const f = (W / 2) / Math.tan(FOV / 2);
    return { ok: true, x: W / 2 + (cx / cz) * f, y: H / 2 - (cyv / cz) * f, depth: cz, cx, cy: cyv, cz };
  }

  // --- отрисовка сферы с объёмным шейдингом (3D-освещение, терминатор, лимб) ---
  function drawPlanet(p, B, opts) {
    const pr = project({ x: p.x, y: p.y, z: p.z }, B);
    const dist = Math.hypot(p.x - cam.pos.x, p.y - cam.pos.y, p.z - cam.pos.z) - p.r;
    const f = (W / 2) / Math.tan(FOV / 2);
    const R = (p.r / Math.max(dist, p.r)) * f;
    const R2 = R;
    if (!pr.ok) return;
    const sx = pr.ok ? pr.x : W / 2 + (dot({ x: p.x - cam.pos.x, y: p.y - cam.pos.y, z: p.z - cam.pos.z }, B.r) < 0 ? -1 : 1) * W;
    const sy2 = pr.ok ? pr.y : H / 2;

    // --- Солнце как физическое тело: самосветящийся шар + корона ---
    if (opts.sun) {
      ctx.save();
      // корона в несколько слоёв
      const cg = ctx.createRadialGradient(sx, sy2, R2 * 0.8, sx, sy2, R2 * 2.8);
      cg.addColorStop(0, "rgba(255,245,210,0.85)");
      cg.addColorStop(0.25, "rgba(255,200,90,0.35)");
      cg.addColorStop(0.65, "rgba(255,130,40,0.1)");
      cg.addColorStop(1, "rgba(255,100,20,0)");
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(sx, sy2, R2 * 2.8, 0, Math.PI * 2); ctx.fill();
      // само ядро: слепящий белый центр с жёлтым краем
      const core = ctx.createRadialGradient(sx, sy2, 0, sx, sy2, R2);
      core.addColorStop(0, "#ffffff");
      core.addColorStop(0.5, "rgba(255,250,225,1)");
      core.addColorStop(0.9, "rgba(255,215,120,1)");
      core.addColorStop(1, "rgba(255,160,50,1)");
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(sx, sy2, R2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (R2 > 6 && dist < 120) {
        ctx.fillStyle = "rgba(255,220,160,0.75)";
        ctx.font = "10px 'Courier New'";
        ctx.fillText(opts.label, sx - R2 * 0.4, sy2 + R2 + 18);
      }
      return { sx, sy: sy2, R: R2, dist };
    }

    // вектор света на планету — ИДЁТ ИЗ СОЛНЦА (0,0,0) в точку планеты p
    // (настоящая физика: освещена та сторона планеты, что смотрит на Солнце!)
    const toSun = { x: -p.x, y: -p.y, z: -p.z };
    const sunLen = Math.hypot(toSun.x, toSun.y, toSun.z) || 1;
    const L = { x: toSun.x / sunLen, y: toSun.y / sunLen, z: toSun.z / sunLen };
    const sunX = dot(L, B.r), sunY = -dot(L, B.u);

    // наклон терминатора: считаем угол между направлением на камеру и на солнце
    const toCam = { x: cam.pos.x - p.x, y: cam.pos.y - p.y, z: cam.pos.z - p.z };
    const nl = Math.hypot(toCam.x, toCam.y, toCam.z); toCam.x /= nl; toCam.y /= nl; toCam.z /= nl;
    const phase = dot(toCam, L); // 1 = полное освещение, -1 = тьма

    ctx.save();
    // внешняя атмосфера / гало (индивидуальный цвет или стандартный голубой)
    if (opts.atmo) {
      const ac = opts.atmoColor || "rgba(110,185,205,0.35)";
      const g = ctx.createRadialGradient(sx, sy2, R2 * 0.9, sx, sy2, R2 * 1.18);
      g.addColorStop(0, ac);
      g.addColorStop(0.5, ac.replace(/[\d.]+\)$/, "0.12)"));
      g.addColorStop(1, ac.replace(/[\d.]+\)$/, "0)"));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy2, R2 * 1.18, 0, Math.PI * 2); ctx.fill();
    }
    // диск + объёмный шейдинг
    ctx.beginPath(); ctx.arc(sx, sy2, R2, 0, Math.PI * 2); ctx.clip();
    // база: сферический градиент со смещением к свету (даёт 3D-объём)
    const lx = sunX * R2 * 0.62, ly = sunY * R2 * 0.62;
    const day = ctx.createRadialGradient(sx + lx, sy2 + ly, R2 * 0.05, sx + lx * 0.3, sy2 + ly * 0.3, R2 * 1.6);
    day.addColorStop(0, opts.hi);
    day.addColorStop(0.4, opts.mid);
    day.addColorStop(0.8, opts.lo);
    day.addColorStop(1, opts.night || "#02040a");
    ctx.fillStyle = day;
    ctx.fillRect(sx - R2, sy2 - R2, R2 * 2, R2 * 2);
    // тень-терминатор: тёмный полукруг с той стороны, куда не достаёт свет
    const shX = -sunX, shY = -sunY;
    const term = ctx.createRadialGradient(sx + shX * R2 * 0.9, sy2 + shY * R2 * 0.9, R2 * 0.1, sx + shX * R2 * 0.55, sy2 + shY * R2 * 0.55, R2 * 1.45);
    term.addColorStop(0, "rgba(1,3,7,0.92)");
    term.addColorStop(0.55, "rgba(1,3,7,0.55)");
    term.addColorStop(1, "rgba(1,3,7,0)");
    ctx.globalAlpha = clamp(0.45 + (1 - phase) * 0.4, 0.35, 0.95);
    ctx.fillStyle = term;
    ctx.fillRect(sx - R2, sy2 - R2, R2 * 2, R2 * 2);
    ctx.globalAlpha = 1;
    // пятна поверхности с 3D-смещением (имитация сферности: сжимаются к лимбу)
    for (const s of opts.marks) {
      const px = sx + s.a * R2, py = sy2 + s.b * R2;
      const sq = 1 - Math.min(1, Math.hypot(s.a, s.b) * 0.55); // сжатие у края
      const rr = s.r * R2 * (0.6 + sq * 0.4);
      if (rr < 0.5) continue;
      ctx.fillStyle = s.c;
      ctx.globalAlpha = 0.55 * (0.4 + sq * 0.6);
      ctx.beginPath(); ctx.ellipse(px, py, rr, rr * (0.7 + sq * 0.3), 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // лимб: тонкий световой ободок со стороны солнца
    ctx.strokeStyle = "rgba(220,240,240,0.18)";
    ctx.lineWidth = Math.max(1, R2 * 0.02);
    ctx.beginPath(); ctx.arc(sx, sy2, R2 * 0.995, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // кольца (Сатурн): рисуются поверх диска с наклоном
    if (opts.ring && R2 > 3) {
      ctx.save();
      const tilt = -0.38;
      for (let i = 0; i < 4; i++) {
        const k = 1.45 + i * 0.16;
        ctx.strokeStyle = `rgba(205,190,160,${0.28 - i * 0.05})`;
        ctx.lineWidth = Math.max(1, R2 * (0.09 - i * 0.015));
        ctx.beginPath();
        ctx.ellipse(sx, sy2, R2 * k, R2 * k * 0.34, tilt, 0, Math.PI * 2);
        ctx.stroke();
      }
      // тень планеты на кольцах: затемняем заднюю дугу
      ctx.strokeStyle = "rgba(2,4,8,0.55)";
      ctx.lineWidth = Math.max(2, R2 * 0.22);
      ctx.beginPath();
      ctx.ellipse(sx, sy2, R2 * 1.7, R2 * 1.7 * 0.34, tilt, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.restore();
    }

    // подпись
    if (R > 6 && dist < 60) {
      ctx.fillStyle = "rgba(150,180,175,0.55)";
      ctx.font = "10px 'Courier New'";
      ctx.fillText(opts.label, sx - R2 * 0.5, sy2 + R2 + 16);
    }
    return { sx, sy: sy2, R: R2, dist };
  }

  const EARTH_MARKS = [
    { a: -0.32, b: -0.18, r: 0.34, c: "rgba(40,80,55,0.85)" }, { a: 0.22, b: 0.14, r: 0.26, c: "rgba(45,85,60,0.8)" },
    { a: 0.05, b: -0.42, r: 0.2, c: "rgba(240,246,248,0.75)" }, { a: -0.15, b: 0.38, r: 0.3, c: "rgba(240,246,248,0.65)" },
    { a: 0.45, b: -0.1, r: 0.18, c: "rgba(40,80,55,0.7)" },
  ];
  const MOON_MARKS = [
    { a: -0.2, b: -0.25, r: 0.16, c: "rgba(70,76,72,0.9)" }, { a: 0.3, b: 0.1, r: 0.12, c: "rgba(70,76,72,0.85)" },
    { a: 0.0, b: 0.4, r: 0.18, c: "rgba(70,76,72,0.8)" }, { a: -0.4, b: 0.2, r: 0.1, c: "rgba(70,76,72,0.8)" },
  ];
  EARTH.marks = EARTH_MARKS;
  MOON.marks = MOON_MARKS;

  // --- объём мира: поле обломков и мёртвая станция ---
  const DEBRIS = Array.from({ length: 140 }, () => {
    const a = Math.random() * Math.PI * 2, rr = 3 + Math.random() * 14;
    return { x: Math.cos(a) * rr, y: (Math.random() - 0.5) * 4, z: Math.sin(a) * rr * 0.6 - 5,
      s: 0.02 + Math.random() * 0.06, spin: Math.random() * Math.PI, drift: 0.02 + Math.random() * 0.05 };
  });
  const STATION = { x: -7.5, y: 1.8, z: -7.5 };
  function worldPts(B, list, draw) {
    const f = (W / 2) / Math.tan(FOV / 2);
    const arr = [];
    for (const o of list) {
      const pr = project(o, B);
      if (!pr.ok) continue;
      arr.push({ o, pr });
    }
    arr.sort((a, b) => b.pr.depth - a.pr.depth); // дальние раньше
    for (const it of arr) draw(it.o, it.pr, f);
  }

  // --- главный цикл ---
  function frame() {
    if (state.dead) return;
    state.t += 1 / 60;
    for (const orbit of orbiting) {
      const angle = orbit.angle + state.t * orbit.speed;
      orbit.body.x = Math.cos(angle) * orbit.radius;
      orbit.body.z = Math.sin(angle) * orbit.radius;
    }
    const moonAngle = state.t * 0.006;
    MOON.x = EARTH.x + moonOffset.x * Math.cos(moonAngle) - moonOffset.z * Math.sin(moonAngle);
    MOON.z = EARTH.z + moonOffset.x * Math.sin(moonAngle) + moonOffset.z * Math.cos(moonAngle);
    // «дыхание» сущности: едва заметное покачивание взгляда
    const brY = Math.sin(state.t * 0.5) * 0.006, brP = Math.cos(state.t * 0.34) * 0.004;
    const B = basis(cam.yaw + brY, cam.pitch + brP);

    // физика полёта: тяга по направлению взгляда + дрейф (дистанции реальные — тяга высокая)
    const accel = 28;
    cam.vel.x += (B.f.x * state.thrust.y + B.r.x * state.thrust.x) * accel / 60;
    cam.vel.y += (B.f.y * state.thrust.y + B.r.y * state.thrust.x) * accel / 60;
    cam.vel.z += (B.f.z * state.thrust.y + B.r.z * state.thrust.x) * accel / 60;
    cam.vel.x *= 0.985; cam.vel.y *= 0.985; cam.vel.z *= 0.985; // инерция/затухание
    cam.pos.x += cam.vel.x / 60; cam.pos.y += cam.vel.y / 60; cam.pos.z += cam.vel.z / 60;

    // фон: глубокая пустота
    ctx.fillStyle = "#020408";
    ctx.fillRect(0, 0, W, H);

    // звёзды и пыль: точки на единичной сфере, повёрнутой камерой
    const f = (W / 2) / Math.tan(FOV / 2);
    function skyPts(pts, size, tint) {
      for (const s of pts) {
        const cx = dot(s, B.r), cyv = dot(s, B.u), cz = dot(s, B.f);
        if (cz <= 0.02) continue;
        const x = W / 2 + (cx / cz) * f, y = H / 2 - (cyv / cz) * f;
        const tw = 0.75 + 0.25 * Math.sin(state.t * 1.7 + s.m * 40);
        ctx.globalAlpha = s.m * tw;
        ctx.fillStyle = tint(s);
        ctx.beginPath(); ctx.arc(x, y, size * s.m, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    skyPts(DUST, 1.6, (s) => "rgba(140,165,180,0.5)");
    skyPts(STARS, 1.9, (s) => s.c < 0.12 ? "rgba(180,200,235,0.9)" : s.c < 0.24 ? "rgba(230,210,180,0.9)" : "rgba(210,225,222,0.9)");

    // все тела системы: рисуем по глубине (дальние — первыми)
    let nearest = { name: "—", d: Infinity };
    const draws = [];
    for (const b of BODIES) {
      const d = Math.hypot(cam.pos.x - b.x, cam.pos.y - b.y, cam.pos.z - b.z) - b.r;
      if (d < nearest.d) nearest = { name: b.name, d };
      draws.push({ b, d });
    }
    draws.sort((a, b) => b.d - a.d);
    let moonHit = null;
    for (const it of draws) {
      const b = it.b;
      const o = {
        label: b.name,
        hi: b.hi, mid: b.mid, lo: b.lo, night: b.night,
        atmo: b.atmo, atmoColor: b.atmoColor, marks: b.marks || [], ring: b.ring,
        sun: b.sun,
      };
      const res = space3d ? project(b, B) : drawPlanet(b, B, o);
      if (b === MOON) moonHit = res;
      // приближение к телу: одноразовое системное сообщение
      if (res && it.d < 3 && !state.events[b.name]) {
        state.events[b.name] = true;
        if (b === MOON) { eventMoon(); }
        else { AudioLayer.ping(300, 0.8, 0.06); toast(`<span style="color:var(--cyan)">${b.name}</span><br>${b.line}`); }
      }
    }

    if (space3d) {
      const { renderer, scene, camera, meshes, starField, starMaterial, nebulaGroup, nebulaSprites } = space3d;
      if (camera.aspect !== W / H) { camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H); }
      camera.position.set(cam.pos.x, cam.pos.y, cam.pos.z);
      starField.position.copy(camera.position);
      starField.rotation.y = state.t * 0.00018;
      starMaterial.uniforms.uTime.value = state.t;
      nebulaGroup.rotation.y = state.t * 0.00008;
      nebulaSprites.forEach(sprite => {
        sprite.material.opacity = sprite.userData.base * (0.82 + 0.18 * Math.sin(state.t * 0.16 + sprite.userData.phase));
      });
      camera.lookAt(cam.pos.x + B.f.x, cam.pos.y + B.f.y, cam.pos.z + B.f.z);
      meshes.forEach((mesh, i) => {
        const body = BODIES[i];
        mesh.position.set(body.x, body.y, body.z);
        mesh.rotation.y = state.t * (i === 0 ? 0.015 : 0.006);
        if (mesh.userData.orbitalRings) mesh.userData.orbitalRings.position.copy(mesh.position);
      });
      renderer.render(scene, camera);
    }

    // поле обломков: 3D-точки в мировых координатах (настоящий параллакс)
    worldPts(B, DEBRIS, (o, pr, fo) => {
      const d = pr.depth;
      if (d < 0.4) return;
      const sz = Math.max(1, (o.s / d) * fo);
      ctx.globalAlpha = clamp(1.2 / d, 0.06, 0.6);
      ctx.fillStyle = "rgba(120,135,132,0.9)";
      ctx.fillRect(pr.x - sz / 2, pr.y - sz / 2, sz, sz);
    });
    ctx.globalAlpha = 1;

    // станция-призрак: крошечный крест с мигающим огнём
    {
      const pr = project(STATION, B);
      if (pr.ok && pr.depth > 0.5) {
        const s = Math.max(2, (0.06 / pr.depth) * f);
        ctx.strokeStyle = "rgba(160,175,170,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pr.x - s, pr.y); ctx.lineTo(pr.x + s, pr.y);
        ctx.moveTo(pr.x, pr.y - s); ctx.lineTo(pr.x, pr.y + s);
        ctx.stroke();
        if (Math.sin(state.t * 2.4) > 0.86) {
          ctx.fillStyle = "rgba(200,90,80,0.9)";
          ctx.beginPath(); ctx.arc(pr.x, pr.y, Math.max(1.5, s * 0.18), 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // HUD-дистанции
    const dE = Math.hypot(cam.pos.x - EARTH.x, cam.pos.y - EARTH.y, cam.pos.z - EARTH.z) - EARTH.r;
    const dM = Math.hypot(cam.pos.x - MOON.x, cam.pos.y - MOON.y, cam.pos.z - MOON.z) - MOON.r;
    const dS = Math.hypot(cam.pos.x, cam.pos.y, cam.pos.z) - SUN.r;
    const v = Math.hypot(cam.vel.x, cam.vel.y, cam.vel.z);
    $("#d-earth").textContent = dE.toFixed(1) + " R";
    $("#d-moon").textContent = dS.toFixed(1) + " R (СОЛНЦЕ)";
    $("#v-now").textContent = v.toFixed(1);
    const nearEl = $("#d-near");
    if (nearEl) nearEl.textContent = `${nearest.name} · ${nearest.d.toFixed(1)} R`;

    // события по мере полёта: теперь относительно Земли в её реальной точке орбиты
    if (!state.events.earth && dE > 22) { state.events.earth = true; eventEarthFar(); }
    if (!state.events.far && dS > 700) { state.events.far = true; eventSignal(); }

    state.raf = requestAnimationFrame(frame);
  }

  // --- управление: взгляд (drag по экрану) ---
  let look = null;
  canvas.addEventListener("pointerdown", (e) => { look = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!look || e.pointerId !== look.id) return;
    cam.yaw += (e.clientX - look.x) / W * 2.4;
    cam.pitch = clamp(cam.pitch + (e.clientY - look.y) / H * 2.4, -1.35, 1.35);
    look = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  const endLook = () => { look = null; };
  canvas.addEventListener("pointerup", endLook);
  canvas.addEventListener("pointercancel", endLook);

  // --- джойстик тяги ---
  const stick = $("#stick"), knob = stick.querySelector("i");
  let joy = null;
  stick.addEventListener("pointerdown", (e) => { joy = { id: e.pointerId }; stick.setPointerCapture(e.pointerId); moveStick(e); });
  const moveStick = (e) => {
    if (!joy || e.pointerId !== joy.id) return;
    const r = stick.getBoundingClientRect();
    const dx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
    const dy = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
    state.thrust.x = dx; state.thrust.y = -dy; // вверх = вперёд
    knob.style.transform = `translate(${dx * 26}px, ${dy * 26}px)`;
  };
  stick.addEventListener("pointermove", moveStick);
  const endStick = () => { joy = null; state.thrust = { x: 0, y: 0 }; knob.style.transform = "translate(0,0)"; };
  stick.addEventListener("pointerup", endStick);
  stick.addEventListener("pointercancel", endStick);

  // --- кнопки движения (для ПК / мыши) ---
  const TH = { f: { x: 0, y: 1 }, b: { x: 0, y: -1 }, l: { x: -1, y: 0 }, r: { x: 1, y: 0 } };
  const dpad = $("#dpad");
  const keyThrust = { f: false, b: false, l: false, r: false };
  function applyKeyThrust() {
    const y = (keyThrust.f ? 1 : 0) - (keyThrust.b ? 1 : 0);
    const x = (keyThrust.r ? 1 : 0) - (keyThrust.l ? 1 : 0);
    state.thrust.x = x; state.thrust.y = y;
    dpad.querySelectorAll(".dbtn").forEach(b => {
      const on = keyThrust[b.dataset.th];
      b.classList.toggle("held", on);
    });
  }
  dpad.querySelectorAll(".dbtn").forEach(b => {
    const k = b.dataset.th;
    const on = (e) => { e.preventDefault(); keyThrust[k] = true; applyKeyThrust(); };
    const off = () => { keyThrust[k] = false; applyKeyThrust(); };
    b.addEventListener("pointerdown", on);
    b.addEventListener("pointerup", off);
    b.addEventListener("pointerleave", off);
    b.addEventListener("pointercancel", off);
  });
  // клавиатура: WASD / стрелки
  const KEYS = { KeyW: "f", ArrowUp: "f", KeyS: "b", ArrowDown: "b", KeyA: "l", ArrowLeft: "l", KeyD: "r", ArrowRight: "r" };
  const onKD = (e) => { const k = KEYS[e.code]; if (k && !keyThrust[k]) { keyThrust[k] = true; applyKeyThrust(); } };
  const onKU = (e) => { const k = KEYS[e.code]; if (k) { keyThrust[k] = false; applyKeyThrust(); } };
  if (window.__spaceKD) { removeEventListener("keydown", window.__spaceKD); removeEventListener("keyup", window.__spaceKU); }
  window.__spaceKD = onKD; window.__spaceKU = onKU;
  addEventListener("keydown", onKD);
  addEventListener("keyup", onKU);

  $("#k-slow").onclick = () => { cam.vel = { x: 0, y: 0, z: 0 }; AudioLayer.ping(180, 0.4, 0.05); };
  $("#k-scan").onclick = () => {
    AudioLayer.ping(760, 0.6, 0.1);
    const dE = Math.hypot(cam.pos.x - EARTH.x, cam.pos.y - EARTH.y, cam.pos.z - EARTH.z) - EARTH.r;
    const dS = Math.hypot(cam.pos.x, cam.pos.y, cam.pos.z) - SUN.r;
    let near = { name: "—", d: Infinity };
    for (const b of BODIES) {
      const d = Math.hypot(cam.pos.x - b.x, cam.pos.y - b.y, cam.pos.z - b.z) - b.r;
      if (d < near.d) near = { name: b.name, d };
    }
    let msg;
    if (near.name === "СОЛНЦЕ" && near.d < 25) msg = `СОЛНЦЕ · дистанция ${near.d.toFixed(1)} R<br>ТЕЛО ОБЛЕТЕЛО ЦЕНТР СИСТЕМЫ.<br><span style="color:var(--danger)">РАДИАЦИЯ НЕ ИМЕЕТ СМЫСЛА ДЛЯ ТОГО, ЧТО ОСТАЛОСЬ.</span>`;
    else if (near.name === "ЛУНА" && near.d < 3) msg = `ЛУНА · дистанция ${near.d.toFixed(2)} R<br>НА ПОВЕРХНОСТИ: СВЕТЯЩЕЕСЯ ОКНО.<br><span style="color:var(--danger)">ТАМ, ГДЕ БЫЛА ТВОЯ КОМНАТА.</span>`;
    else if (near.name === "ЗЕМЛЯ" && near.d < 3.2) msg = `ЗЕМЛЯ · дистанция ${near.d.toFixed(2)} R<br>ОГНИ ГОРОДОВ ПОГАСЛИ ЦЕЛИКОМ.<br><span style="color:var(--danger)">НО КТО-ТО ВКЛЮЧИЛ ОДИН.</span>`;
    else msg = `БЛИЖАЙШИЙ ОБЪЕКТ: ${near.name} · ${near.d.toFixed(1)} R<br>ДО СОЛНЦА: ${dS.toFixed(1)} R · ДО ЗЕМЛИ: ${dE.toFixed(1)} R<br>ТЕЛ В СИСТЕМЕ: ${BODIES.length}. ПУСТОТЫ БОЛЬШЕ, ЧЕМ МАТЕРИИ.`;
    showOverlay({ cy: true, title: "СКАНИРОВАНИЕ СЕКТОРА", body: msg, actions: [["Понял", null]] });
  };

  // --- события ---
  function showOverlay({ cy, title, body, quote, actions }) {
    const host = $("#overlay-host");
    host.innerHTML = `<div class="overlay"><div class="card ${cy ? "cy" : ""}">
      <div class="eyebrow" style="color:${cy ? "var(--dim)" : "var(--amber)"}">${cy ? "система наблюдения" : "обнаружен сигнал"}</div>
      <h3>${title}</h3>
      ${quote ? `<div class="quote serif">«${quote}»</div>` : ""}
      <div class="system" style="${cy ? "" : "color:var(--amber)"}">${body}</div>
      <div class="row">${actions.map(([label, go], i) => `<button class="button ${i === 0 && !cy ? "primary" : ""}" data-ov="${i}">${label}</button>`).join("")}</div>
    </div></div>`;
    const ov = host.querySelector(".overlay");
    const btns = [...host.querySelectorAll("[data-ov]")];
    return new Promise((done) => {
      btns.forEach((b, i) => b.onclick = () => { ov.remove(); done(actions[i][1]); });
    });
  }

  function eventEarthFar() {
    AudioLayer.ping(320, 1.2, 0.08);
    showOverlay({
      cy: true, title: "Дистанция",
      body: `ЗЕМЛЯ ПОТЕРЯНА ИЗ ВИДА.<br>ПОВТОРНЫЙ ПОИСК... <b>ОБЪЕКТ НАЙДЕН.</b><br><span style="color:var(--danger)">МАСШТАБ НЕ СОВПАДАЕТ С КАРТОЙ.</span>`,
      actions: [["Продолжить", null]],
    });
  }

  async function eventMoon() {
    AudioLayer.whisper();
    const go = await showOverlay({
      cy: false, title: "Сигнал · источник: Луна",
      quote: "Ты ещё не вернулся?",
      body: `ГОЛОС ПРИНАДЛЕЖИТ ЖИЗНИ, КОТОРУЮ ТЫ ВЫБРАЛ.<br>АУДИОЗАПИСЬ: <b>НЕТ</b>. ИСТОЧНИК: <b>НЕТ</b>.`,
      actions: [["Записать в память", "keep"], ["Улететь", "leave"]],
    });
    if (go === "keep") {
      toast("ПАМЯТЬ 06 · СОХРАНЕНА.<br>СТАТУС: <span style='color:var(--danger)'>НЕ СОВПАДАЕТ С АРХИВОМ.</span>");
    }
  }

  async function eventSignal() {
    AudioLayer.whisper();
    const go = await showOverlay({
      cy: false, title: "Сигнал · дальний",
      quote: "Ты ещё успеешь?",
      body: `ПОСЛЕДНЯЯ МЫСЛЬ ОБЪЕКТА ВОЗВРАЩАЕТСЯ ИЗ ТОЧКИ,<br>ГДЕ НЕТ НИ ЗЕМЛИ, НИ ЛУНЫ, НИ ТЕБЯ.`,
      actions: [["Передать память дальше", "send"], ["Оставить себе", "keep"]],
    });
    if (go === "send") ending();
  }

  function toast(html) {
    const host = $("#overlay-host");
    const el = document.createElement("div");
    el.className = "overlay"; el.style.background = "transparent"; el.style.backdropFilter = "none";
    el.innerHTML = `<div class="card cy" style="border-color:rgba(143,209,194,.35)"><div class="system">${html}</div></div>`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function ending() {
    AudioLayer.fade(0.0001, 4);
    state.dead = true; cancelAnimationFrame(state.raf);
    flashOn();
    render(`
      <div class="screen">
        <div class="ending-wrap">
          <div class="eyebrow">память передана · получатель не определён</div>
          <h1 class="serif">Всё, что от меня<span class="ost">ОСТАЛОСЬ</span></h1>
          <div class="system">«Ты ещё успеешь?»</div>
          <p class="faint" style="max-width:420px;margin:14px auto 0">Голос был твой. Ты спрашивал себя — но изнутри жизни это звучит как вопрос от кого-то другого. Теперь он летит дальше.</p>
          <div class="row center">
            <button class="button primary" data-go="restart">Начать снова</button>
            <button class="button ghost" data-go="title">Закрыть архив</button>
          </div>
        </div>
      </div>`);
  }

  // скрыть подсказку через 6с
  setTimeout(() => { const h = $("#hint"); if (h) { h.style.opacity = "0"; h.style.transition = "opacity 1.2s"; } }, 6000);

  frame();
}

// ---------- маршрутизация ----------
let memIdx = 0;
document.addEventListener("click", (e) => {
  const choice = e.target.closest('[data-life]');
  if (choice) { LIFE = lifePool[Number(choice.dataset.life)]; chooseScreen(); return; }
  const go = e.target.closest("[data-go]")?.dataset.go;
  if (!go) return;
  AudioLayer.ensure();
  if (go === "title") titleScreen();
  if (go === "choose" || go === "reroll") { pickLives(); chooseScreen(); }
  if (go === "mem") { memIdx = 0; memoryScreen(0); }
  if (go === "next") { memIdx++; memoryScreen(memIdx); }
  if (go === "death") deathScreen();
  if (go === "space") transitionToSpace();
  if (go === "restart") { pickLives(); chooseScreen(); }
});

// старт: короткое «пробуждение» и титул
render(`<div class="screen" style="place-items:end center"><span class="faint" style="padding-bottom:40px">— — —</span></div>`);
titleScreen();
