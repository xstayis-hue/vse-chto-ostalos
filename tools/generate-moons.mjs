// Equirectangular surface maps for the major moons and an ambient space drone.
// Dev-only: PLUSVIBE_KEY_FILE=... node tools/generate-moons.mjs
import fs from 'node:fs';
const keyFile = process.env.PLUSVIBE_KEY_FILE;
if (!keyFile) throw new Error('Set PLUSVIBE_KEY_FILE');
const key = fs.readFileSync(keyFile, 'utf8').split(/\r?\n/)[0].trim();
const API = 'https://plusvibeapi.ru/v1';
const base = 'seamless equirectangular planetary surface texture map, 2:1 projection, full globe unwrapped, NASA spacecraft mosaic, photographic, orthographic albedo, flat even lighting, no shadows, no stars, no black background, no text, no border';
const moons = {
  io: 'Jupiter moon Io: sulfur yellow, orange and white plains, dark red-black volcanic calderas, lava flow spots, mottled',
  europa: 'Jupiter moon Europa: pale cream-white water ice crust crossed by long thin reddish-brown linear cracks (lineae), chaotic terrain patches',
  ganymede: 'Jupiter moon Ganymede: mixture of dark grey-brown ancient cratered regions and lighter grooved terrain bands, bright white young impact craters with rays',
  callisto: 'Jupiter moon Callisto: very dark brown-grey surface saturated with countless bright small craters, large multi-ring impact basin',
  titan: 'Saturn moon Titan seen through haze: smooth orange-tan surface, darker brown dune seas near equator, faint lighter highlands, soft blurry detail',
  triton: 'Neptune moon Triton: pinkish-white nitrogen frost southern cap, cantaloupe terrain, grey-green bluish dimpled plains, dark wind streaks',
};
async function getBytes(item) {
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  const r = await fetch(item.url, { signal: AbortSignal.timeout(90000) });
  if (!r.ok) throw new Error('download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
const only = process.argv.slice(2);
for (const [name, desc] of Object.entries(moons)) {
  if (only.length && !only.includes(name)) continue;
  const file = `assets/moons/${name}.jpg`;
  if (fs.existsSync(file)) { console.log('skip', file); continue; }
  const r = await fetch(`${API}/images/generations`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'flux-3-klein', prompt: `${desc}. ${base}`, n: 1, size: '1792x1024' }),
    signal: AbortSignal.timeout(180000),
  });
  if (!r.ok) { console.log(name, 'HTTP', r.status, (await r.text()).slice(0, 200)); continue; }
  const j = await r.json();
  fs.mkdirSync('assets/moons', { recursive: true });
  const bytes = await getBytes(j.data?.[0]);
  fs.writeFileSync(file, bytes);
  console.log(name, bytes.length);
}
