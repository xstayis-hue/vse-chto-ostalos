/* «Всё, что от меня ОСТАЛОСЬ» — вертикальная демка.
   Космос: вид от первого лица (глаза сущности), свободный полёт.
   Без зависимостей. */

// ---------- Telegram Mini App ----------
const TG = window.Telegram?.WebApp;
if (TG) { TG.ready(); TG.expand(); TG.setHeaderColor?.('#030507'); TG.setBackgroundColor?.('#030507'); TG.disableVerticalSwipes?.(); }
const Haptics = {
  impact(style = "light") { TG?.HapticFeedback?.impactOccurred?.(style); },
  selection() { TG?.HapticFeedback?.selectionChanged?.(); },
  notification(type = "success") { TG?.HapticFeedback?.notificationOccurred?.(type); },
};
function syncTelegramTheme() {
  const p = TG?.themeParams;
  if (!p) return;
  const root = document.documentElement;
  if (p.bg_color) root.style.setProperty("--bg", p.bg_color);
  if (p.text_color) root.style.setProperty("--ink", p.text_color);
  if (p.hint_color) root.style.setProperty("--muted", p.hint_color);
  if (p.button_color) root.style.setProperty("--cyan", p.button_color);
  if (p.destructive_text_color) root.style.setProperty("--danger", p.destructive_text_color);
}
syncTelegramTheme();
TG?.onEvent?.("themeChanged", syncTelegramTheme);
TG?.onEvent?.("viewportChanged", () => {
  document.documentElement.style.setProperty("--tg-viewport-height", `${TG.viewportHeight || window.innerHeight}px`);
});

// ---------- утилиты ----------
const $ = (s, r = document) => r.querySelector(s);
const stage = $("#stage");
const flash = $("#flash");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// короткий миг/затемнение экрана
function flashOn() {
  flash.classList.add("on");
  setTimeout(() => flash.classList.remove("on"), 140);
}

