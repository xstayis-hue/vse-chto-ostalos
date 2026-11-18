import fs from 'node:fs';
const keyFile = process.env.PLUSVIBE_KEY_FILE;
if (!keyFile) throw new Error('Set PLUSVIBE_KEY_FILE');
const key = fs.readFileSync(keyFile, 'utf8').split(/\r?\n/)[0].trim();
const kind = process.argv[2] || 'background';
const prompts = {
  background: 'A restrained cinematic deep-space background for an intimate existential browser experience. Almost black sky, subtle blue-grey Milky Way dust, sparse stars with real depth, a very distant warm Earth-like glint, no spaceship, no astronaut, no text, no interface, no planets filling the frame, no colorful science fiction, no fantasy, photographic astrophotography, quiet, enormous scale, 16:9.',
  finale: 'A single quiet cinematic image about consciousness leaving Earth. Tiny blue Earth far below in deep black space, a thin atmospheric rim, one almost invisible warm human window-light, vast empty darkness, restrained blue-grey and tobacco palette, no astronaut, no spaceship, no text, no typography, no collage, no horror, authentic photographic astrophotography, 16:9.'
};
const file = kind === 'finale' ? 'assets/space-finale.jpg' : 'assets/space-art.jpg';
const r = await fetch('https://plusvibeapi.ru/v1/images/generations', {
  method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'seedream-5-0-flash', prompt: prompts[kind] || prompts.background, n: 1, size: '1536x864' }),
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
fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync(file, bytes);
console.log(JSON.stringify({ file, bytes: bytes.length, usage: result.usage || null }));
