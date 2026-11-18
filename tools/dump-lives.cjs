const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8').replace(/^\uFEFF/, '');
global.window = global;
new Function(src)();
const out = [];
for (const life of window.CURATED_LIVES) {
  out.push('='.repeat(72));
  out.push(`${life.id} · ${life.name} · ${life.place} · ${life.year} · ${life.gender} · ${life.shape}`);
  out.push(`желание: ${life.desire} | последние слова: ${life.last} | предмет: ${life.symbol}`);
  life.memories.forEach((m, i) => {
    const age = typeof m.y === 'number' ? m.y - life.year : null;
    out.push('');
    out.push(`[${i}] y=${m.y}${age != null ? ` (возраст ${age})` : ''} loc=${m.loc} time=${m.time} age=${m.age}`);
    out.push(`    «${m.h}»`);
    out.push(`    ${m.p}`);
    if (m.whisper) out.push(`    шёпот: ${m.whisper}`);
    if (m.choices) out.push(`    выбор: ${m.choices.map((c) => c.label).join(' | ')}`);
  });
}
fs.writeFileSync(path.join(__dirname, '..', '_lives.txt'), out.join('\n'), 'utf8');
console.log('lives', window.CURATED_LIVES.length, 'lines', out.length);