// ---------- звук (WebAudio, тихий слой) ----------
const AudioLayer = {
  ctx: null, master: null, drone: null, started: false,
  ensure() {
    if (this.started) {
      if (this.ctx?.state === "suspended" && navigator.userActivation?.isActive) this.ctx.resume().catch(() => {});
      return;
    }
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
    el.setAttribute("aria-live", "polite");
    el.textContent = "";
    let cur = null;
    let complete = false;
    const showAll = () => {
      if (complete || !el.isConnected) return;
      complete = true;
      cur?.remove();
      el.textContent = text;
      done();
    };
    el.addEventListener("click", showAll, { once: true });
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { showAll(); return; }
    cur = document.createElement("i");
    cur.className = "cursor";
    el.appendChild(cur);
    let i = 0;
    (function step() {
      if (!el.isConnected) { done(); return; } // экран сменился посреди печати
      if (i < text.length && !complete) {
        cur.insertAdjacentText("beforebegin", text[i++]);
        setTimeout(step, speed);
      } else if (!complete) { complete = true; cur.remove(); done(); }
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
const generatedLifePool = Array.from({length:100}, (_, i) => {
  const gender = i % 2 ? 'm' : 'f';
  const name = `${firstNames[i % 20]} ${surnames[i % 20]}`;
  const place = places[Math.floor(i / 2) % 10];
  // Пока используются общие исторические иллюстрации; не выдаём их за будущее.
  const year = 1940 + (i * 7 % 26);
  const desire = desires[Math.floor(i / 10)];
  const last = endings[(i * 7) % 10];
  const kitchen = ['На кухне кто-то тихо пел.','В коридоре хлопнула дверь.','Чай остыл, а никто не пришёл.','Кто-то переставил чужие вещи на полку.','Ночью ворчал холодильник.'][i % 5];
  const voice = ['Голос теряется раньше, чем мелодия.','Некоторые слова так и не были сказаны.','Имя звучало чужим, хотя было твоим.','Ты помнил интонацию, но не смысл.','Звонок прервался на полуслове.'][(i * 3) % 5];
  const callText = ['Ночью раздался звонок.','Телефон зазвонил, когда ты уже спал.','Номер был знакомым, но трубку никто не взял.','Письмо пришло вместо звонка.','Дверь открыли, а за ней никого.'][(i * 2) % 5];
  const callDesc = ['Некоторые разговоры продолжаются всю жизнь.','Ответ так и остался в той ночи.','Тишина в трубке звучала громче слов.','С того дня всё стало немного другим.','Ты так и не узнал, кто звонил.'][(i * 4) % 5];
  const seaText = gender === 'f' ? 'Однажды ты увидела море в последний раз.' : 'Однажды ты увидел море в последний раз.';
  const seaDesc = gender === 'f' ? 'Ты тогда ещё не знала.' : 'Ты тогда ещё не знал.';
  return { id:i, gender, name, num:`№ ${String(4918220000 + i).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`, place, year,
    desire, last, memories:[
      { y:String(year), h: gender === 'f' ? 'Ты появилась на свет.' : 'Ты появился на свет.', p:`${place}. Этот день сохранился только в чужой памяти.`, fx:'rain', n:18 },
      { y:String(year+7), h: kitchen, p: voice, fx:'ice', n:0 },
      { y:String(year+24), h: 'Поезд ещё стоял у платформы.', p: gender === 'f' ? 'Ты так и не вошла в вагон. Причина этого решения не сохранилась.' : 'Ты так и не вошёл в вагон. Причина этого решения не сохранилась.', fx:'split', n:0 },
      { y:String(year+43), h: callText, p: callDesc, fx:'room', n:0 },
      { y:String(year+68), h: seaText, p: seaDesc, fx:'sea', n:0 }
    ] };
});
let offeredLives = [];
const authoredLives = window.CURATED_LIVES || [];
const lifePool = authoredLives.length ? authoredLives : generatedLifePool;
const RUN = { choices: {}, signals: [], memories: new Set(), expeditions: [] };
const RUN_KEY = "vse-chto-ostalos:last-run";
const META_KEY = "vse-chto-ostalos:archive";
const EXPEDITION_IDS = ["moon-back", "dead-station", "echo-orbit"];
function readMeta() {
  try {
    const meta = JSON.parse(localStorage.getItem(META_KEY) || "null");
    return {
      lives: Number(meta?.lives) || 0,
      expeditions: Array.isArray(meta?.expeditions) ? meta.expeditions : [],
      fragments: Number(meta?.fragments) || 0,
    };
  } catch { return { lives: 0, expeditions: [], fragments: 0 }; }
}
function writeMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* archive is optional */ }
}
function archivePercent(meta = readMeta()) {
  return Math.round(((meta.expeditions.length / EXPEDITION_IDS.length) * 45) + Math.min(55, meta.fragments));
}
function completeMetaRun() {
  const meta = readMeta();
  meta.lives += 1;
  meta.fragments += Math.min(6, RUN.memories.size);
  RUN.expeditions.forEach((id) => { if (!meta.expeditions.includes(id)) meta.expeditions.push(id); });
  writeMeta(meta);
  return meta;
}
function persistRun(status = "active") {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify({
      status,
      lifeId: LIFE?.id,
      choices: RUN.choices,
      expeditions: RUN.expeditions,
      memories: [...RUN.memories],
      scene: Number.isInteger(memIdx) ? memIdx : 0,
      savedAt: new Date().toISOString(),
    }));
  } catch { /* приватный режим или отключённое хранилище — не блокируем игру */ }
}
function readSavedRun() {
  try {
    const saved = JSON.parse(localStorage.getItem(RUN_KEY) || "null");
    if (!saved || saved.status === "complete") return null;
    const life = lifePool.find((item) => String(item.id) === String(saved.lifeId));
    if (!life) return null;
    return { ...saved, life };
  } catch { return null; }
}
function restoreRun() {
  const saved = readSavedRun();
  if (!saved) return false;
  LIFE = saved.life;
  RUN.choices = saved.choices || {};
  RUN.expeditions = saved.expeditions || [];
  RUN.memories = new Set(saved.memories || []);
  memIdx = clamp(Number(saved.scene) || 0, 0, LIFE.memories.length - 1);
  memoryScreen(memIdx);
  return true;
}
function clearSavedRun() {
  try { localStorage.removeItem(RUN_KEY); } catch { /* storage is optional */ }
}
function hasActiveRun() {
  return Boolean(readSavedRun());
}
function hasMemory(...effects) { return effects.some((effect) => RUN.memories.has(effect)); }
function runSummary() {
  const meta = readMeta();
  return {
    retained: RUN.memories.size,
    expeditions: RUN.expeditions.length,
    archivePercent: archivePercent(meta),
    choseReturn: RUN.memories.has("earth"),
    choseDistance: RUN.memories.has("distance"),
    answered: RUN.memories.has("voice"),
  };
}
function resultText() {
  const summary = runSummary();
  const branch = signalBranch();
  const verb = LIFE.gender === "f" ? "прожила" : "прожил";
  return `Я ${verb} жизнь ${LIFE.name} в «Всё, что от меня ОСТАЛОСЬ». В памяти осталось: ${summary.retained} фрагментов. Экспедиций: ${summary.expeditions}. Архив восстановлен на ${summary.archivePercent}%. Ветка сигнала: ${branch}.`;
}
const CHOICE_LABELS = {
  keep: "сохранить",
  release: "отпустить",
  stay: "остаться",
  leave: "уехать",
  answer: "ответить",
  ignore: "промолчать",
};
function readableChoices() {
  return Object.values(RUN.choices).map((id) => CHOICE_LABELS[id] || id).join(" · ") || "решения не сохранены";
}
function resultCardData() {
  const summary = runSummary();
  const meta = readMeta();
  return {
    name: LIFE.name,
    symbol: LIFE.symbol || "след не определён",
    branch: signalBranch(),
    retained: summary.retained,
    archive: archivePercent(meta),
    choices: Object.values(RUN.choices).join(" · ") || "—",
  };
}
function drawResultCard() {
  const data = resultCardData();
  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = 630;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#030507"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#536b62"; ctx.lineWidth = 2; ctx.strokeRect(34, 34, 1132, 562);
  ctx.fillStyle = "#7f9089"; ctx.font = "20px monospace"; ctx.fillText("АРХИВ · ПОСЛЕ ЧЕЛОВЕКА", 80, 100);
  ctx.fillStyle = "#d5e0d9"; ctx.font = "italic 58px Georgia"; ctx.fillText("Всё, что от меня", 80, 210);
  ctx.fillStyle = "#9fb4aa"; ctx.font = "bold 70px Arial"; ctx.fillText("ОСТАЛОСЬ", 80, 290);
  ctx.fillStyle = "#9fb4aa"; ctx.font = "28px monospace"; ctx.fillText(data.name, 80, 390);
  ctx.fillStyle = "#71847b"; ctx.font = "22px monospace"; ctx.fillText(`${data.symbol} · ${data.retained} фрагм.`, 80, 440);
  ctx.fillText(`${data.branch} · АРХИВ ${data.archive}%`, 80, 490);
  ctx.fillStyle = "#536b62"; ctx.font = "18px monospace"; ctx.fillText("ЗАПИСЬ НЕ ПРИНАДЛЕЖИТ НИКОМУ", 80, 550);
  return canvas;
}
function downloadResultCard() {
  const canvas = drawResultCard();
  const link = document.createElement("a");
  link.download = "vse-chto-ostalos-result.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}
function signalBranch() {
  if (hasMemory("voice")) return "ГОЛОС ОТВЕЧАЕТ ТЕБЕ";
  if (hasMemory("earth")) return "СИГНАЛ НАПРАВЛЕН К ЗЕМЛЕ";
  if (hasMemory("distance")) return "СИГНАЛ УХОДИТ ДАЛЬШЕ";
  if (hasMemory("quiet")) return "КАНАЛ ОСТАЁТСЯ ПУСТЫМ";
  return "ИСТОЧНИК НЕ ОПРЕДЕЛЁН";
}
function branchSignalCopy() {
  if (hasMemory("voice")) return {
    code: "VOICE",
    title: "ГОЛОС В КАНАЛЕ",
    quote: "Ты меня слышишь?",
    body: "СИГНАЛ ПОВТОРЯЕТ ТВОЮ ИНТОНАЦИЮ.<br>ОТВЕТ НЕ ОТЛИЧАЕТСЯ ОТ ВОПРОСА.",
  };
  if (hasMemory("earth")) return {
    code: "EARTH",
    title: "ВОЗВРАТНЫЙ МАРШРУТ",
    quote: "Дом всё ещё здесь.",
    body: "КООРДИНАТЫ ВЕДУТ К ЗЕМЛЕ.<br>МАРШРУТ ПОСТРОЕН ИЗ ТЕХ МЕСТ, КОТОРЫХ УЖЕ НЕТ.",
  };
  if (hasMemory("distance")) return {
    code: "DISTANCE",
    title: "СИГНАЛ ИЗ-ЗА ПРЕДЕЛА",
    quote: "Не возвращайся.",
    body: "ИСТОЧНИК УДАЛЯЕТСЯ БЫСТРЕЕ, ЧЕМ ТЫ МОЖЕШЬ К НЕМУ ПРИБЛИЗИТЬСЯ.<br>ПРЕСЛЕДОВАНИЕ ПРИНЯТО.",
  };
  if (hasMemory("quiet")) return {
    code: "QUIET",
    title: "ОБРЫВ КАНАЛА",
    quote: "",
    body: "СИГНАЛ БЫЛ, НО НИЧЕГО НЕ СООБЩИЛ.<br>МОЛЧАНИЕ СОХРАНЕНО КАК ЕДИНСТВЕННЫЙ ФАКТ.",
  };
  return { code: "UNKNOWN", title: "СИГНАЛ БЕЗ ВЛАДЕЛЬЦА", quote: "", body: "ИСТОЧНИК НЕ ОПРЕДЕЛЁН.<br>ПОДПИСЬ СОВПАДАЕТ С ТВОЕЙ.", };
}
function pickLives() {
  const availableLives = window.CURATED_LIVES?.length ? window.CURATED_LIVES : lifePool;
  const shuffled = [...availableLives];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  offeredLives = shuffled.slice(0, 5);
  LIFE = offeredLives[0];
  RUN.choices = {};
  RUN.memories = new Set();
  RUN.expeditions = [];
  memIdx = 0;
  clearSavedRun();
  persistRun();
}

// ---------- рендер экранов ----------
let cleanupSpace = null;
function render(html) {
  if (cleanupSpace) { cleanupSpace(); cleanupSpace = null; }
  stage.innerHTML = html;
}

async function titleScreen() {
  AudioLayer.ensure(); AudioLayer.fade(0.0001, 0.1);
  const saved = readSavedRun();
  const resumeLabel = saved ? `Продолжить · воспоминание ${String((saved.scene || 0) + 1).padStart(2, "0")} / ${String(saved.life.memories.length).padStart(2, "0")}` : "";
  render(`
    <div class="screen title-screen">
      <div class="title-topline"><span>ЦИКЛ / 047</span><span>ПОСЛЕ ЧЕЛОВЕКА</span></div>
      <div class="scripture-mark"><span>«Что Я делаю, теперь ты не знаешь, а уразумеешь после.»</span><small>Ин. 13:7</small></div>
      <div class="title-wrap">
        <div class="eyebrow">запись найдена · отправитель неизвестен</div>
        <h1 class="title serif"><span class="line">Всё, что от меня</span><span class="ost" data-t="ОСТАЛОСЬ">ОСТАЛОСЬ</span></h1>
        <p class="title-description">Они думали, что после последнего вдоха<br>никто не услышит тишину.</p>
        <div class="start-row">
          <button class="button primary title-button" data-go="${saved ? "resume" : "choose"}">${saved ? resumeLabel : "Войти в архив"} <span>↗</span></button>
          ${saved ? '<button class="button ghost" data-go="choose">Новая запись</button>' : ""}
        </div>
      </div>
      <div class="title-bottomline"><span>СИСТЕМА НЕ ОБНАРУЖИЛА ВЛАДЕЛЬЦА</span><span>НАУШНИКИ РЕКОМЕНДУЮТСЯ</span></div>
    </div>`);
}

async function chooseScreen() {
  const current = LIFE;
  const meta = readMeta();
  render(`
    <div class="screen archive-screen">
      <div class="archive-list">
         <div class="archive-header"><span>АРХИВ · 01</span><span>● СВЯЗЬ</span></div>
         <div class="meta-progress">ПРОЖИТО ЖИЗНЕЙ: ${meta.lives} · ЭКСПЕДИЦИЙ: ${meta.expeditions.length}/${EXPEDITION_IDS.length} · ПАМЯТЬ: ${archivePercent(meta)}%</div>
        <div class="archive-title serif">Кем ты был<br><i>до тишины?</i></div>
        <div class="archive-hint">пять записей. одна из них — ты.</div>
        <ol class="archive-items">
   ${offeredLives.map((person, i) => `
     <li><button class="archive-item ${person.id === current.id ? "is-chosen" : ""}" data-life="${person.id}" aria-pressed="${person.id === current.id}">
       <span class="archive-num">${String(i + 1).padStart(2, "0")}</span>
       <span class="archive-name">${person.name}</span>
       <span class="archive-meta">${person.year} · ${person.place}</span>
            </button></li>`).join("")}
        </ol>
        <div class="archive-foot">
   <div class="archive-last"><span class="archive-last-label">последняя мысль · запись повреждена</span>«${current.last}»</div>
          <div class="archive-actions">
     <button class="button primary" data-go="mem">Прожить эту жизнь <span>↗</span></button>
     <button class="button ghost" data-go="reroll">Другая пятёрка</button>
   </div>
        </div>
      </div>
    </div>`);
}

async function memoryScreen(idx) {
  const m = LIFE.memories[idx];
  const total = LIFE.memories.length;
  const choices = m.choices || [];
  render(`
    <div class="memory-stage">
      <div style="padding: calc(16px + env(safe-area-inset-top)) 20px 0; display:flex; justify-content:space-between; gap:12px">
        <span class="eyebrow">ВОСПОМИНАНИЕ ${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
        <span class="eyebrow memory-name">${LIFE.name}</span>
      </div>
      <div class="scene memory-scene">
        <div class="pixel-memory" aria-hidden="true"><canvas class="pixel-background" width="320" height="180"></canvas><canvas class="pixel-actor" width="320" height="180"></canvas></div>
        ${m.fx === "room" ? '<div class="fx phone"></div>' : ""}
        ${idx === 0 ? '<blockquote class="scene-scripture"><span>«Я свет миру; кто последует за Мною, тот не будет ходить во тьме.»</span><cite>Ин. 8:12</cite></blockquote>' : ''}
        <div class="memory-content"><div class="caption">
          <div class="yeartag">${m.y}</div>
          <h2 class="serif" id="cap-h"></h2>
          <p id="cap-p"></p>
        </div>
        ${choices.length ? `<div class="memory-choices" role="group" aria-label="Выбор воспоминания">
          <span class="eyebrow">ЧТО ОСТАНЕТСЯ В ПАМЯТИ?</span>
          <div class="row">${choices.map(c => {
            const selected = RUN.choices[idx] === c.id;
            return `<button class="button ghost ${selected ? "selected" : ""}" data-choice="${c.id}" data-effect="${c.effect}"${selected ? " disabled" : ""}>${c.label}</button>`;
          }).join("")}</div>
        </div>` : ""}</div>
      </div>
      <div class="bar"><i style="width:${((idx + 1) / total) * 100}%"></i></div>
      <div class="scene-foot">
        <span class="faint" style="font-size:10px">${idx + 1 < total ? "память сохраняется неполностью · осталось " + (total - idx - 1) : "последний фрагмент · дальше только тишина"}</span>
        <button class="button primary" data-go="${idx + 1 < total ? "next" : "death"}"${choices.length && RUN.choices[idx] == null ? " disabled" : ""}>${idx + 1 < total ? "Дальше" : "Продолжить"}</button>
      </div>
    </div>`);
  const heading = $("#cap-h"), description = $("#cap-p");
  drawPixelMemory(stage, idx, LIFE);
  await typeText(heading, m.h, 20);
  if (heading?.isConnected) await typeText(description, m.p, 10);
}

function transitionToSpace() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { spaceScreen(); return; }
  const variant = LIFE.id % 5;
  render(`<div class="departure departure-${variant}" role="status" aria-label="Переход в космос"><video class="departure-video" autoplay muted playsinline preload="auto" src="assets/departure-orbit.mp4"></video><div class="departure-orbit"></div><div class="departure-light"></div><span>ТЕЛО БОЛЬШЕ НЕ ОТВЕЧАЕТ</span></div>`);
  AudioLayer.ping(180 + variant * 30, 1.2, 0.04);
  const video = $('.departure-video');
  video.addEventListener('playing', () => video.parentElement?.classList.add('video-playing'), { once: true });
  let completed = false;
  const finish = () => { if (!completed && $('.departure')) { completed = true; spaceScreen(); } };
  video.addEventListener('ended', finish, { once: true });
  video.addEventListener('error', finish, { once: true });
  video.play().catch(() => { Haptics.notification("warning"); finish(); });
  const fallbackTimer = setTimeout(() => { if (!video.currentTime || video.readyState < 2) finish(); }, 2500);
  const hardTimer = setTimeout(finish, 9000);
  video.addEventListener("ended", () => { clearTimeout(fallbackTimer); clearTimeout(hardTimer); }, { once: true });
}

