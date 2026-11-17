import fs from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';

// Separate budget from earlier batches. Reserve the maximum before submitting;
// never automatically retry a POST whose outcome is unknown.
const ledgerPath = 'assets/photographic/variety-ledger.json';
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : [];
const key = fs.readFileSync(process.env.PLUSVIBE_KEY_FILE, 'utf8').split(/\r?\n/)[0].trim();
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const jobs = [
  ['hospital-sunlit-plate', 'A small clean provincial hospital room in 1985, sunlight through an open window on the left, a single neatly made bed against the right wall, pale cream walls, a wooden bedside cabinet. Wide unobstructed floor in the centre. No people.'],
  ['f-adult-summer-actor', 'One 38 year old woman, full body seen directly from behind, plain faded blue cotton summer dress, low brown shoes, dark braided hair. Standing naturally, both arms resting at her sides. Head and both shoes fully visible. Isolated on flat pure bright green #00ff00 background, no floor, no shadows, no objects. No green clothing.'],
  ...[
    ['kitchen-warm', 'A lived-in 1960s small family kitchen, honey coloured wooden table at left, enamel kettle, white curtains, warm late afternoon sunlight, open clear floor at centre.'],
    ['bedroom-family', 'A modest 1970s family bedroom, floral wallpaper, neatly made wooden bed at left, wardrobe at right, soft daylight, clear central floor.'],
    ['yard-summer', 'A sunny 1970s residential courtyard in a small Eastern European town, laundry far to the left, birch trees, benches, wide clear central footpath, ordinary peaceful summer.'],
    ['school-village', 'A small rural 1950s classroom, wooden desks in rows on either side of a clear central aisle, blackboard on back wall, daylight through left windows, no writing.'],
    ['platform-autumn', 'A provincial railway platform in 1980, railway tracks to right, yellow autumn trees to left, distant station building, open central pavement, overcast daylight, no train in foreground.'],
    ['sea-harbour', 'A working northern harbour in 1970, fishing boats far in background, low warehouses, ropes neatly coiled at far left, wide open central concrete quay, grey daylight.'],
    ['factory-workshop', 'A well maintained 1970s metalworking workshop, lathes along both walls, wide clear central aisle, high windows, soft daylight, no people.'],
    ['empty-livedin', 'A quiet recently vacated ordinary apartment, intact faded wallpaper, a small wooden chair against left wall, afternoon window at right, clean empty central floor, not a ruin.'],
    ['field-orchard', 'A small village apple orchard in late spring, white blossoms, low wooden fence in distance, clear central grass path, soft cloudy daylight.'],
    ['office-clinic', 'A modest rural doctors office in 1975, examination couch at left, wooden desk with closed folders against right wall, clear central floor, soft daylight, no writing.'],
  ].map(([name, detail]) => [`${name}-plate`, `${detail} Absolutely no people or human silhouettes. Eye level camera at 1.6 metres, 35mm lens, physically correct perspective. Foreground floor visible. Furniture at the sides, unobstructed standing space in middle.`]),
  ...[
    ['m-adult-worker', 'a 40 year old man, short dark hair, faded blue work jacket and navy trousers, work shoes'],
    ['m-old-cardigan', 'a 73 year old man, short grey hair, brown knitted cardigan, charcoal trousers, ordinary shoes'],
    ['f-old-cardigan', 'a 72 year old woman, grey hair in a bun, beige cardigan, dark calf length skirt, low shoes'],
    ['f-teen-summer', 'a 17 year old young woman, dark braid, plain cream blouse, navy knee length skirt, flat shoes'],
    ['m-teen-shirt', 'a 17 year old young man, short brown hair, plain light cotton shirt, dark trousers, simple shoes'],
    ['f-child-summer', 'an 8 year old girl, two brown braids, plain muted red cotton dress, ankle socks and shoes'],
    ['m-child-summer', 'an 8 year old boy, short brown hair, cream cotton shirt, brown shorts, socks and shoes'],
  ].map(([name, detail]) => [`${name}-actor`, `One person only, ${detail}. Authentic mid twentieth century everyday clothes. Full body directly from behind, natural anatomy and relaxed arms, head and both shoes entirely visible, centred. Face invisible. Isolated against perfectly solid pure vivid green #00ff00, no texture or grain on background, no shadow, no objects, no green clothing.`]),
];
const limit = Number(process.env.GENERATION_LIMIT || 2);
for (const [name, subject] of jobs.slice(0, limit)) {
  const file = `assets/photographic/${name}.jpg`;
  if (fs.existsSync(file)) continue;
  let entry = ledger.find(e => e.name === name);
  if (entry && !entry.jobId) throw Error('Uncertain submission: reconcile manually before spending again');
  if (!entry) {
    const reserved = ledger.reduce((sum, e) => sum + (e.priceRub ?? e.maximumRub), 0);
    if (reserved + 3 > 60) throw Error('60 RUB budget ceiling reached');
    entry = { name, maximumRub: 3, status: 'submitting' };
    ledger.push(entry); fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
    const response = await fetch('https://plusvibeapi.ru/api/media/generate', {
      method: 'POST', headers, signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ model: 'seedream-5-0-flash', max_price_rub: 3,
        prompt: `${subject} Photorealistic analog 35mm film still, natural human proportions and physically plausible construction, restrained natural colours, soft daylight, believable ordinary Eastern European everyday life. No illustration, no 3D render, no collage, no text, no watermark.`,
        opts: { aspect_ratio: name.endsWith('actor') ? '2:3' : '16:9', resolution: '2K', output_format: 'jpeg' } })
    });
    if (!response.ok) throw Error(`Submission HTTP ${response.status}; no automatic retry`);
    const job = await response.json();
    if (!job.jobId) throw Error('Missing job ID; reconcile manually');
    entry.jobId = job.jobId; entry.status = 'processing';
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  }
  let result;
  for (let n = 0; n < 100; n++) {
    await wait(3000);
    const response = await fetch(`https://plusvibeapi.ru/api/media/jobs/${entry.jobId}`, { headers, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error(`Status HTTP ${response.status}`);
    result = await response.json();
    if (result.status === 'success') break;
    if (['fail', 'failed', 'cancelled'].includes(result.status)) throw Error(`Failed job: ${name}`);
  }
  if (result?.status !== 'success') throw Error('Job pending; rerun resumes this job without repurchase');
  const response = await fetch(result.resultUrls[0], { signal: AbortSignal.timeout(60000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw Error('Invalid image download');
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  entry.status = 'downloaded-awaiting-review'; entry.priceRub = result.priceRub ?? null;
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  console.log(JSON.stringify({ name, priceRub: entry.priceRub, file }));
}
