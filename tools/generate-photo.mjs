// One art-direction sample. No automatic retry or bulk generation.
import fs from 'node:fs';
const keyFile = process.env.PLUSVIBE_KEY_FILE;
if (!keyFile) throw new Error('Set PLUSVIBE_KEY_FILE');
const key = fs.readFileSync(keyFile, 'utf8').split(/\r?\n/)[0].trim();
const prompt = 'A still from an intimate 35mm arthouse film, remembering your own childhood from outside your body. A modest lived-in 1970s Soviet kitchen at dusk, viewed quietly from the dark hallway. Small wooden table with two cups, net curtains, a single practical warm lamp, cold blue grey window. A small child seen only from behind sitting at the table, mother softly out of focus near window, faces not visible. Nothing supernatural is visible. Deep existential melancholy, the uncanny familiarity of a place you can never return to. Authentic photographic realism, subtle film grain, natural imperfect materials, restrained desaturated olive and tobacco palette, rich shadow detail, beautiful understated cinematography. Wide shot 16:9, no text, no typography, no collage, no pixel art, no illustration, no game render, no horror monster.';
const r = await fetch('https://plusvibeapi.ru/v1/images/generations', {
  method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'seedream-5-0-flash', prompt, n: 1, size: '1536x864' }),
  signal: AbortSignal.timeout(180000),
});
if (!r.ok) throw new Error(`Generation HTTP ${r.status}`);
const result = await r.json();
const item = result.data?.[0];
let bytes;
if (item?.b64_json) bytes = Buffer.from(item.b64_json, 'base64');
else {
  if (!item?.url?.startsWith('https://')) throw new Error('Missing image URL');
  const image = await fetch(item.url, { signal: AbortSignal.timeout(60000) });
  if (!image.ok || !image.headers.get('content-type')?.startsWith('image/')) throw new Error('Invalid image response');
  bytes = Buffer.from(await image.arrayBuffer());
}
fs.mkdirSync('assets/photographic', { recursive: true });
fs.writeFileSync('assets/photographic/kitchen.jpg', bytes);
console.log(JSON.stringify({ file: 'assets/photographic/kitchen.jpg', bytes: bytes.length, usage: result.usage || null }));
