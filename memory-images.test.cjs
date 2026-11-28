const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

let cache;
function load() {
  if (cache) return cache;
  const context = { window: {}, console };
  vm.createContext(context);
  for (const file of ['memory-plates.js', 'memory-images.js', 'content.js']) {
    vm.runInContext(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''), context);
  }
  cache = context;
  return cache;
}

const LIVES = () => load().window.CURATED_LIVES;
const URL_OF = (life, index) => load().memoryImageUrl(life, index);
const PLATES = new Set(fs.readdirSync('assets/memories').filter((f) => f.endsWith('.jpg')));
const eraOf = (name) => Number(name.match(/-(\d{4})(-b)?\.jpg$/)[1]);
const isAfter = (m) => m.y === 'после' || m.age === 'none';
const yearOf = (life, m) => (Number.isFinite(m.y) ? m.y : (Number(life.year) || 1950) + 75);

function slots() {
  const out = [];
  for (const life of LIVES()) life.memories.forEach((m, i) => out.push({
    key: `${life.id}:${i}`, life: life.name, name: life.name, index: i, memory: m,
    file: URL_OF(life, i).split('/').pop(), year: yearOf(life, m), after: isAfter(m),
  }));
  return out;
}

test('every scene resolves to a plate that exists on disk', () => {
  const all = slots();
  assert.equal(all.length, 72);
  for (const slot of all) assert.ok(PLATES.has(slot.file), `${slot.life} ${slot.index}: ${slot.file}`);
});

test('plates are shared across lives instead of collapsing onto one file', () => {
  const count = new Map();
  for (const slot of slots()) count.set(slot.file, (count.get(slot.file) || 0) + 1);
  const heaviest = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  assert.ok(count.size >= 35, `only ${count.size} distinct plates for 72 scenes`);
  assert.ok(heaviest[1] <= 6, `${heaviest[0]} carries ${heaviest[1]} of 72 scenes`);
});

test('a living scene stays inside its era, and the room is the one the text names', () => {
  for (const slot of slots()) {
    const gap = Math.abs(eraOf(slot.file) - slot.year);
    // The final frame is the same room years later, so it is allowed the wider
    // window that content.test.cjs already gives "после" scenes.
    assert.ok(gap <= (slot.after ? 120 : 50), `${slot.life} ${slot.index} (${slot.year}) shows ${slot.file}`);
    const loc = slot.memory.loc;
    if (!slot.after) assert.ok(slot.file.startsWith(loc + '-'), `${slot.life} ${slot.index} ${loc} shows ${slot.file}`);
  }
});

test('one life does not repeat a room in two different scenes', () => {
  for (const life of LIVES()) {
    const used = new Set();
    life.memories.forEach((m, i) => {
      const file = URL_OF(life, i).split('/').pop();
      assert.ok(!used.has(file), `${life.name}: ${file} used twice`);
      used.add(file);
    });
  }
});

test('the choice of plate is deterministic', () => {
  const first = slots().map((s) => s.file).join();
  delete require.cache;
  const context = { window: {}, console };
  vm.createContext(context);
  for (const file of ['memory-plates.js', 'memory-images.js', 'content.js']) {
    vm.runInContext(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''), context);
  }
  const second = context.window.CURATED_LIVES
    .flatMap((life) => life.memories.map((_, i) => context.memoryImageUrl(life, i).split('/').pop()))
    .join();
  assert.equal(first, second);
});
