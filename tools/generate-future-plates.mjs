// Generate reviewed near-future memory plates. Usage:
// node tools/generate-future-plates.mjs
import fs from 'node:fs';

const keyFile = process.env.PLUSVIBE_KEY_FILE;
if (!keyFile) throw new Error('Set PLUSVIBE_KEY_FILE');
const key = fs.readFileSync(keyFile, 'utf8').split(/\r?\n/)[0].trim();
const API = 'https://plusvibeapi.ru/v1';
const MODEL = 'seedream-5-0-flash';
const SIZE = '1792x1024';
const base = [
  'First-person point of view: the camera IS the eyes of the person remembering.',
  'No person, no body, no hands, no face, no reflection, no silhouette, no people anywhere.',
  'Authentic 35mm film photograph, restrained near-future realism, natural available light, visible grain.',
  'A modest lived-in place in Russia in the year 2035, not luxury, not science fiction, not cyberpunk.',
  'Repairable ordinary materials, quiet practical technology, believable objects, melancholic and empty.',
  'No text, no letters, no logos, no signage, no watermark, no illustration, no game render.',
].join(' ');
const plates = [
  ['kitchen', 'a small apartment kitchen: matte recycled panels, a quiet induction surface, an e-paper family calendar with no readable text, a charging shelf, one ceramic cup, rain beyond a smart window'],
  ['bedroom', 'a modest bedroom: repaired wooden bed, soft adaptive wall light, a thin e-paper reader face down, woven blanket, city glow through electrochromic glass'],
  ['office', 'a small home workroom: repairable desk, compact projector dock, tactile keyboard, paper notebook, modular wall storage, overcast city beyond the window'],
  ['hospital', 'a quiet public hospital room: simple bed, discreet medical monitor, translucent privacy panel, reusable equipment, cool daylight, no readable screens'],
  ['balcony', 'a narrow apartment balcony: vertical herb trays, recycled composite floor, quiet air filter, folded chair, dense future city rooftops and older buildings beyond'],
  ['sea', 'a cold northern shore: wet pebbles, a low autonomous weather buoy far offshore, repaired wooden jetty, practical thermal blanket, grey water and low sky'],
  ['field', 'an orchard edge near a village: old apple tree, small soil sensor stake with no text, solar irrigation line, folding chair, tall grass and a distant wind turbine'],
  ['empty-after', 'an emptied apartment after the person is gone: smooth repairable wall, one object on a windowsill, quiet air sensor, cold light, room already belonging to someone else'],
];

async function bytesOf(item) {
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  const r = await fetch(item.url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

fs.mkdirSync('assets/memories', { recursive: true });
for (const [loc, focus] of plates) {
  const id = `${loc}-2035`;
  const file = `assets/memories/${id}.jpg`;
  const prompt = `${base} The scene: ${focus}. The year is 2035. Everything is plausible and understated.`;
  let ok = false;
  for (let attempt = 0; attempt < 2 && !ok; attempt++) {
    const r = await fetch(`${API}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, n: 1, size: SIZE }),
      signal: AbortSignal.timeout(240000),
    });
    if (!r.ok) { console.log(id, 'HTTP', r.status); continue; }
    const item = (await r.json()).data?.[0];
    try { fs.writeFileSync(file, await bytesOf(item)); console.log('saved', file); ok = true; }
    catch (e) { console.log(id, 'ERR', e.message); }
  }
  if (!ok) throw new Error(`Failed to generate ${id}`);
}
