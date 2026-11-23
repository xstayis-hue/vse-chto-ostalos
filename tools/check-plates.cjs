// Verifies every life resolves to a plate file that exists on disk.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const files = new Set(fs.readdirSync(path.join(root, 'assets', 'memories')));
const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'memory-plates.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'memory-images.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'content.js'), 'utf8').replace(/^\uFEFF/, ''), context);
const lives = context.window.CURATED_LIVES;
let missing = 0, total = 0;
const used = new Map();
for (const life of lives) {
  for (let i = 0; i < life.memories.length; i++) {
    const url = context.memoryImageUrl(life, i);
    const name = url.split('/').pop();
    total++;
    used.set(name, (used.get(name) || 0) + 1);
    if (!files.has(name)) { missing++; console.log('MISSING', life.name, i, url); }
  }
}
console.log('total', total, 'missing', missing, 'distinct plates', used.size);
console.log([...used.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join('\n'));
if (missing || total !== 72) process.exitCode = 1;
module.exports = { used };
