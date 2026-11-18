// One-shot quality test: same first-person prompt through the candidate models.
// Usage: PLUSVIBE_KEY_FILE=... node tools/_probe.mjs krea|seedream|klein
import fs from 'node:fs';
const key = fs.readFileSync(process.env.PLUSVIBE_KEY_FILE, 'utf8').split(/\r?\n/)[0].trim();
const model = { krea: 'krea-3', seedream: 'seedream-5-0-flash', klein: 'flux-3-klein' }[process.argv[2] || 'seedream'];
const prompt = 'First-person point of view from inside a Soviet-era communal kitchen, 1970s. Camera is the eyes of a six-year-old child standing at the table: the tabletop fills the lower third with an enamel teapot and a piece of black bread, a lampshade hangs close and warm at eye level, steam on the window, dark green oilcloth, worn linoleum in the lower edge of frame. No people, no human figure, no hands, no faces, no text. Overcast winter light through lace curtains. Restrained desaturated palette, authentic 35mm film photograph, shallow depth of field, grain, quiet and empty.';
const size = '1792x1024';
const r = await fetch('https://plusvibeapi.ru/v1/images/generations', {
  method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, prompt, n: 1, size }),
  signal: AbortSignal.timeout(240000),
});
if (!r.ok) { console.log(model, 'HTTP', r.status, (await r.text()).slice(0, 300)); process.exit(0); }
const j = await r.json();
const item = j.data?.[0];
let bytes;
if (item?.b64_json) bytes = Buffer.from(item.b64_json, 'base64');
else { const im = await fetch(item.url); bytes = Buffer.from(await im.arrayBuffer()); }
fs.writeFileSync(`assets/_probe-${process.argv[2] || 'seedream'}.jpg`, bytes);
console.log(model, bytes.length, JSON.stringify(j.usage || null));