async function deathScreen() {
  render(`
    <div class="memory-stage">
      <div class="scene">
        <div class="fx whiteout"></div>
        <blockquote class="scene-scripture scene-scripture-dark"><span>«Свет ещё на малое время есть с вами; ходите, пока есть свет, чтобы не объяла вас тьма.»</span><cite>Ин. 12:35</cite></blockquote>
        <div class="caption" style="color:#1a221f">
          <div class="yeartag" style="color:#3c4a45">СЕРДЦЕБИЕНИЕ: НЕ ОБНАРУЖЕНО</div>
          <h2 class="serif" id="death-h"></h2>
          <p id="death-p" style="color:#39443f"></p>
          <p class="death-tail" id="death-t" style="color:#39443f"></p>
        </div>
      </div>
      <div class="scene-foot">
        <span class="faint" style="font-size:10px;color:#8a9a94">объект больше не числится среди живых</span>
        <button class="button primary" data-go="space" style="border-color:#8a9a94;color:#e6ece8">Открыть глаза</button>
      </div>
    </div>`);
  await typeText($("#death-h"), LIFE.death || (LIFE.gender === 'f' ? "Ты умерла." : "Ты умер."), 90);
  await pause(1600);
  if (!$("#death-p")) return;
  await typeText($("#death-p"), "Это не было похоже на конец.", 60);
  await pause(2400);
  if (!$("#death-t")) return;
  await typeText($("#death-t"), "Отсчёт времени не ведётся. Ожидание не имеет границ.", 40);
}

