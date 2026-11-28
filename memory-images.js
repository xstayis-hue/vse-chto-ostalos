/* Picks a first-person memory plate for a scene.

   Plates are generated per (location, era, variant) by tools/generate-pov.mjs and
   tools/generate-pov-variants.mjs and live in assets/memories/:
     <loc>-<era>.jpg      the base room
     <loc>-<era>-b.jpg    a different room in the same category

   Every plate is shot from inside the rememberer's eyes: no figure, no hands,
   no reflection. The player is the one standing in the room, so a life must
   never be shown as a person watched from outside.

   Selection is deterministic per life, so the same biography always returns the
   same rooms — but two people born in the same decade wake up in different beds.

   Seventy-two scenes are assigned together rather than one at a time. Picking
   each scene in isolation sent eleven of them to the same bedroom: every 2040s
   bedroom is nearest to bedroom-2035.jpg, so that file won. The whole table is
   built once, oldest scene first per location, and each scene takes the plate
   that is closest in time *and* least used so far. A living scene never leaves
   its era window; the final "after" frame may, because it is the room seen from
   nobody's eyes, years later. */
const MEMORY_IMAGE_LOCS = ['roddom', 'kitchen', 'yard', 'school', 'bedroom', 'platform', 'factory', 'office', 'hospital', 'sea', 'field', 'cemetery', 'stairwell', 'balcony', 'bus', 'empty'];

const MEMORY_PLATES = {
  kitchen: [1960, 1985, 2020, 2035],
  bedroom: [1955, 1990, 2020, 2035],
  stairwell: [1975, 2000],
  roddom: [1960, 1990],
  hospital: [1990, 2030, 2035],
  yard: [1975, 2005],
  school: [1970, 2000],
  platform: [1980, 2010],
  factory: [1985, 2020],
  office: [1995, 2025, 2035],
  field: [1970, 2020, 2035],
  cemetery: [2000, 2040],
  balcony: [1990, 2025, 2035],
  bus: [1980, 2010],
  sea: [1975, 2020, 2035],
  empty: [1990, 2035],
  'empty-after': [1985, 2020, 2035],
};

/* Rooms that were never generated fall back to a similar room in the same hour. */
const MEMORY_ROOM_FALLBACK = {
  roddom: 'bedroom', hospital: 'bedroom', factory: 'kitchen', office: 'bedroom',
  school: 'bedroom', bus: 'platform', balcony: 'bedroom', cemetery: 'field',
  stairwell: 'bedroom', yard: 'field', empty: 'bedroom', platform: 'field',
};

