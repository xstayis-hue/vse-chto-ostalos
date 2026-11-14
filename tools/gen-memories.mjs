// Generates memory backgrounds via PlusVibe seedream. Usage: node tools/gen-memories.mjs
// Key is read from the user's local VibeCode.txt (first line), never printed.
import fs from 'node:fs';
import path from 'node:path';

const KEY = fs.readFileSync('C:/Users/xstay/Desktop/VibeCode.txt', 'utf8').split(/\r?\n/)[0].trim();
const OUT = path.resolve('assets/memories');
fs.mkdirSync(OUT, { recursive: true });

const STYLE = '16-bit Sega Genesis pixel art, Streets of Rage 2 background quality, hand-pixeled colour ramps, dithering, crisp pixels, side view, muted melancholic faded palette, eerie stillness, liminal, soviet 1970s-1990s, cinematic composition, no text, no letters, no logos';
const LOCS = {
  roddom: 'old soviet maternity ward room, iron hospital bed, swaddled newborn in a small metal cot, tiled walls, tall window',
  kitchen: 'small soviet apartment kitchen, table with oilcloth, enamel kettle, radiator, net curtain on the window',
  yard: 'courtyard between five-storey soviet panel apartment blocks, rusty swing, sandbox, laundry lines, bare trees',
  school: 'empty soviet school classroom, wooden desks in rows, blackboard, potted plant, tall windows',
  bedroom: 'small bedroom in a soviet flat, carpet on the wall, narrow bed, wardrobe, desk lamp',
  platform: 'provincial railway platform, old electric train with open doors, concrete canopy, puddles',
  factory: 'huge soviet factory hall, machine tools, overhead crane, dusty light shafts from high windows',
  office: 'soviet office room, wooden desk, rotary phone, typewriter, filing cabinets, faded portrait-shaped stain on wall',
  hospital: 'provincial hospital corridor, benches, green painted walls, white doors, flickering tube light',
  sea: 'grey northern seashore, wooden pier going into the sea, distant lighthouse, low clouds',
  field: 'endless wheat field, lone birch tree, power line poles to the horizon, dirt road',
  cemetery: 'small village cemetery among birches, iron fences painted blue, crosses and stars, crows',
  stairwell: 'interior of a soviet apartment block stairwell podyezd seen from the ground floor landing: a flight of concrete stairs with a metal railing rises and turns around a corner onto the next landing above, the upper floor and a window on the half-landing are visible, apartment doors, row of metal mailboxes, walls painted green below and whitewashed above, single bare bulb, architecturally correct, stairs lead somewhere',
  balcony: 'cluttered soviet balcony at height, jars, bicycle, laundry, view over panel blocks and the city',
  bus: 'lonely bus stop shelter on a suburban road, one street lamp, snow, distant apartment windows',
  empty: 'the same apartment room but abandoned, furniture covered with white sheets, stopped wall clock, dust in light',
};
const TIMES = { day: 'pale overcast daylight', night: 'night, cold moonlight and one warm lamp, deep shadows' };
const jobs = [];
for (const [loc, d] of Object.entries(LOCS)) for (const [t, td] of Object.entries(TIMES)) {
  jobs.push({ file: `${loc}-${t}.jpg`, prompt: `${d}. ${td}. No people. ${STYLE}` });
}
const FIG = ['kitchen', 'yard', 'platform', 'hospital', 'sea', 'field', 'stairwell', 'bus', 'bedroom', 'balcony', 'cemetery', 'school', 'factory', 'office'];
for (const loc of FIG) {
  jobs.push({ file: `${loc}-figure.jpg`, prompt: `${LOCS[loc]}. dusk, dim amber light. One small lonely human figure standing still with their back turned, far from the viewer, face not visible. ${STYLE}` });
}

const BUDGET = Number(process.env.MAX || jobs.length);
let n = 0;
for (const j of jobs) {
  const dst = path.join(OUT, j.file);
  if (fs.existsSync(dst)) continue;
  if (n >= BUDGET) break;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch('https://plusvibeapi.ru/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'seedream-5-0-flash', prompt: j.prompt, n: 1, size: '1024x576' }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(json).slice(0, 200));
      const img = await fetch(json.data[0].url);
      fs.writeFileSync(dst, Buffer.from(await img.arrayBuffer()));
      n++;
      console.log('ok', j.file);
      break;
    } catch (e) {
      console.log('fail', j.file, e.message);
      if (String(e.message).includes('402')) process.exit(1);
    }
  }
}
console.log('generated', n, 'of', jobs.length);