function pause(ms) {
  return new Promise((done) => setTimeout(done, ms));
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
          <p class="memory-quiet">ПАМЯТЬ: <b>${LIFE.memories.length} ФРАГМЕНТА</b></p>
        </div>
        <div class="panel navigation-panel" style="text-align:right">
          <div class="eyebrow">навигация</div>
          <p>ДО ЗЕМЛИ: <b id="d-earth">—</b></p>
          <p>ДО СОЛНЦА: <b id="d-sun">—</b></p>
          <p>БЛИЖЕЙШИЙ: <b id="d-near">—</b></p>
          <p>СКОРОСТЬ: <b id="v-now">0.00</b></p>
        </div>
      </div>
      <div class="signal-state" id="signal-state" aria-live="polite"></div>
      <div class="hud-row" style="align-items:flex-end">
        <div class="dpad" id="dpad">
          <button class="dbtn" data-th="f" aria-label="вперёд">▲</button>
          <button class="dbtn" data-th="l" aria-label="влево">◀</button>
          <button class="dbtn" data-th="b" aria-label="назад">▼</button>
          <button class="dbtn" data-th="r" aria-label="вправо">▶</button>
        </div>
        <div class="stick" id="stick" role="group" aria-label="тяга"><i></i></div>
        <div class="keys">
          <button class="button" id="k-scan">Сканировать</button>
          <button class="button ghost" id="k-slow">Покой</button>
        </div>
      </div>
    </div>
    <div class="hint" id="hint">СВАЙП — ВЗГЛЯД · ДЖОЙСТИК — ДВИЖЕНИЕ</div>
    <div id="overlay-host"></div>`);

  AudioLayer.ensure();
  AudioLayer.fade(0.16, 3); // тихий гул включается при выходе в космос
  flashOn();

  const canvas = $("#space"), ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;

  // --- камера (глаза сущности): старт у Земли, взгляд на Солнце ---
  const cam = { yaw: -2.34, pitch: -0.08, pos: { x: 82, y: 3.2, z: 106 }, vel: { x: 0, y: 0, z: 0 } };
  const FOV = 1.05; // радиан по горизонтали
  // На телефоне взгляд чувствительнее к дрожанию пальца: меньше усиление и сглаживание ниже.
  const LOOK_GAIN = matchMedia('(pointer: coarse)').matches ? 1.1 : 2.4;

  // --- Солнечная система: Солнце в (0,0,0), планеты на сжатых орбитах вокруг него ---
  // 1 а.е. = 120 R⊕. Игрок стартует у Земли (дистанция 120 от Солнца), видит его прямо перед собой.
  const AU = 120;
  const ORB = (a, ang) => ({ x: Math.cos(ang) * a * AU, z: Math.sin(ang) * a * AU });
  const SUN = { name: "СОЛНЦЕ", x: 0, y: 0, z: 0, r: 12, sun: true, marks: [],
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
      const coarse = matchMedia('(pointer: coarse)').matches;
      const quality = {
        dprCap: coarse ? 1.25 : 2,
        level: coarse ? "balanced" : "high",
        slowFrames: 0,
        fastFrames: 0,
        measured: 0,
        emaMs: 16.7,
        starOpacity: 0.9,
      };
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.dprCap));
      renderer.setSize(stage.clientWidth, stage.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = coarse ? 0.82 : 0.9;
      renderer.domElement.className = 'space-webgl';
      canvas.insertAdjacentElement('beforebegin', renderer.domElement);
      const scene = new THREE.Scene();
      const skyFile = coarse ? 'milky-way-4k.jpg' : 'milky-way-8k.jpg';
      const sky = new THREE.TextureLoader().load(`assets/${skyFile}`);
      sky.mapping = THREE.EquirectangularReflectionMapping;
      sky.colorSpace = THREE.SRGBColorSpace;
      sky.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      scene.background = sky;
      // Звёзды — отдельные точки, а не увеличенные пиксели панорамы.
      // Фиксированная последовательность сохраняет рисунок между запусками.
      let starSeed = 73841;
      const starRandom = () => { starSeed = (starSeed * 1664525 + 1013904223) >>> 0; return starSeed / 4294967296; };
      const starCount = coarse ? 3200 : 4600;
      const starPositions = new Float32Array(starCount * 3);
      const starColors = new Float32Array(starCount * 3);
      const starSizes = new Float32Array(starCount);
      for (let i = 0; i < starCount; i++) {
         // Most stars sit in a soft galactic band; the sparse remainder keeps
         // the poles from becoming completely empty. This reads closer to a
         // catalogue sky than a uniformly scattered particle sphere.
         const inBand = starRandom() < 0.74;
         const y = inBand ? (starRandom() - 0.5) * 0.5 : starRandom() * 2 - 1;
         const angle = starRandom() * Math.PI * 2;
        const r = Math.sqrt(1 - y * y), radius = 1800;
        starPositions.set([Math.cos(angle) * r * radius, y * radius, Math.sin(angle) * r * radius], i * 3);
         const brightness = 0.12 + Math.pow(starRandom(), 4.4) * 0.88;
        const warmth = starRandom();
        starColors.set([brightness * (warmth < .18 ? 1 : .83), brightness * .9, brightness * (warmth < .18 ? .72 : 1)], i * 3);
         starSizes[i] = 0.7 + Math.pow(starRandom(), 5.5) * 2.8;
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
      starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
      const starMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
         uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.9 } },
        vertexColors: true,
         vertexShader: `attribute float size; varying vec3 vColor; uniform float uTime; void main(){ vColor=color; vec4 mvPosition=modelViewMatrix*vec4(position,1.0); float pulse=0.985+0.015*sin(uTime*(0.08+size*.025)+position.x*.003); gl_PointSize=clamp(size*pulse*(900.0/-mvPosition.z),0.55,3.8); gl_Position=projectionMatrix*mvPosition; }`,
         fragmentShader: `uniform float uOpacity; varying vec3 vColor; void main(){ float d=length(gl_PointCoord-vec2(.5)); float a=smoothstep(.5,.06,d); gl_FragColor=vec4(vColor,a*uOpacity); }`
      });
      const starField = new THREE.Points(starGeometry, starMaterial);
      starField.frustumCulled = false;
      scene.add(starField);

      // Процедурные туманности: не одна размытая панорама, а несколько
      // полупрозрачных облаков, которые медленно меняют яркость и смещаются.
      const nebulaTexture = (hue, seed) => {
        const c = document.createElement('canvas'); c.width = 1024; c.height = 640;
        const x = c.getContext('2d');
        x.clearRect(0, 0, c.width, c.height);
        for (let i = 0; i < 22; i++) {
          const px = ((seed * 97 + i * 173) % 1000) / 1000 * c.width;
          const py = ((seed * 53 + i * 311) % 1000) / 1000 * c.height;
          const rx = 55 + ((seed + i * 41) % 150), ry = 25 + ((seed + i * 23) % 90);
          const g = x.createRadialGradient(px, py, 0, px, py, Math.max(rx, ry));
          g.addColorStop(0, `hsla(${hue},34%,58%,${0.12 + (i % 4) * 0.025})`);
          g.addColorStop(.38, `hsla(${hue + 14},30%,42%,${0.06 + (i % 3) * 0.018})`);
          g.addColorStop(1, `hsla(${hue + 24},26%,24%,0)`);
          x.save(); x.translate(px, py); x.scale(1, ry / rx); x.translate(-px, -py);
          const m = Math.max(rx, ry);
          x.fillStyle = g; x.fillRect(px - m, py - m, m * 2, m * 2); x.restore();
        }
        x.globalCompositeOperation = 'destination-in';
        const edge = x.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, c.height * 0.5);
        edge.addColorStop(0, 'rgba(0,0,0,1)');
        edge.addColorStop(0.55, 'rgba(0,0,0,0.75)');
        edge.addColorStop(0.85, 'rgba(0,0,0,0.2)');
        edge.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = edge; x.fillRect(0, 0, c.width, c.height);
        x.globalCompositeOperation = 'source-over';
        const texture = new THREE.CanvasTexture(c);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
      };
      const nebulaGroup = new THREE.Group();
      const nebulaDefs = [
         { p: [-560, 110, -720], s: [720, 420], hue: 205, opacity: .18, seed: 3 },
         { p: [390, -120, -860], s: [620, 360], hue: 215, opacity: .12, seed: 9 },
         { p: [-850, 310, 180], s: [540, 300], hue: 178, opacity: .09, seed: 17 },
         { p: [720, 260, 520], s: [650, 360], hue: 32, opacity: .06, seed: 25 },
         { p: [0, -420, -1050], s: [900, 300], hue: 210, opacity: .08, seed: 31 }
      ];
      const nebulaSprites = nebulaDefs.map((n, i) => {
        const material = new THREE.SpriteMaterial({ map: nebulaTexture(n.hue, n.seed), transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending, opacity: n.opacity * .72, color: 0xffffff });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(...n.p); sprite.scale.set(n.s[0], n.s[1], 1); sprite.userData = { base: n.opacity, phase: i * 1.7 };
        nebulaGroup.add(sprite); return sprite;
      });
      scene.add(nebulaGroup);
       scene.add(new THREE.AmbientLight(0x4f6075, 0.28));
      const station = new THREE.Group();
      const metal = new THREE.MeshStandardMaterial({ color: 0x6b736f, roughness: .9, metalness: .2 });
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x2b3431, roughness: .8, metalness: .6 });
      const truss = new THREE.Mesh(new THREE.BoxGeometry(9, .35, .35), metal);
      const module = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 2.2, 16), metal); module.rotation.z = Math.PI / 2;
      const panels = [-3.3, 3.3].flatMap(x => [-0.85, 0.85].map(z => { const p = new THREE.Mesh(new THREE.BoxGeometry(2.6, .03, 1.3), panelMat); p.position.set(x, 0, z); return p; }));
      station.add(truss, module, ...panels);
      station.scale.setScalar(1.9e-6);
      scene.add(station);
      const glintCanvas = document.createElement('canvas'); glintCanvas.width = glintCanvas.height = 32;
      const gx = glintCanvas.getContext('2d');
      const glintGrad = gx.createRadialGradient(16, 16, 0, 16, 16, 16);
      glintGrad.addColorStop(0, 'rgba(230,238,233,1)'); glintGrad.addColorStop(0.4, 'rgba(230,238,233,0.35)'); glintGrad.addColorStop(1, 'rgba(230,238,233,0)');
      gx.fillStyle = glintGrad; gx.fillRect(0, 0, 32, 32);
      const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glintCanvas), transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glint.scale.setScalar(0.045);
      glint.material.opacity = 0.45;
      scene.add(glint);
      const light = new THREE.PointLight(0xffefce, 3, 0, 0);
      light.position.set(0, 0, 0); scene.add(light);
      const camera = new THREE.PerspectiveCamera(55, stage.clientWidth / stage.clientHeight, 0.03, 5000);
      const geometry = new THREE.SphereGeometry(1, 64, 40);
      const sunShader = { uniforms: { uTime: { value: 0 } } };
      const makeSunMaterial = (sceneRef, surfaceTexture) => {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...sunShader.uniforms, uSurface: { value: surfaceTexture } },
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec2 vUv; void main(){ vN = normalize(normalMatrix * normal); vP = position; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; uniform sampler2D uSurface; varying vec3 vN; varying vec3 vP; varying vec2 vUv;
float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  vec3 p = vP * 15.0 + vec3(0.0, 0.0, uTime * 0.16);
  float warp = fbm(p * 0.42 + uTime * 0.05);
  float broad = fbm(p * 0.72 + warp * 1.2);
  float grain = fbm(p * 2.7 - uTime * 0.08);
  float n = broad * 0.62 + grain * 0.38;
  vec3 dark = vec3(0.55, 0.14, 0.03);
  vec3 mid = vec3(1.0, 0.55, 0.12);
  vec3 hot = vec3(1.0, 0.92, 0.5);
   vec3 procedural = mix(dark, mid, smoothstep(0.3, 0.55, n));
   procedural = mix(procedural, hot, smoothstep(0.5, 0.78, n));
   vec3 source = texture2D(uSurface, vUv + vec2(uTime * 0.004, 0.0)).rgb;
   vec3 col = mix(procedural, source * vec3(1.15, 0.86, 0.42), 0.64);
  col *= 0.84 + 0.24 * smoothstep(0.25, 0.75, n);
  float mu = clamp(vN.z, 0.0, 1.0);
  col *= mix(0.75, 1.1, pow(mu, 0.4));
  col += vec3(1.0, 0.85, 0.3) * smoothstep(0.7, 1.0, 1.0 - mu) * 0.5;
  col += vec3(1.0, 0.8, 0.2) * pow(1.0 - mu, 3.0) * 0.8;
  gl_FragColor = vec4(col, 1.0);
}`
 });
        const cc = document.createElement('canvas'); cc.width = cc.height = 128;
        const cx = cc.getContext('2d');
        const cg = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
 cg.addColorStop(0.5, 'rgba(255,190,60,0.5)');
        cg.addColorStop(0.75, 'rgba(255,120,30,0.18)');
        cg.addColorStop(1, 'rgba(230,90,20,0)');
        cx.fillStyle = cg; cx.fillRect(0, 0, 128, 128);
        const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        corona.scale.setScalar(30);
        sceneRef.add(corona);
 return mat;
      };
      const loader = new THREE.TextureLoader();
      const names = { 'СОЛНЦЕ':'sun', 'ЗЕМЛЯ':'earth', 'ЛУНА':'moon', 'МЕРКУРИЙ':'mercury', 'ВЕНЕРА':'venus', 'МАРС':'mars', 'ЮПИТЕР':'jupiter', 'САТУРН':'saturn', 'УРАН':'uranus', 'НЕПТУН':'neptune' };
      const materialSpec = {
        'ЗЕМЛЯ': { roughness: .86, metalness: 0 },
        'ЛУНА': { roughness: 1, metalness: 0, bump: .16 },
        'МАРС': { roughness: .96, metalness: 0, bump: .1 },
        'МЕРКУРИЙ': { roughness: 1, metalness: 0, bump: .08 },
        'ВЕНЕРА': { roughness: .92, metalness: 0 },
        'ЮПИТЕР': { roughness: .94, metalness: 0 },
        'САТУРН': { roughness: .94, metalness: 0 },
        'УРАН': { roughness: .9, metalness: 0 },
        'НЕПТУН': { roughness: .9, metalness: 0 },
      };
      const meshes = [];
      for (const body of BODIES) {
        const texture = body.sun ? loader.load('assets/sun-api-candidate.jpg') : loader.load(`assets/${names[body.name]}.jpg`);
        if (texture) {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
        }
        const spec = materialSpec[body.name] || { roughness: .96, metalness: 0 };
        const material = body.sun ? makeSunMaterial(scene, texture) : new THREE.MeshStandardMaterial({ map: texture, color: 0xc8d0ca, roughness: spec.roughness, metalness: spec.metalness, bumpMap: spec.bump ? texture : null, bumpScale: spec.bump || 0 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(body.x, body.y, body.z); mesh.scale.setScalar(body.r);
        scene.add(mesh); meshes.push(mesh);
        if (body.ring) {
          // Кольца не одним гладким диском: реальные кольца — это пыль и лёд,
          // собранные в сотни полос с промежутками Кассини.
          const ringGroup = new THREE.Group();
          const ringBands = [
            [1.18, 1.28, .16], [1.31, 1.36, .08], [1.4, 1.48, .28],
            [1.51, 1.57, .13], [1.61, 1.72, .34], [1.75, 1.79, .09],
            [1.84, 1.94, .25], [1.99, 2.07, .16], [2.1, 2.2, .3]
          ];
          ringBands.forEach(([inner, outer, opacity], index) => {
            const material = new THREE.MeshStandardMaterial({
              color: index % 3 === 0 ? 0xa99f89 : index % 3 === 1 ? 0x797565 : 0xbab19a,
              roughness: 1, metalness: 0, side: THREE.DoubleSide,
              transparent: true, opacity, depthWrite: false
            });
            const band = new THREE.Mesh(new THREE.RingGeometry(body.r * inner, body.r * outer, 128), material);
            band.rotation.x = Math.PI / 2.3;
            ringGroup.add(band);
          });
          ringGroup.userData.isRings = true;
          scene.add(ringGroup);
          mesh.userData.orbitalRings = ringGroup;
        }
      }
      const moons = [
        { parent: 'МАРС', r: 0.12, d: 1.1, speed: 0.9 }, { parent: 'МАРС', r: 0.08, d: 1.5, speed: 0.6 },
        { parent: 'ЮПИТЕР', r: 0.35, d: 9, speed: 0.5 }, { parent: 'ЮПИТЕР', r: 0.3, d: 11, speed: 0.4 },
 { parent: 'ЮПИТЕР', r: 0.32, d: 13, speed: 0.33 }, { parent: 'ЮПИТЕР', r: 0.25, d: 15, speed: 0.27 },
 { parent: 'САТУРН', r: 0.3, d: 8, speed: 0.45 }, { parent: 'САТУРН', r: 0.25, d: 10, speed: 0.36 }, { parent: 'САТУРН', r: 0.22, d: 12, speed: 0.3 },
        { parent: 'УРАН', r: 0.2, d: 4, speed: 0.6 }, { parent: 'УРАН', r: 0.15, d: 5.5, speed: 0.45 },
        { parent: 'НЕПТУН', r: 0.2, d: 3.5, speed: 0.55 },
      ].map(m => {
 const parentMesh = meshes[BODIES.findIndex(b => b.name === m.parent)];
         const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x747b78, roughness: 1, metalness: 0 }));
 mesh.scale.setScalar(m.r);
 scene.add(mesh);
        return { mesh, parentMesh, d: m.d, speed: m.speed, phase: Math.random() * Math.PI * 2 };
      });
      space3d = { renderer, scene, camera, meshes, starField, starMaterial, nebulaGroup, nebulaSprites, quality, station, glint, sunUniforms: sunShader.uniforms, moons };
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

  const state = {
    dead: false, modal: false, raf: 0, t: 0, last: 0,
    thrust: { x: 0, y: 0 },
    events: { earth: false, moon: false, far: false },
    nearbyExpedition: null,
    pacing: { next: 78, beat: 0, lastMovement: 0 },
    braking: false,
  };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = stage.clientWidth; H = stage.clientHeight;
    const cDPR = space3d ? 1 : DPR; // при WebGL 2D-слой нужен только для мелких точек
    canvas.width = W * cDPR; canvas.height = H * cDPR;
    ctx.setTransform(cDPR, 0, 0, cDPR, 0, 0);
  }
  resize();
  addEventListener("resize", resize);

  function quietSignal(text, duration = 6200) {
    const signal = $("#signal-state");
    if (!signal) return;
    signal.textContent = text;
    signal.classList.remove("quiet-pulse");
    void signal.offsetWidth;
    signal.classList.add("quiet-pulse");
    setTimeout(() => {
      if (signal.isConnected && signal.textContent === text) signal.textContent = "";
    }, duration);
  }

  // Космос не выдаёт задания по таймеру. Директор лишь иногда меняет
  // атмосферу после длинного окна тишины, не останавливая полёт.
  function pacingDirector(dt) {
    const p = state.pacing;
    const speed = Math.hypot(cam.vel.x, cam.vel.y, cam.vel.z);
    if (speed > 0.18) p.lastMovement = state.t;
    if (state.modal || state.t < p.next || state.t - p.lastMovement < 8) return;
    p.beat += 1;
    const branch = branchSignalCopy();
    const quietBeats = [
      { line: "ЗВЁЗДЫ НА МГНОВЕНИЕ СТАЛИ БЛИЖЕ.", freq: 260 },
      { line: "В ТИШИНЕ ПОЯВИЛСЯ РИТМ. НЕ ТВОЙ.", freq: 310 },
      { line: `${branch.code}: СЛЕД НЕ ТРЕБУЕТ ОТВЕТА.`, freq: 220 },
      { line: "ОДНА ТОЧКА СВЕТА ДВИЖЕТСЯ ВМЕСТЕ С ТОБОЙ.", freq: 280 },
    ];
    const beat = quietBeats[(p.beat - 1) % quietBeats.length];
    AudioLayer.ping(beat.freq, 2.8, 0.018);
    quietSignal(beat.line, 7200);
    p.next = state.t + Math.min(210, 78 + p.beat * 24);
  }

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
  const EXPEDITIONS = [
    { id: "moon-back", name: "ОБРАТНАЯ СТОРОНА ЛУНЫ", x: EARTH.x + 1.8, y: 0.8, z: EARTH.z - 4.6, radius: 1.6, title: "СИГНАЛ С ОБРАТНОЙ СТОРОНЫ", body: "КТО-ТО ОСТАВИЛ ТАМ ОДНУ ФРАЗУ И НЕ ЗАБРАЛ ЕЁ ОБРАТНО.", effect: "moon-trace" },
    { id: "dead-station", name: "СТАНЦИЯ БЕЗ СМЕНЫ", x: STATION.x, y: STATION.y, z: STATION.z, radius: 2.2, title: "СТАНЦИЯ ПРОДОЛЖАЕТ РАБОТУ", body: "РАСПИСАНИЕ СМЕН ОБНОВЛЕНО СЕГОДНЯ. ЭКИПАЖ НЕ НАЙДЕН.", effect: "station-log" },
    { id: "echo-orbit", name: "ЭХО ПОСЛЕДНЕЙ МЫСЛИ", x: 22, y: -2.5, z: 12, radius: 3.4, title: "МЫСЛЬ НЕ ИМЕЕТ ВЛАДЕЛЬЦА", body: "ОНА ПОВТОРЯЕТСЯ КАЖДЫЕ 47 СЕКУНД. ТЕПЕРЬ В НЕЙ ЕСТЬ ТВОЙ ГОЛОС.", effect: "echo-fragment" },
  ];
  function expeditionCount() { return RUN.expeditions.length; }

  function expeditionDistance(exp) {
    return Math.hypot(cam.pos.x - exp.x, cam.pos.y - exp.y, cam.pos.z - exp.z) - exp.radius;
  }
  async function inspectExpedition(exp) {
    if (state.modal) return;
    const result = await showOverlay({
      cy: false,
      title: exp.title,
      quote: exp.name,
      body: `${exp.body}<br><span style="color:var(--dim)">СТАТУС: ОБЪЕКТ ДОСТИГНУТ · СВЯЗЬ С ЖИЗНЬЮ: ${Math.round(35 + RUN.memories.size * 12)}%</span>`,
      actions: [["Сохранить в архив", "save"], ["Улететь", "leave"]],
    });
    if (result === "save" && !RUN.expeditions.includes(exp.id)) {
      RUN.expeditions.push(exp.id);
      RUN.memories.add(exp.effect);
      persistRun();
      Haptics.notification("success");
      toast(`ОБЪЕКТ СОХРАНЁН · ${expeditionCount()} / ${EXPEDITIONS.length}<br>НОВЫЙ СИГНАЛ ДОБАВЛЕН В АРХИВ.`);
    }
  }
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

  // Адаптивное качество: если кадры идут медленно, снижаем плотность пикселей WebGL.
  // Картинка остаётся той же по композиции, на слабых телефонах без лишней нагрузки.
  function setQuality(level) {
    if (!space3d || space3d.quality.level === level) return;
    const q = space3d.quality;
    q.level = level;
    q.dprCap = level === "economy" ? 1 : level === "balanced" ? 1.25 : (matchMedia('(pointer: coarse)').matches ? 1.25 : 2);
    space3d.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.dprCap));
    q.starOpacity = level === "economy" ? 0.62 : level === "balanced" ? 0.78 : 0.9;
    space3d.nebulaSprites?.forEach((sprite) => {
      sprite.material.opacity = sprite.userData.base * (level === "economy" ? 0.55 : level === "balanced" ? 0.72 : 1);
    });
  }
  function adaptQuality(dt) {
    const q = space3d.quality;
    q.measured += 1;
    if (q.measured < 30) return;
    q.emaMs = q.emaMs * 0.94 + dt * 1000 * 0.06;
    if (q.emaMs > 28) {
      q.slowFrames++;
      q.fastFrames = 0;
    } else if (q.emaMs < 19) {
      q.fastFrames++;
      q.slowFrames = Math.max(0, q.slowFrames - 1);
    }
    if (q.slowFrames > 45 && q.level === "high") { setQuality("balanced"); q.slowFrames = 0; }
    else if (q.slowFrames > 90 && q.level === "balanced") { setQuality("economy"); q.slowFrames = 0; }
    else if (q.fastFrames > 300 && q.level === "economy") { setQuality("balanced"); q.fastFrames = 0; }
  }

  // --- главный цикл ---
  function frame() {
    if (state.dead || document.hidden) { state.raf = 0; return; }
    const now = performance.now();
    const dt = state.last ? Math.min(0.05, (now - state.last) / 1000) : 1 / 60;
    state.last = now;
    state.t += dt;
    if (space3d) adaptQuality(dt);
    pacingDirector(dt);
    for (const orbit of orbiting) {
      const angle = orbit.angle + state.t * orbit.speed;
      orbit.body.x = Math.cos(angle) * orbit.radius;
      orbit.body.z = Math.sin(angle) * orbit.radius;
    }
    const moonAngle = state.t * 0.006;
    MOON.x = EARTH.x + moonOffset.x * Math.cos(moonAngle) - moonOffset.z * Math.sin(moonAngle);
    MOON.z = EARTH.z + moonOffset.x * Math.sin(moonAngle) + moonOffset.z * Math.cos(moonAngle);
    // «дыхание» сущности: едва заметное покачивание взгляда
    const brY = reducedMotion ? 0 : Math.sin(state.t * 0.5) * 0.006, brP = reducedMotion ? 0 : Math.cos(state.t * 0.34) * 0.004;
    const B = basis(cam.yaw + brY, cam.pitch + brP);

    // физика полёта: тяга по направлению взгляда + дрейф (дистанции реальные — тяга высокая)
    if (!state.modal) {
      const flight = CalmFlight.step(cam.vel, state.thrust, B, dt, state.braking);
      state.braking = flight.braking;
      for (const axis of ["x", "y", "z"]) cam.pos[axis] += flight.movement[axis];
    }

    // фон: при WebGL небо рисует three.js, 2D-слой прозрачный
    ctx.clearRect(0, 0, W, H);
    if (!space3d) {
      ctx.fillStyle = "#020408";
      ctx.fillRect(0, 0, W, H);
    }

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
    if (!space3d) {
      skyPts(DUST, 1.6, (s) => "rgba(140,165,180,0.5)");
      skyPts(STARS, 1.9, (s) => s.c < 0.12 ? "rgba(180,200,235,0.9)" : s.c < 0.24 ? "rgba(230,210,180,0.9)" : "rgba(210,225,222,0.9)");
    }

    // все тела системы: рисуем по глубине (дальние — первыми)
    let nearest = { name: "—", d: Infinity };
    const draws = [];
    for (const b of BODIES) {
      const d = Math.hypot(cam.pos.x - b.x, cam.pos.y - b.y, cam.pos.z - b.z) - b.r;
      if (d < nearest.d) nearest = { name: b.name, d };
      draws.push({ b, d });
    }
    draws.sort((a, b) => b.d - a.d);
    for (const it of draws) {
      const b = it.b;
      const o = {
        label: b.name,
        hi: b.hi, mid: b.mid, lo: b.lo, night: b.night,
        atmo: b.atmo, atmoColor: b.atmoColor, marks: b.marks || [], ring: b.ring,
        sun: b.sun,
      };
      const res = space3d ? project(b, B) : drawPlanet(b, B, o);
      // приближение к телу: одноразовое системное сообщение
    }

    if (space3d) {
      const { renderer, scene, camera, meshes, starField, starMaterial, nebulaGroup, nebulaSprites, station, glint } = space3d;
      const stationAngle = state.t * 0.25;
      station.position.set(EARTH.x + Math.cos(stationAngle) * 1.25, EARTH.y + 0.15, EARTH.z + Math.sin(stationAngle) * 1.25);
      station.rotation.y = -stationAngle;
      glint.position.copy(station.position);
      if (camera.aspect !== W / H) { camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H); }
      camera.position.set(cam.pos.x, cam.pos.y, cam.pos.z);
      starField.position.copy(camera.position);
      starField.rotation.y = state.t * 0.00018;
      starMaterial.uniforms.uTime.value = state.t;
      // Едва заметное изменение плотности звёзд заменяет постоянные маркеры.
      starMaterial.uniforms.uOpacity.value = space3d.quality.starOpacity * (0.94 + Math.sin(state.t * 0.035) * 0.06);
      space3d.sunUniforms.uTime.value = state.t;
      space3d.moons.forEach(m => {
        const a = m.phase + state.t * m.speed;
        m.mesh.position.set(m.parentMesh.position.x + Math.cos(a) * m.d * 0.18, m.parentMesh.position.y, m.parentMesh.position.z + Math.sin(a) * m.d * 0.18);
      });
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

    // HUD-дистанции
    const dE = Math.hypot(cam.pos.x - EARTH.x, cam.pos.y - EARTH.y, cam.pos.z - EARTH.z) - EARTH.r;
    const dS = Math.hypot(cam.pos.x, cam.pos.y, cam.pos.z) - SUN.r;
    const v = Math.hypot(cam.vel.x, cam.vel.y, cam.vel.z);
    const setHud = (id, value) => { const el = $(id); if (el) el.textContent = value; };
    setHud("#d-earth", dE.toFixed(1) + " R");
    setHud("#d-sun", dS.toFixed(1) + " R");
    setHud("#v-now", v.toFixed(1));
    const nearEl = $("#d-near");
    if (nearEl) nearEl.textContent = `${nearest.name} · ${nearest.d.toFixed(1)} R`;

    // события по мере полёта: теперь относительно Земли в её реальной точке орбиты

    state.raf = requestAnimationFrame(frame);
  }

  // --- управление: взгляд (drag по экрану) ---
  let look = null;
  canvas.addEventListener("pointerdown", (e) => { look = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!look || e.pointerId !== look.id) return;
    cam.yaw += (e.clientX - look.x) / W * LOOK_GAIN;
    cam.pitch = clamp(cam.pitch + (e.clientY - look.y) / H * LOOK_GAIN, -1.35, 1.35);
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
    const dx0 = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
    const dy0 = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
    const dead = (v) => Math.abs(v) < 0.12 ? 0 : Math.sign(v) * (Math.abs(v) - 0.12) / 0.88;
    const dx = dead(dx0), dy = dead(dy0);
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
  const onKD = (e) => { if (state.modal) return; const k = KEYS[e.code]; if (k && !keyThrust[k]) { e.preventDefault(); keyThrust[k] = true; applyKeyThrust(); } };
  const onKU = (e) => { const k = KEYS[e.code]; if (k) { keyThrust[k] = false; applyKeyThrust(); } };
  if (window.__spaceKD) { removeEventListener("keydown", window.__spaceKD); removeEventListener("keyup", window.__spaceKU); }
  window.__spaceKD = onKD; window.__spaceKU = onKU;
  addEventListener("keydown", onKD);
  addEventListener("keyup", onKU);

  $("#k-slow").onclick = () => {
    endStick();
    Object.keys(keyThrust).forEach(k => keyThrust[k] = false);
    applyKeyThrust();
    state.braking = true;
  };
  $("#k-scan").onclick = () => {
    AudioLayer.ping(760, 0.6, 0.1);
    const undiscovered = EXPEDITIONS
      .filter((exp) => !RUN.expeditions.includes(exp.id))
      .map((exp) => ({ exp, d: expeditionDistance(exp) }))
      .sort((a, b) => a.d - b.d)[0];
    if (undiscovered && undiscovered.d < 18) {
      state.nearbyExpedition = undiscovered.exp;
      inspectExpedition(undiscovered.exp);
      return;
    }
    const dE = Math.hypot(cam.pos.x - EARTH.x, cam.pos.y - EARTH.y, cam.pos.z - EARTH.z) - EARTH.r;
    const dS = Math.hypot(cam.pos.x, cam.pos.y, cam.pos.z) - SUN.r;
    const dMoon = Math.hypot(cam.pos.x - MOON.x, cam.pos.y - MOON.y, cam.pos.z - MOON.z) - MOON.r;
    if (state.modal) return;
    if (dMoon < 3 && !state.events.moon) { state.events.moon = true; eventMoon(); return; }
    if (dS > 700 && !state.events.far) { state.events.far = true; eventSignal(); return; }
    if (dE > 22 && !state.events.earth) { state.events.earth = true; eventEarthFar(); return; }
    let near = { name: "—", d: Infinity };
    for (const b of BODIES) {
      const d = Math.hypot(cam.pos.x - b.x, cam.pos.y - b.y, cam.pos.z - b.z) - b.r;
      if (d < near.d) near = { name: b.name, d };
    }
    if (state.nearbyExpedition && !RUN.expeditions.includes(state.nearbyExpedition.id)) {
      inspectExpedition(state.nearbyExpedition);
      return;
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
    if (state.modal) return Promise.resolve(null);
    state.modal = true;
    state.thrust = { x: 0, y: 0 };
    cam.vel = { x: 0, y: 0, z: 0 };
    Object.keys(keyThrust).forEach(k => keyThrust[k] = false);
    applyKeyThrust();
    const previousFocus = document.activeElement;
    const host = $("#overlay-host");
    host.innerHTML = `<div class="overlay"><div class="card ${cy ? "cy" : ""}" role="dialog" aria-modal="true" aria-labelledby="overlay-title">
      <div class="eyebrow" style="color:${cy ? "var(--dim)" : "var(--amber)"}">${cy ? "система наблюдения" : "обнаружен сигнал"}</div>
      <h3 id="overlay-title">${title}</h3>
      ${quote ? `<div class="quote serif">«${quote}»</div>` : ""}
      <div class="system" style="${cy ? "" : "color:var(--amber)"}">${body}</div>
      <div class="row">${actions.map(([label, go], i) => `<button class="button ${i === 0 && !cy ? "primary" : ""}" data-ov="${i}">${label}</button>`).join("")}</div>
    </div></div>`;
    const ov = host.querySelector(".overlay");
    const btns = [...host.querySelectorAll("[data-ov]")];
    btns[0]?.focus();
    ov.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !btns.length) return;
      const index = btns.indexOf(document.activeElement);
      if (e.shiftKey && index === 0) { e.preventDefault(); btns[btns.length - 1].focus(); }
      else if (!e.shiftKey && index === btns.length - 1) { e.preventDefault(); btns[0].focus(); }
    });
    return new Promise((done) => {
      btns.forEach((b, i) => b.onclick = () => { ov.remove(); state.modal = false; if (previousFocus?.isConnected) previousFocus.focus(); done(actions[i][1]); });
    });
  }

  function eventEarthFar() {
    AudioLayer.ping(320, 1.2, 0.08);
    const branch = branchSignalCopy();
    persistRun();
    const signalState = $("#signal-state");
    if (signalState) signalState.textContent = `СИГНАЛ: ${branch.title}`;
    showOverlay({
      cy: true, title: branch.title,
      body: `${branch.body}<br><span style="color:var(--danger)">МАСШТАБ НЕ СОВПАДАЕТ С КАРТОЙ.</span>`,
      actions: [["Продолжить", null]],
    });
  }

  async function eventMoon() {
    AudioLayer.whisper();
    const branch = branchSignalCopy();
    persistRun();
    const signalState = $("#signal-state");
    if (signalState) signalState.textContent = `СИГНАЛ: ${signalBranch()}`;
    const held = hasMemory("memory", "earth");
    const go = await showOverlay({
      cy: false, title: `Сигнал · ${branch.title.toLowerCase()}`,
      quote: branch.quote || "Ты ещё не вернулся?",
      body: `${branch.body}<br>${held ? "ГОЛОС ПРИНАДЛЕЖИТ ЖИЗНИ, КОТОРУЮ ТЫ ВЫБРАЛ." : "ГОЛОС НЕ СОВПАДАЕТ С СОХРАНЁННЫМИ ВОСПОМИНАНИЯМИ."}<br>АУДИОЗАПИСЬ: <b>НЕТ</b>. ИСТОЧНИК: <b>НЕТ</b>.`,
      actions: [["Записать в память", "keep"], ["Улететь", "leave"]],
    });
    if (go === "keep") {
      toast("ПАМЯТЬ 06 · СОХРАНЕНА.<br>СТАТУС: <span style='color:var(--danger)'>НЕ СОВПАДАЕТ С АРХИВОМ.</span>");
    }
  }

  async function eventSignal() {
    AudioLayer.whisper();
    const branch = branchSignalCopy();
    persistRun();
    const signalState = $("#signal-state");
    if (signalState) signalState.textContent = `СИГНАЛ: ${signalBranch()}`;
    const carried = hasMemory("memory", "voice");
    const summary = runSummary();
    const go = await showOverlay({
      cy: false, title: `Сигнал · ${branch.title.toLowerCase()}`,
      quote: branch.quote || "Ты ещё успеешь?",
      body: `${branch.body}<br>${carried ? "ПОСЛЕДНЯЯ МЫСЛЬ ОБЪЕКТА ВОЗВРАЩАЕТСЯ ИЗ ТОЧКИ," : "СИГНАЛ ВОЗВРАЩАЕТСЯ БЕЗ ПОСЛЕДНЕЙ МЫСЛИ."}<br>ГДЕ НЕТ НИ ЗЕМЛИ, НИ ЛУНЫ, НИ ТЕБЯ.`,
      actions: [[summary.answered ? "Ответить сигналу" : "Передать пустой канал", "send"], ["Оставить себе", "keep"]],
    });
    if (go === "send" || go === "keep") ending(go);
  }

  function toast(html) {
    const host = $("#overlay-host");
    const el = document.createElement("div");
    el.className = "overlay"; el.style.background = "transparent"; el.style.backdropFilter = "none"; el.style.pointerEvents = "none";
    el.innerHTML = `<div class="card cy" style="border-color:rgba(143,209,194,.35)"><div class="system">${html}</div></div>`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function ending(choice = "send") {
    AudioLayer.fade(0.0001, 4);
    Haptics.notification("success");
    state.dead = true; cancelAnimationFrame(state.raf);
    flashOn();
    const meta = completeMetaRun();
    const summary = runSummary();
    persistRun("complete");
    const retained = summary.retained;
    const endingTitle = choice === "keep"
      ? (summary.choseReturn ? "Память вернулась к Земле" : retained >= 2 ? "Память не исчезла" : "Память осталась одна")
      : (summary.answered ? "Память получила ответ" : retained >= 2 ? "Память передана" : "Передавать было нечего");
    const endingText = choice === "keep"
      ? `${summary.choseReturn ? "Ты вернулся к Земле, но Земля не ответила. " : "Ты сохранил "}${retained ? "часть этой жизни" : "только тишину"}. В темноте она звучит всё тише, но пока ещё принадлежит тебе.`
      : `${summary.answered ? "Сигнал ответил твоим голосом. " : "Канал остался пустым. "}Ты отправил память дальше — ${retained ? "вместе с тем, что успел сохранить" : "почти без следа"}. Теперь она летит туда, где нет получателя.`;
    const choiceText = readableChoices();
    render(`
      <div class="screen">
        <div class="ending-wrap">
          <div class="eyebrow">${choice === "keep" ? "память сохранена · свидетель не определён" : "память передана · получатель не определён"}</div>
          <h1 class="serif">Всё, что от меня<span class="ost">ОСТАЛОСЬ</span></h1>
          <div class="system">${endingTitle}</div>
          <p class="faint" style="max-width:420px;margin:14px auto 0">${endingText}</p>
          <div class="result-card"><span>ОТПЕЧАТОК ПРОХОЖДЕНИЯ</span><b>${LIFE.name}</b><small>${LIFE.symbol || "след не определён"} · ${choiceText} · ${retained} фрагм.</small><small>ОБЩИЙ АРХИВ: ${archivePercent(meta)}% · ЖИЗНЕЙ: ${meta.lives} · ЭКСПЕДИЦИЙ: ${meta.expeditions.length}/${EXPEDITION_IDS.length}</small></div>
          <div class="row center">
            <button class="button primary" data-go="restart">Начать снова</button>
            <button class="button ghost" data-go="title">Закрыть архив</button>
            <button class="button ghost" data-share>Поделиться результатом</button>
            <button class="button ghost" data-card>Сохранить карточку</button>
          </div>
        </div>
      </div>`);
  }

  // скрыть подсказку через 6с
  setTimeout(() => { const h = $("#hint"); if (h) { h.style.opacity = "0"; h.style.transition = "opacity 1.2s"; } }, 6000);

  const onVisible = () => { if (!document.hidden && !state.dead && !state.raf) { state.last = 0; state.raf = requestAnimationFrame(frame); } };
  document.addEventListener("visibilitychange", onVisible);
  cleanupSpace = () => {
    state.dead = true; cancelAnimationFrame(state.raf);
    removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVisible);
    removeEventListener("keydown", onKD); removeEventListener("keyup", onKU);
    if (space3d) {
      space3d.scene.background?.dispose();
      space3d.scene.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
      space3d.renderer.dispose();
      space3d.renderer.forceContextLoss();
    }
  };

  frame();
}