/* A small deterministic hash: same life, same room, every session. */
function plateHash(person, index, salt) {
  const s = `${person?.id || 0}:${index}:${salt}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

function nearestEra(loc, year) {
  const eras = MEMORY_PLATES[loc];
  if (!eras) return null;
  let best = eras[0], bestGap = Infinity;
  for (const era of eras) {
    const gap = Math.abs(era - year);
    if (gap < bestGap) { bestGap = gap; best = era; }
  }
  return best;
}

function exists(name) {
  return typeof MEMORY_PLATE_FILES === 'undefined' || MEMORY_PLATE_FILES.has(name);
}

/* Every usable plate of a location: <loc>-<era>.jpg and <loc>-<era>-b.jpg. The
   other files in the folder (day, night, figure) are not rooms a life can wake
   up in, so they are never candidates. */
const platePools = new Map();
function platePool(loc, depth = 0) {
  if (platePools.has(loc)) return platePools.get(loc);
  const pool = [];
  if (typeof MEMORY_PLATE_FILES !== 'undefined') {
    const prefix = `${loc}-`;
    for (const name of MEMORY_PLATE_FILES) {
      if (!name.startsWith(prefix) || !name.endsWith('.jpg')) continue;
      const match = name.slice(prefix.length).match(/^(\d{4})(-b)?\.jpg$/);
      if (match) pool.push({ name, era: Number(match[1]), variant: Boolean(match[2]) });
    }
    pool.sort((a, b) => a.era - b.era || (a.variant ? 1 : 0) - (b.variant ? 1 : 0));
  }
  if (!pool.length && depth < 2) {
    const room = MEMORY_ROOM_FALLBACK[loc] || 'bedroom';
    const fallback = platePool(room, depth + 1);
    platePools.set(loc, fallback);
    return fallback;
  }
  platePools.set(loc, pool);
  return pool;
}

/* A living scene stays within this many years of its plate. Beyond it the
   furniture and the era stop matching the sentence that describes them. */
const LIVING_ERA_WINDOW = 50;
/* The "after" frame is the same room years later, so it may carry the larger gap. */
const AFTER_ERA_WINDOW = 120;
/* Usage is weighted above a few years of era drift: the goal is that no plate
   carries a life it does not belong to *and* that 72 scenes do not collapse to
   a handful of files. */
const USAGE_WEIGHT = 22;

function sceneLocation(memory) {
  return MEMORY_IMAGE_LOCS.includes(memory?.loc) ? memory.loc : 'empty';
}

function sceneYear(person, memory) {
  if (Number.isFinite(memory?.y)) return memory.y;
  return (Number(person?.year) || 1950) + 75;
}

function sceneIsAfter(memory) {
  return memory?.y === 'после' || memory?.age === 'none';
}

function sceneKey(person, index) {
  return `${person?.id ?? 'x'}:${index}`;
}

/* The whole 72-slot table, built once. Lives are known to memory-images.js
   because content.js loads first; anything outside the catalogue still resolves
   through the single-scene fallback below. */
let plateAssignments = null;
function buildPlateAssignments() {
  const lives = Array.isArray(window.CURATED_LIVES) ? window.CURATED_LIVES : [];
  const rows = [];
  for (const life of lives) (life.memories || []).forEach((memory, index) => {
    rows.push({
      key: sceneKey(life, index), lifeId: life.id, loc: sceneLocation(memory),
      year: sceneYear(life, memory), after: sceneIsAfter(memory),
    });
  });
  /* Plates are handed out most-constrained scene first. A 2073 bedroom has a
     single plate inside its window, while a 2009 bedroom has five; assigning the
     2009 scene first let it take the only file the 2073 scene could use, and the
     later frame then had to repeat a room. Within a location, the scene with the
     fewest candidates chooses first, and the "after" frame chooses last. */
  for (const row of rows) {
    const pool = platePool(row.loc);
    const window = row.after ? AFTER_ERA_WINDOW : LIVING_ERA_WINDOW;
    row.candidates = pool.filter((plate) => Math.abs(plate.era - row.year) <= window).length;
  }
  rows.sort((a, b) => a.loc.localeCompare(b.loc)
    || a.candidates - b.candidates
    || (a.after ? 1 : 0) - (b.after ? 1 : 0)
    || a.year - b.year
    || String(a.key).localeCompare(String(b.key)));

  const usage = new Map();
  const lifePlates = new Map();
  const table = new Map();
  for (const row of rows) {
    const pool = platePool(row.loc);
    if (!pool.length) continue;
    const usedHere = lifePlates.get(row.lifeId) || new Set();
    const window = row.after ? AFTER_ERA_WINDOW : LIVING_ERA_WINDOW;
    /* Two passes: first a plate this life has not used yet, then — only if the
       window leaves nothing — the best remaining one. One room should not serve
       two different scenes of the same biography. */
    let best = null, bestScore = Infinity;
    for (const strict of [true, false]) {
      for (const plate of pool) {
        if (strict && usedHere.has(plate.name)) continue;
        const gap = Math.abs(plate.era - row.year);
        if (gap > window) continue;
        let score = gap + (usage.get(plate.name) || 0) * USAGE_WEIGHT;
        if (row.after && !plate.variant) score += 12;      // the room changed while nobody looked
        if (score < bestScore) { bestScore = score; best = plate; }
      }
      if (best) break;
    }
    if (!best) {
      // Nothing inside the window (a 2076 scene with a 2035 plate): the nearest
      // plate is still the honest answer, and it is counted like any other use.
      best = pool.reduce((acc, plate) => (
        Math.abs(plate.era - row.year) < Math.abs(acc.era - row.year) ? plate : acc
      ), pool[0]);
    }
    usage.set(best.name, (usage.get(best.name) || 0) + 1);
    usedHere.add(best.name);
    lifePlates.set(row.lifeId, usedHere);
    table.set(row.key, `assets/memories/${best.name}`);
  }
  return table;
}

function assignments() {
  if (!plateAssignments) plateAssignments = buildPlateAssignments();
  return plateAssignments;
}

/* One life, one scene, no table (a generated life, or a scene added after load). */
function nearestPlate(loc, year, person, index) {
  const era = nearestEra(loc, year);
  if (era == null) {
    const room = MEMORY_ROOM_FALLBACK[loc] || 'bedroom';
    return nearestPlate(room, year, person, index);
  }
  const wantsB = plateHash(person, index, loc) > 0.5;
  const pick = (suffix) => `${loc}-${era}${suffix}.jpg`;
  if (wantsB && exists(pick('-b'))) return `assets/memories/${pick('-b')}`;
  if (exists(pick(''))) return `assets/memories/${pick('')}`;
  if (exists(pick('-b'))) return `assets/memories/${pick('-b')}`;
  const room = MEMORY_ROOM_FALLBACK[loc] || 'bedroom';
  return nearestPlate(room, year, person, index);
}

/* The last scene: the same room, one variant later, so the furniture changed
   while nobody was looking. */
function alternatePlate(loc, year, person, index) {
  const era = nearestEra(loc, year);
  if (era == null) return nearestPlate(loc, year, person, index);
  const base = `${loc}-${era}.jpg`;
  const other = `${loc}-${era}-b.jpg`;
  if (exists(other) && exists(base)) return `assets/memories/${other}`;
  if (exists(base)) return `assets/memories/${base}`;
  return nearestPlate(loc, year, person, index);
}

function memoryImageUrl(person, index) {
  const assigned = assignments().get(sceneKey(person, index));
  if (assigned) return assigned;
  const m = person?.memories?.[index] || {};
  const loc = sceneLocation(m);
  const year = sceneYear(person, m);
  if (sceneIsAfter(m)) return alternatePlate(loc, year, person, index);
  return nearestPlate(loc, year, person, index);
}

const memoryImageCache = new Map();
function loadMemoryImage(url) {
  if (!memoryImageCache.has(url)) {
    let p;
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { p.__img = img; resolve(img); };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    memoryImageCache.set(url, p);
  }
  return memoryImageCache.get(url);
}

// Start decoding the next frame while the current caption is being read.
function preloadMemoryImage(person, index) {
  if (!person?.memories?.[index]) return;
  loadMemoryImage(memoryImageUrl(person, index));
}
