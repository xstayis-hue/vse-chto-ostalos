// Variant plates: a second and third room per (location, era), so two lives born
// in the same decade do not wake in the same bed.
// Usage: PLUSVIBE_KEY_FILE=... node tools/generate-pov-variants.mjs [--only kitchen-1985-b]
import fs from 'node:fs';

const key = fs.readFileSync(process.env.PLUSVIBE_KEY_FILE, 'utf8').split(/\r?\n/)[0].trim();
const API = 'https://plusvibeapi.ru/v1';
const MODEL = 'seedream-5-0-flash';
const SIZE = '1792x1024';

const base = [
  'First-person point of view: the camera IS the eyes of the person remembering.',
  'Nothing of the person is visible - no figure, no body, no hands, no face, no mirror.',
  'Authentic 35mm film photograph, shallow depth of field, natural available light,',
  'visible grain, desaturated restrained palette, quiet and empty.',
  'No people, no text, no letters, no signage, no watermark.',
].join(' ');

/* Each entry is a genuinely different room in the same category — different
   wall colour, different window, different furniture — not the same prompt twice. */
const plates = [
  ['kitchen', 1960, 'b', 'a shared communal kitchen: several cold stoves in a row, tiled dado, a queue of pots on a shelf, a bare bulb on a cord'],
  ['kitchen', 1985, 'b', 'an evening kitchen with a wall carpet, a tube radio on the shelf, a glass of tea and a saucer, a lace curtain drawn'],
  ['kitchen', 2020, 'b', 'a small modern kitchen at night: a kettle base, a phone charging, one mug, city light through the blind'],
  ['bedroom', 1955, 'b', 'a room with two iron beds, a painted chest, a hanging icon corner, an oil lamp on a chair'],
  ['bedroom', 1990, 'b', 'a teenage room: a poster corner, a cassette deck on the desk, a guitar case lying flat, the bed unmade'],
  ['bedroom', 2020, 'b', 'a quiet bedroom in the morning: an unmade bed, a book face down on the floor, a lamp still on'],
  ['stairwell', 1975, 'b', 'a stairwell landing from the railing: painted walls, a window between floors, chalk numbers, a bucket and a rag'],
  ['stairwell', 2000, 'b', 'a stairwell with mailboxes at eye height, a lift call button, a wall of peeling green paint, a bulb in a cage'],
  ['roddom', 1960, 'b', 'a maternity ward corridor: a row of cots behind a glass partition, a tiled wall, a floor polished to a shine'],
  ['roddom', 1990, 'b', 'a maternity room from very low: a cot rail close to the lens, a stool, the floor and the skirting'],
  ['hospital', 1990, 'b', 'a ward from the bed: a bedside table with a folded paper and a glass, the next bed empty, a window with gauze'],
  ['hospital', 2030, 'b', 'a modern ward from the bed: a monitor on a bracket, a plastic chair, a blind, cool clean light'],
  ['yard', 1975, 'b', 'a courtyard from a low bench: a wooden table, a washing line, a shed, poplar trunks, dust in a shaft of sun'],
  ['yard', 2005, 'b', 'a courtyard after rain: wet asphalt, a bench, a car under a cover, a childrens swing frame'],
  ['school', 1970, 'b', 'a classroom from a desk: an inkwell and a pen, a blackboard edge with chalk, tall windows, a tiled stove'],
  ['school', 2000, 'b', 'a classroom from a desk: exercise books stacked, a wall map, a plastic chair back, cold morning light'],
  ['platform', 1980, 'b', 'a platform from the edge: rails below, gravel, a station lamp, a bench and a bin, evening'],
  ['platform', 2010, 'b', 'a platform in the rain: wet asphalt, a new lamp post, an empty bench, the rails going away'],
  ['factory', 1985, 'b', 'a workshop bench close up: a vice, a file, metal shavings, a hanging lamp, tall dirty windows behind'],
  ['factory', 2020, 'b', 'an abandoned workshop: a machine under a cloth, a broken window, dust and dead leaves on the floor'],
  ['office', 1995, 'b', 'an office desk at eye height: a telephone with a dial, a blotter, carbon paper, a tulle curtain'],
  ['field', 1970, 'b', 'a field path at hand height: tall grass, a wooden fence, birches, the path worn into the soil'],
  ['field', 2020, 'b', 'an orchard in autumn: an apple tree trunk close, fallen fruit, a folding chair, low sun'],
  ['cemetery', 2000, 'b', 'a cemetery path: an iron fence at knee height, grey slabs, dry grass, birch trunks, flat light'],
  ['cemetery', 2040, 'b', 'a row of monuments, one recent, plastic flowers, wet gravel, a low grey sky'],
  ['balcony', 1990, 'b', 'a glazed balcony: jars on the floor, skis leaning, dusty glass, the courtyard far below'],
  ['balcony', 2025, 'b', 'a balcony in the evening: a stool, a mug on the sill, rooftops and wires beyond'],
  ['bus', 1980, 'b', 'inside an old bus: a seat back close, a chrome rail, a curtain on the window, morning'],
  ['bus', 2010, 'b', 'a bus window at eye height: wet glass, a ticket on the floor, trees passing'],
];

const want = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
fs.mkdirSync('assets/memories', { recursive: true });

async function bytesOf(item) {
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  const r = await fetch(item.url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

for (const [loc, year, tag, focus] of plates) {
  const id = `${loc}-${year}-${tag}`;
  if (want && id !== want) continue;
  const file = `assets/memories/${id}.jpg`;
  if (fs.existsSync(file)) { console.log('skip', id); continue; }
  const prompt = `${base} The scene: ${focus}. The year is ${year}, and the objects match it.`;
  let ok = false;
  for (let attempt = 0; attempt < 2 && !ok; attempt++) {
    const r = await fetch(`${API}/images/generations`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, n: 1, size: SIZE }),
      signal: AbortSignal.timeout(240000),
    });
    if (!r.ok) { console.log(id, 'HTTP', r.status, (await r.text()).slice(0, 120)); continue; }
    const j = await r.json();
    try {
      const bytes = await bytesOf(j.data?.[0]);
      fs.writeFileSync(file, bytes);
      console.log(id, bytes.length);
      ok = true;
    } catch (e) { console.log(id, 'ERR', e.message); }
  }
}