// ---------- маршрутизация ----------
let memIdx = 0;
document.addEventListener("click", (e) => {
  if (AudioLayer.ctx?.state === "suspended") AudioLayer.ctx.resume().catch(() => {});
  const decision = e.target.closest("[data-choice]");
  if (decision) {
    Haptics.impact("light");
    RUN.choices[memIdx] = decision.dataset.choice;
    RUN.memories.add(decision.dataset.effect);
    persistRun();
    decision.parentElement.querySelectorAll("[data-choice]").forEach((b) => {
      b.disabled = true;
      b.classList.toggle("selected", b === decision);
    });
    const advance = stage.querySelector(".scene-foot [data-go]");
    if (advance) advance.disabled = false;
    return;
  }
  if (e.target.closest("[data-share]")) {
    Haptics.impact("medium");
    const text = resultText();
    const shareUrl = `${location.origin}${location.pathname}`;
    if (TG?.openTelegramLink) TG.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`);
    else if (navigator.share) navigator.share({ title: "Всё, что от меня ОСТАЛОСЬ", text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => alert("Результат скопирован"), () => {});
    return;
  }
  if (e.target.closest("[data-card]")) {
    Haptics.impact("light");
    downloadResultCard();
    return;
  }
  const choice = e.target.closest('[data-life]');
  if (choice) { LIFE = lifePool.find((life) => String(life.id) === choice.dataset.life) || lifePool[0]; chooseScreen(); return; }
  const go = e.target.closest("[data-go]")?.dataset.go;
  if (!go) return;
  AudioLayer.ensure();
  Haptics.selection();
  if (go === "title") titleScreen();
  if (go === "resume") restoreRun();
  if (go === "choose") {
    if (hasActiveRun() && !confirm("Незавершённая запись будет заменена новой. Продолжить?")) return;
    pickLives(); chooseScreen();
  }
  if (go === "reroll") {
    if (hasActiveRun() && !confirm("Незавершённая запись будет заменена новой пятёркой. Продолжить?")) return;
    pickLives(); chooseScreen();
  }
  if (go === "mem") { memIdx = 0; memoryScreen(0); }
  if (go === "next") { memIdx++; persistRun(); memoryScreen(memIdx); }
  if (go === "death") deathScreen();
  if (go === "space") transitionToSpace();
  if (go === "restart") { pickLives(); chooseScreen(); }
});

// старт: короткое «пробуждение» и титул
render(`<div class="screen" style="place-items:end center"><span class="faint" style="padding-bottom:40px">— — —</span></div>`);
titleScreen();
