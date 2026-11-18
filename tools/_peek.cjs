const fs = require('fs');
const s = fs.readFileSync('content.js', 'utf8');
console.log('len', s.length);
const i = s.indexOf('const LIVES');
console.log(s.slice(i, i + 1400));
const j = s.indexOf('shapes');
console.log('---SHAPES---', j);
console.log(s.slice(j - 200, j + 1200));
