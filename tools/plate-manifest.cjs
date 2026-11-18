// Writes assets/memories/plates.json and a separate memory-plates.js that exposes
// the actual file list. memory-images.js stays hand-written: this script never
// edits it, so a broken regex can no longer corrupt the runtime.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'assets', 'memories');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort();
const base = files.filter((f) => /^[a-z-]+-\d{4}\.jpg$/.test(f));
const variants = files.filter((f) => /^[a-z-]+-\d{4}-b\.jpg$/.test(f));
fs.writeFileSync(path.join(dir, 'plates.json'), JSON.stringify({ base, variants }, null, 1) + '\n', 'utf8');
const js = `/* Written by tools/plate-manifest.cjs: the plate files that actually exist. */\nconst MEMORY_PLATE_FILES = new Set(${JSON.stringify(files, null, 1)});\n`;
fs.writeFileSync(path.join(__dirname, '..', 'memory-plates.js'), js, 'utf8');
console.log('base', base.length, 'variants', variants.length, 'files', files.length);
