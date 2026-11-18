const fs = require('fs');
const p = 'app.js';
let src = fs.readFileSync(p, 'utf8');
const block = fs.readFileSync(process.env.TEMP + '/opencode/memory-block.js', 'utf8');
// Rebuild the region between chooseScreen() and the old CHOICE_ECHO/memory code.
const startMarker = 'const CHOICE_ECHO = {';
const start = src.indexOf(startMarker);
if (start < 0) throw new Error('CHOICE_ECHO not found');
// find the end of the old CHOICE_ECHO object
let depth = 0, i = start + startMarker.length - 1, end = -1;
for (; i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
if (end < 0) throw new Error('unbalanced CHOICE_ECHO');
// also drop a trailing semicolon/newlines
let tail = end;
if (src[tail] === ';') tail++;
src = src.slice(0, start) + block.trimEnd() + '\n' + src.slice(tail);
fs.writeFileSync(p, src);
console.log('rebuilt memoryScreen; file is now', src.length, 'chars');
