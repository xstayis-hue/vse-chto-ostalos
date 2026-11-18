// First-person memory plates: one frame per (location, era).
// POV, no people, no hands, no text — the player is inside the room, not watching it.
// Usage: PLUSVIBE_KEY_FILE=... node tools/generate-pov.mjs [--only kitchen-1960]
import fs from 'node:fs';
import path from 'node:path';

const keyFile = process.env.PLUSVIBE_KEY_FILE;
if (!keyFile) throw new Error('Set PLUSVIBE_KEY_FILE');
const key = fs.readFileSync(keyFile, 'utf8').split(/\r?\n/)[0].trim();
const API = 'https://plusvibeapi.ru/v1';
const MODEL = 'seedream-5-0-flash';   // 1.86 ₽/image, best at photographic interiors
const SIZE = '1792x1024';

const base = [
  'First-person point of view: the camera IS the eyes of the person remembering.',
  'Nothing of the person is visible - no figure, no body, no hands, no face, no reflection of a person.',
  'Eye height for the age in the prompt, close to the surface the person is looking at.',
  'Authentic 35mm film photograph, shallow depth of field, natural available light, visible grain,',
  'desaturated restrained palette, quiet and empty, dust in the air.',
  'No people, no text, no letters, no signage, no watermark, not a wide establishing shot of an empty room.',
].join(' ');

const locs = {
  kitchen: 'a small Soviet-era kitchen: oilcloth on the table just below eye level, an enamel teapot, lace curtain, steamed window, gas stove with a kettle, worn linoleum',
  bedroom: 'a Soviet-era bedroom: a bed with a metal frame, a wardrobe with a mirror edge, floral wallpaper, a window with thick curtains, a rug or bare boards',
  stairwell: 'a concrete apartment stairwell: painted railing, landings, a lift door with scratched paint, weak bulb, chalk marks on the wall',
  roddom: 'a 20th-century maternity ward: a metal cot with starched linen, a tiled wall, a window with white gauze, a radiator, a bedside stool',
  hospital: 'a provincial hospital ward: an enamel bed frame, a tiled wall, a bedside table with a glass, a window with old blinds, a radiator',
  yard: 'a courtyard of a low apartment block: a wooden table, benches, a line with washing, a leaning shed, poplar trunks, cracked asphalt',
  school: 'a village school classroom: wooden desks with inkwells, a blackboard, a tiled stove or radiator, maps on the wall, tall windows',
  platform: 'a provincial railway platform: rails in the foreground, a station lamp, a bench, a timetable board, gravel and weeds between sleepers',
  factory: 'a factory workshop: a workbench with a vice, a lathe, hanging tools, tall dirty windows, a bucket, oil on the floor',
  office: 'a Soviet-era office: a desk with a blotter, a telephone, a filing cabinet, paper stacks, a window with a tulle curtain',
  sea: 'a cold northern shore: wet pebbles underfoot, grey water to the horizon, a rusted mooring ring, a wooden jetty edge',
  field: 'a Russian field at the edge of a village: tall grass, a fence, a birch line, a path worn into the soil',
  cemetery: 'a provincial cemetery: low iron fences, wooden crosses and grey stone slabs, dry grass, birch trunks',
  balcony: 'an enclosed Soviet balcony: glazed frames, jars and skis on the floor, a stool, the courtyard below through dusty glass',
  bus: 'the inside of an old intercity bus: worn seat backs, a chrome handrail, a window with a hanging curtain, a ticket on the floor',
  empty: 'the aftermath of a lived-in room: furniture taken out, rectangles of clean wallpaper where pictures hung, a bare bulb, dust in a shaft of light',
};

const eras = {
  1955: 'year 1955, post-war Soviet interior, almost no plastic, dull oil paint, bare bulbs, patchy plaster',
  1960: 'year 1960, early Soviet modern, oilcloth, plywood, aluminium spoons, radio on the wall, bare bulb',
  1970: 'year 1970, Soviet seventies, brown furniture, wallpaper with small patterns, lace, a tube radio',
  1975: 'year 1975, Soviet seventies, brown varnished wood, wallpaper with small patterns, lace curtains, a wall carpet',
  1980: 'year 1980, late Soviet, wall carpet, crystal glassware, a colour television in the corner, linoleum',
  1985: 'year 1985, late Soviet, wall carpet, crystal, formica, a colour television, worn linoleum',
  1990: 'year 1990, the last Soviet years, mixed furniture, a cassette player, peeling paint, a bare bulb',
  1995: 'year 1995, nineties Russia, cheap veneer furniture, a CRT television, a cordless phone, dust, faded wallpaper',
  2000: 'year 2000, early Russian nineties-to-noughties, plastic window frames appearing, a CRT set, cheap laminate',
  2005: 'year 2005, Russian noughties, plastic window, cheap laminate, a flat television, clutter of small objects',
  2010: 'year 2010, Russian 2010s, plastic windows, laminate, an LED lamp, a laptop cable, tidier surfaces',
  2020: 'year 2020, present-day Russia, plastic window, laminate, an LED lamp, a phone charger, restrained and worn',
  2025: 'year 2025, present-day Russia, plastic window, laminate, an LED lamp, a phone left face down, quiet',
  2030: 'year 2035, near future, cheap durable materials, a plastic window, an e-paper frame on the wall, worn but calm',
  2035: 'year 2035, near future, cheap durable materials, a plastic window, an e-paper frame on the wall, worn but calm',
  2040: 'year 2045, late in the century, few personal objects, older furniture kept out of habit, cool daylight',
};

