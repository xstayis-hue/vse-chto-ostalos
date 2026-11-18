const fs = require('fs');
const p = 'app.js';
let src = fs.readFileSync(p, 'utf8');
const block = fs.readFileSync(process.env.TEMP + '/opencode/memory-block2.js', 'utf8').replace(/\n+$/, '\n');

// Replace memoryScreen through the end of the old CHOICE_ECHO object.
const startMarker = '/* Один кадр воспоминания.';
const start = src.indexOf(startMarker);
if (start < 0) throw new Error('memoryScreen comment not found');
const echoStart = src.indexOf('const CHOICE_ECHO = {');
if (echoStart < 0) throw new Error('CHOICE_ECHO not found');
let depth = 0, i = echoStart + 'const CHOICE_ECHO ='.length, end = -1;
for (; i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
if (end < 0) throw new Error('unbalanced');
let tail = end;
if (src[tail] === ';') tail++;

src = src.slice(0, start) + block + src.slice(tail);
fs.writeFileSync(p, src);
console.log('memoryScreen rebuilt:', src.length, 'chars');
