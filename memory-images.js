/* Picks a first-person memory plate for a scene.

   Plates are generated per (location, era, variant) by tools/generate-pov.mjs and
   tools/generate-pov-variants.mjs and live in assets/memories/:
     <loc>-<era>.jpg      the base room
     <loc>-<era>-b.jpg    a different room in the same category

   Every plate is shot from inside the rememberer's eyes: no figure, no hands,
   no reflection. The player is the one standing in the room, so a life must
   never be shown as a person watched from outside.

   Variant selection is deterministic per life, so the same biography always
   returns the same rooms — but two people born in the same decade wake up in
   different beds. */
const MEMORY_IMAGE_LOCS = ['roddom', 'kitchen', 'yard', 'school', 'bedroom', 'platform', 'factory', 'office', 'hospital', 'sea', 'field', 'cemetery', 'stairwell', 'balcony', 'bus', 'empty'];

const MEMORY_PLATES = {
  kitchen: [1960, 1985, 2020],
  bedroom: [1955, 1990, 2020],
  stairwell: [1975, 2000],
  roddom: [1960, 1990],
  hospital: [1990, 2030],
  yard: [1975, 2005],
  school: [1970, 2000],
  platform: [1980, 2010],
  factory: [1985, 2020],
  office: [1995, 2025],
  field: [1970, 2020],
  cemetery: [2000, 2040],
  balcony: [1990, 2025],
  bus: [1980, 2010],
  sea: [1975, 2020],
  empty: [1990, 2035],
  'empty-after': [1985, 2020, 2040],
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

/* The shore plates are not generated yet, so a sea memory falls back to the
   nearest field at the same hour: cold grass instead of water, but the same
   emptiness and the same low horizon. */
function exists(name) {
  return typeof MEMORY_PLATE_FILES === 'undefined' || MEMORY_PLATE_FILES.has(name);
}

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
  const m = person?.memories?.[index] || {};
  const loc = MEMORY_IMAGE_LOCS.includes(m.loc) ? m.loc : 'empty';
  const birth = Number(person?.year) || 1950;
  const year = Number.isFinite(m.y) ? m.y : birth + 75;
  if (m.y === 'после' || m.age === 'none') return alternatePlate(loc, year, person, index);
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
