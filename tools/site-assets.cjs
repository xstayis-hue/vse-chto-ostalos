const { copyFileSync, mkdirSync, readFileSync, rmSync } = require('node:fs');
const { join, dirname } = require('node:path');
const { execFileSync } = require('node:child_process');
const root = join(__dirname, '..');
const { used } = require('./check-plates.cjs');

const files = [
  'index.html', 'sw.js', 'manifest.webmanifest', 'icon.svg', '_headers',
  'app.js', 'content.js', 'styles.css', 'experience.css', 'flight.js', 'dying-frame.js',
  'ascent.js', 'space-scene.js', 'memory-plates.js', 'memory-images.js', 'memory-composer.js',
  'assets/three.min.js', 'assets/star-catalog.js', 'assets/saturn-ring.png',
  ...['archive-cover', 'earth', 'earth-night', 'earth-clouds', 'sun-api-candidate', 'milky-way-real-4k', 'moon',
    'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].map(name => `assets/${name}.jpg`),
  ...['moon', 'io', 'europa', 'ganymede', 'callisto', 'titan', 'triton'].map(name => `assets/moons/${name}.jpg`),
  ...Array.from(used.keys(), name => `assets/memories/${name}`),
];

for (const file of files) readFileSync(join(root, file));
if (process.exitCode) process.exit(process.exitCode);

if (process.argv.includes('--stage')) {
  const output = join(root, '.deploy-staged');
  rmSync(output, { recursive: true, force: true });
  for (const file of files) {
    const dest = join(output, file);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(root, file), dest);
  }
  console.log(`Staged ${files.length} runtime assets`);
} else if (process.argv.includes('--tracked')) {
  const tracked = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0'));
  for (const file of files) if (!tracked.has(file)) { console.error(`Not tracked: ${file}`); process.exitCode = 1; }
} else {
  console.log(`Verified ${files.length} runtime assets`);
}
