import fs from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';
const key = fs.readFileSync(process.env.PLUSVIBE_KEY_FILE, 'utf8').split(/\r?\n/)[0].trim();
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
let places = {
  roddom: 'a maternity ward, a small metal cot with a swaddled newborn, an iron bed, linen, pale morning light',
  kitchen: 'a modest small kitchen, oilcloth table with two cups, net curtains, enamel kettle, muted dusk window',
  yard: 'a courtyard between five storey apartment blocks, an empty rusty swing, bare birches, late afternoon',
  school: 'an empty school classroom, wooden desks, dusty blackboard, soft light through tall windows',
  bedroom: 'a modest bedroom, narrow bed, old wardrobe, faded wallpaper, a bedside lamp, dusk',
  platform: 'a provincial railway platform, old dark green train, concrete canopy, mist and wet pavement',
  factory: 'an old factory hall, machinery, shafts of dim light through high dusty windows, end of shift',
  office: 'a modest office, wood desk, rotary phone, paper folders, dull winter daylight',
  hospital: 'a quiet hospital room, empty iron bed, bedside chair, grey window, unmade linen, rain outside',
  sea: 'a northern shore, grey water, weathered wooden pier, low overcast sky, small waves',
  field: 'a field of dry grass, a lone birch, distant electricity poles, overcast late autumn afternoon',
  cemetery: 'a small village cemetery among birches, low iron fences, weathered gravestones, mist, no readable inscriptions',
  stairwell: 'a real apartment stairwell, concrete stairs leading up around the landing, metal railing, green walls, mailboxes, weak window light',
  balcony: 'a modest apartment balcony overlooking a grey city, jars, hanging cloth, metal railing, cloudy dusk',
  bus: 'a lonely bus shelter beside a suburban road, wet asphalt, a distant row of apartments, grey evening',
  empty: 'an abandoned apartment room, furniture under thin white sheets, faded wallpaper, cold morning window, dust'
};
const actors = process.argv.includes('--actors');
if (actors) places = Object.fromEntries(['m', 'f'].flatMap(gender => ['child', 'teen', 'adult', 'old'].map(age => [`${gender}-${age}`, `${gender === 'm' ? 'male' : 'female'}, ${ {child:'8 years old',teen:'17 years old',adult:'40 years old',old:'75 years old'}[age] }`])));
const ledgerPath = actors ? 'assets/photographic/actors-ledger.json' : 'assets/photographic/ledger.json';
let ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : [];
for (const [loc, detail] of Object.entries(places)) {
  const file = `assets/photographic/${loc}-${actors ? 'actor' : 'plate'}.jpg`;
  if (fs.existsSync(file)) continue;
  const existing = ledger.find(entry => entry.loc === loc);
  if (!existing && ledger.length >= (actors ? 8 : 16)) throw Error('Batch request limit reached');
  const body = { model: 'seedream-5-0-flash', max_price_rub: 4,
    prompt: actors ? `One full body photographic person, ${detail}, standing still with their BACK directly facing the camera, head to shoes entirely visible, centered, occupies 85 percent image height. Simple authentic 1970s Eastern European everyday clothes, muted grey brown wool coat or cardigan, dark trousers, plain shoes. Natural human anatomy, restrained soft side lighting, subdued photographic realism, 35mm film quality. Face completely invisible. Isolated against perfectly solid pure bright green chroma key background #00ff00, no floor, no cast shadow, no other objects, no green on the person, no text, no collage. A photographic cutout asset, not a cartoon or 3D render.` : `Photographic environment plate for an intimate 35mm arthouse film about remembering your own life. ${detail}. Mid to late 20th century Eastern Europe, authentic lived-in details, naturally aged materials. Absolutely no people, no silhouettes, no faces. Eye level 1.6 metres, 35mm lens, foreground floor clearly visible in lower half, vanishing point at centre height. Composition with quiet open space in the middle for later compositing a small person. Natural dim light, restrained desaturated olive grey and tobacco palette, subtle film grain, deep but readable shadows. Understated existential melancholy. Real photograph, not illustration, not pixel art, not a video game. No text or collage.`,
    opts: { aspect_ratio: actors ? '2:3' : '16:9', resolution: '2K', output_format: 'jpeg' } };
  let entry = existing;
  if (!entry) {
    const r = await fetch('https://plusvibeapi.ru/api/media/generate', { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw Error(`Create ${loc}: HTTP ${r.status}`);
    const job = await r.json();
    if (!job.jobId) throw Error('Missing job ID');
    entry = { loc, jobId: job.jobId, maximumRub: 4, status: 'processing' }; ledger.push(entry);
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  }
  let result;
  for (let n = 0; n < 80; n++) {
    await wait(3000);
    const response = await fetch(`https://plusvibeapi.ru/api/media/jobs/${entry.jobId}`, { headers, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`Job ${loc}: HTTP ${response.status}`);
    result = await response.json();
    if (result.status === 'success') break;
    if (['fail', 'failed', 'cancelled'].includes(result.status)) throw Error(`Generation failed: ${loc}`);
  }
  if (result?.status !== 'success') throw Error(`Pending job ${entry.jobId}; reconcile before retry`);
  const image = await fetch(result.resultUrls[0], { signal: AbortSignal.timeout(60000) });
  if (!image.ok || !image.headers.get('content-type')?.startsWith('image/')) throw Error('Invalid image download');
  fs.writeFileSync(file, Buffer.from(await image.arrayBuffer()));
  entry.status = 'success'; entry.priceRub = result.priceRub ?? null;
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  console.log(loc, entry.priceRub, file);
}
