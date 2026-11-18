/* Prints complete biographies so the prose can be read as a story, not as slots. */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'content.js');
const src = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
global.window = global;
new Function(src)();
const lives = (window.CURATED_LIVES || []).slice(0, Number(process.argv[2]) || 3);
for (const life of lives) {
  console.log('='.repeat(70));
  console.log(`${life.name} · ${life.place} · ${life.year} · ${life.shape || 'authored'} · ${life.gender}`);
  console.log(`желание: ${life.desire}`);
  life.memories.forEach((m, i) => {
    console.log(`\n[${i}] ${m.y}  →  ${m.y} ${typeof m.y === 'number' ? '' : ''}`);
    console.log(`   ${m.h}`);
    console.log(`   ${m.p}`);
    if (m.whisper) console.log(`   … ${m.whisper}`);
    if (m.choices) console.log(`   выбор: ${m.choices.map(c => c.label).join(' / ')}`);
  });
}
