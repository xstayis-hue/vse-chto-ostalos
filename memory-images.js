/* Picks a generated memory background for a scene.
   Files: assets/memories/<loc>-<day|night|figure>.jpg (see tools/gen-memories.mjs). */
const MEMORY_IMAGE_LOCS = ['roddom', 'kitchen', 'yard', 'school', 'bedroom', 'platform', 'factory', 'office', 'hospital', 'sea', 'field', 'cemetery', 'stairwell', 'balcony', 'bus', 'empty'];
const MEMORY_IMAGE_FIGURE = new Set(['kitchen', 'yard', 'platform', 'hospital', 'sea', 'field', 'stairwell', 'bus', 'bedroom', 'balcony', 'cemetery', 'school']);
const MEMORY_FALLBACK_LOC = ['roddom', 'kitchen', 'platform', 'bedroom', 'sea', 'empty'];

function memoryImageUrl(person, index) {
  const m = person?.memories?.[index] || {};
  let loc = MEMORY_IMAGE_LOCS.includes(m.loc) ? m.loc : MEMORY_FALLBACK_LOC[index] || 'empty';
  const seed = Math.abs(Math.sin((person?.id || 1) * 12.9898 + index * 78.233));
  let variant = m.time === 'night' ? 'night' : 'day';
  // The lonely figure seen from behind: you watching yourself from outside.
  if (MEMORY_IMAGE_FIGURE.has(loc) && m.age && m.age !== 'baby' && m.age !== 'none' && seed > 0.45) variant = 'figure';
  return `assets/memories/${loc}-${variant}.jpg`;
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
