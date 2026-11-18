const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8').replace(/^\uFEFF/, '');
global.window = global;
new Function(src)();
const use = new Map();
const eraCount = new Map();
for (const life of window.CURATED_LIVES) {
  for (const m of life.memories) {
    use.set(m.loc, (use.get(m.loc) || 0) + 1);
    const decade = Math.floor((typeof m.y === 'number' ? m.y : life.year + 75) / 10) * 10;
    const k = `${m.loc}:${decade}`;
    eraCount.set(k, (eraCount.get(k) || 0) + 1);
  }
}
const sorted = [...use.entries()].sort((a, b) => b[1] - a[1]);
console.log('lives', window.CURATED_LIVES.length, 'slots', [...use.values()].reduce((a, b) => a + b, 0));
console.log(sorted.map(([k, v]) => `${k} ${v}`).join('\n'));
console.log('--- top loc:decade ---');
console.log([...eraCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([k, v]) => `${k} ${v}`).join('\n'));
