const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

let cache;
function loadLives() {
  if (cache) return cache;
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('content.js', 'utf8'), context);
  cache = context.window.CURATED_LIVES;
  return cache;
}

const LOCS = new Set(['roddom', 'kitchen', 'yard', 'school', 'bedroom', 'platform', 'factory', 'office', 'hospital', 'sea', 'field', 'cemetery', 'stairwell', 'balcony', 'bus', 'empty']);
const TIMES = new Set(['day', 'dusk', 'night']);
const AGES = new Set(['baby', 'child', 'teen', 'adult', 'old', 'none']);

test('catalog contains exactly 500 lives', () => {
  assert.equal(loadLives().length, 500);
  assert.equal(loadLives().filter((l) => l.id >= 1001 && l.id <= 1012).length, 12);
});

test('all full names are unique', () => {
  const names = loadLives().map((life) => life.name);
  assert.equal(new Set(names).size, names.length);
});

test('every life has six scenes and three decisions', () => {
  const ids = [['keep', 'release'], ['stay', 'leave'], ['answer', 'ignore']];
  for (const life of loadLives()) {
    assert.equal(life.memories.length, 6, life.name);
    assert.equal(life.memories.filter((scene) => scene.choices).length, 3, life.name);
    for (let i = 1; i <= 3; i++) assert.equal(life.memories[i].choices.map((c) => c.id).join(), ids[i - 1].join(), life.name);
  }
});

test('female surnames agree with female first names', () => {
  const exception = new Set(['Руденко', 'Кравченко']);
  for (const life of loadLives().filter((item) => item.gender === 'f')) {
    const surname = life.name.split(' ')[1];
    assert.ok(exception.has(surname) || surname.endsWith('а') || surname.endsWith('я'), life.name);
  }
});

test('male surnames use the masculine form', () => {
  const exception = new Set(['Руденко', 'Кравченко']);
  for (const life of loadLives().filter((item) => item.gender === 'm')) {
    const surname = life.name.split(' ')[1];
    assert.ok(exception.has(surname) || !surname.endsWith('а'), life.name);
  }
});

test('every memory has a valid scene', () => {
  for (const life of loadLives()) {
    life.memories.forEach((m, i) => {
      assert.ok(LOCS.has(m.loc), `${life.name} ${i} loc ${m.loc}`);
      assert.ok(TIMES.has(m.time), `${life.name} ${i} time`);
      assert.ok(AGES.has(m.age), `${life.name} ${i} age`);
      assert.ok([0, 1, 2].includes(m.others), `${life.name} ${i} others`);
      assert.ok(m.prop, `${life.name} ${i} prop`);
    });
    assert.equal(life.memories[0].age, 'baby', life.name);
    assert.equal(life.memories[5].age, 'none', life.name);
    assert.equal(life.memories[5].y, 'после', life.name);
  }
});

test('headlines are not overused', () => {
  const lives = loadLives();
  const count = new Map();
  for (const l of lives) for (const h of new Set(l.memories.map((m) => m.h))) count.set(h, (count.get(h) || 0) + 1);
  for (const [h, n] of count) assert.ok(n <= 3, `${h} used ${n} times`);
  const sets = lives.map((l) => new Set(l.memories.map((m) => m.h)));
  for (let a = 0; a < sets.length; a++) for (let b = a + 1; b < sets.length; b++) {
    let shared = 0;
    for (const h of sets[a]) if (sets[b].has(h)) shared++;
    assert.ok(shared <= 2, `${lives[a].name} / ${lives[b].name}`);
  }
});

test('no broken text', () => {
  for (const life of loadLives()) {
    const text = JSON.stringify(life);
    assert.ok(!text.includes('undefined') && !text.includes('NaN'), life.name);
    for (const m of life.memories) for (const s of [m.h, m.p, ...(m.choices || []).map((c) => c.label)]) {
      assert.ok(!/ {2}| \.|\s,/.test(s), `${life.name}: «${s}»`);
    }
  }
});

test('self-forms agree with gender', () => {
  for (const life of loadLives()) {
    const text = life.memories.map((m) => `${m.h} ${m.p}`).join(' ');
    if (life.gender === 'f') assert.ok(!/Ты \S+л[ .,]/.test(text), `${life.name}: ${text.match(/Ты \S+л[ .,]/)}`);
    else assert.ok(!/Ты \S+ла[ .,]/.test(text), `${life.name}: ${text.match(/Ты \S+ла[ .,]/)}`);
  }
});

test('years increase and death is not after 2080', () => {
  for (const life of loadLives()) {
    const y = life.memories.slice(0, 5).map((m) => m.y);
    for (let i = 1; i < 5; i++) assert.ok(y[i] > y[i - 1], `${life.name} ${y}`);
    assert.ok(y[4] <= 2080, life.name);
  }
});

function trigrams(life) {
  const words = life.memories.map((m) => `${m.h} ${m.p}`).join(' ').toLowerCase().replace(/[^а-яё0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i + 2 < words.length; i++) set.add(words.slice(i, i + 3).join(' '));
  return set;
}
function jaccard(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

test('lives do not share too many word trigrams', () => {
  const lives = loadLives();
  const tg = lives.map(trigrams);
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let k = 0; k < 150; k++) {
    const a = Math.floor(rnd() * lives.length), b = Math.floor(rnd() * lives.length);
    if (a !== b) assert.ok(jaccard(tg[a], tg[b]) < 0.35, `${lives[a].name} / ${lives[b].name}`);
  }
  const byShape = new Map();
  lives.forEach((l, i) => byShape.set(l.shape, [...(byShape.get(l.shape) || []), i]));
  for (const idx of byShape.values()) for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
    const j = jaccard(tg[idx[a]], tg[idx[b]]);
    assert.ok(j < 0.35, `${lives[idx[a]].name} / ${lives[idx[b]].name}: ${j.toFixed(2)}`);
  }
});