const after = 'Left behind: the room after the person is gone. No people. The object from the prompt lies where it was last put.';

const plates = [
  ['kitchen', 1960, 'an enamel teapot and a slice of black bread on green oilcloth, a child looking up at the table edge'],
  ['kitchen', 1985, 'a chipped cup and a saucer on a wiped table, a kettle whistling off-frame, evening lamplight'],
  ['kitchen', 2020, 'a glass of tea, an open letter on the table, a phone face down, dusk through the curtain'],
  ['bedroom', 1955, 'a bed edge at knee height, a folded blanket, a photograph in a frame on the nightstand'],
  ['bedroom', 1990, 'a school satchel on the bed, a cassette player, a poster corner, afternoon light'],
  ['bedroom', 2020, 'an unmade bed at close range, a book face down, a lamp still on, the room held in dusk'],
  ['stairwell', 1975, 'the railing at waist height, a lift door, a bare bulb, one window between floors'],
  ['stairwell', 2000, 'a landing at eye height, mailboxes, a painted wall, the smell of cold concrete'],
  ['roddom', 1960, 'a metal cot with starched linen, a tiled wall, white gauze at the window, everything too large'],
  ['roddom', 1990, 'a hospital cot seen from very low, a stool leg, the floor, light on the wall tiles'],
  ['hospital', 1990, 'a bedside table with a glass of water and a folded paper, an enamel bed frame, quiet ward'],
  ['hospital', 2030, 'a bedside table with a photograph turned towards the bed, a plastic chair, cool modern light'],
  ['yard', 1975, 'a wooden table and bench at knee height, washing on a line, poplar trunks, dust in the sun'],
  ['yard', 2005, 'a courtyard bench, an asphalt yard, a car under a cover, wet ground after rain'],
  ['school', 1970, 'a wooden desk lid with an inkwell, a blackboard edge, chalk dust, tall windows'],
  ['school', 2000, 'a desk at eye height, exercise books, a map on the wall, cold morning light'],
  ['platform', 1980, 'rails and gravel in the near foreground, a station lamp, a bench, a timetable board'],
  ['platform', 2010, 'a platform edge at foot height, wet asphalt, a new lamp post, empty rails'],
  ['factory', 1985, 'a workbench with a vice and metal shavings, a hanging tool, tall dirty windows, oil on the floor'],
  ['factory', 2020, 'an emptied workshop, a machine under a cloth, a window with dead flies, quiet'],
  ['office', 1995, 'a desk with a blotter, a rotary telephone, paper stacks, a tulle curtain at the window'],
  ['office', 2025, 'a tidy desk, a laptop edge, a mug, a plastic window, overcast light'],
  ['sea', 1975, 'wet pebbles at foot height, grey water to the horizon, a rusted mooring ring, wind'],
  ['sea', 2020, 'a jetty edge at foot height, cold water, a folded blanket on the boards, overcast'],
  ['field', 1970, 'tall grass at hand height, a fence, a birch line, a path worn into the soil'],
  ['field', 2020, 'an orchard edge, an old apple tree trunk close, fallen fruit on the grass, low sun'],
  ['cemetery', 2000, 'a low iron fence at knee height, grey slabs, dry grass, birch trunks, cold light'],
  ['cemetery', 2040, 'a row of monuments, one recent, plastic flowers, wet gravel, flat grey sky'],
  ['balcony', 1990, 'glazed frames at eye height, jars and skis on the floor, the courtyard below through dusty glass'],
  ['balcony', 2025, 'a balcony window at eye height, a stool, a mug on the sill, rooftops beyond'],
  ['bus', 1980, 'worn seat backs, a chrome handrail, a window with a hanging curtain, morning light'],
  ['bus', 2010, 'a bus window at eye height, wet glass, a ticket on the floor, passing trees'],
  ['empty', 1990, 'an emptied room, rectangles of clean wallpaper where pictures hung, a bare bulb, dust'],
  ['empty', 2035, 'an emptied room, a bare floor, light from one window, a single nail in the wall'],
  ['empty-after', 1985, 'a kitchen table with one object left on it, chairs pushed in, no people, evening'],
  ['empty-after', 2020, 'a bedroom with the bed made for the last time, a photograph face up on the blanket, no people'],
  ['empty-after', 2040, 'a windowsill with a small kept object, dust, cold light, the room already belongs to someone else'],
];

const want = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
fs.mkdirSync('assets/memories', { recursive: true });

async function bytesOf(item) {
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  const r = await fetch(item.url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

for (const [loc, year, focus] of plates) {
  const id = `${loc}-${year}`;
  if (want && id !== want) continue;
  const file = `assets/memories/${id}.jpg`;
  if (fs.existsSync(file)) { console.log('skip', id); continue; }
  const isAfter = loc === 'empty-after';
  const scene = locs[isAfter ? 'empty' : loc];
  const prompt = `${base} The scene: ${scene}. ${eras[year] || ''}. In frame: ${focus}. ${isAfter ? after : ''}`;
  let ok = false;
  for (let attempt = 0; attempt < 2 && !ok; attempt++) {
    const r = await fetch(`${API}/images/generations`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, n: 1, size: SIZE }),
      signal: AbortSignal.timeout(240000),
    });
    if (!r.ok) { console.log(id, 'HTTP', r.status, (await r.text()).slice(0, 160)); continue; }
    const j = await r.json();
    try {
      const bytes = await bytesOf(j.data?.[0]);
      fs.writeFileSync(file, bytes);
      console.log(id, bytes.length);
      ok = true;
    } catch (e) { console.log(id, 'ERR', e.message); }
  }
}
