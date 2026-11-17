/* A local scene compiler, not an image API. One life seed owns appearance and
   domestic materials; each memory owns architecture, blocking, light and camera.
   Descriptor generation is pure and tested independently of WebGL. */
(function (root) {
  'use strict';
  const LOCATIONS = ['roddom', 'kitchen', 'yard', 'school', 'bedroom', 'platform', 'factory', 'office', 'hospital', 'sea', 'field', 'cemetery', 'stairwell', 'balcony', 'bus', 'empty'];
  const OUTDOORS = new Set(['yard', 'platform', 'sea', 'field', 'cemetery', 'balcony', 'bus']);
  function hash(value) {
    let n = 2166136261;
    for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return n >>> 0;
  }
  function random(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function describe(person, index) {
    const memory = person.memories[index];
    const seed = hash(`life:${person.id}`), rnd = random(seed);
    const sceneSeed = hash(`${person.id}:${index}:${memory.loc}:${memory.prop}`), scene = random(sceneSeed);
    const loc = LOCATIONS.includes(memory.loc) ? memory.loc : 'empty';
    const birth = Number(person.year) || 1950;
    const year = Number.isFinite(memory.y) ? memory.y : birth + 75;
    const age = Math.max(0, year - birth);
    return {
      version: 1, seed, sceneSeed, id: `${person.id}:${index}`, index, loc, year,
      age: memory.age === 'none' ? 'none' : (age < 1 ? 'baby' : age < 13 ? 'child' : age < 20 ? 'teen' : age < 60 ? 'adult' : 'old'),
      time: memory.time || 'dusk', others: memory.others || 0, gender: person.gender,
      prop: String(memory.prop || person.symbol || ''), symbol: String(person.symbol || ''),
      outdoor: OUTDOORS.has(loc),
      identity: { coat: ['#434c42', '#605345', '#4d5058', '#675649', '#414e51'][Math.floor(rnd() * 5)], hair: ['#24201c', '#44382b', '#655846'][Math.floor(rnd() * 3)], stature: .9 + rnd() * .18 },
      home: { wall: ['#797d65', '#8d806a', '#74817c', '#8a8678', '#77757a'][Math.floor(rnd() * 5)], wood: ['#544132', '#6b5135', '#584a3e'][Math.floor(rnd() * 3)], window: rnd() > .5 ? -1 : 1 },
      room: { width: 5.4 + scene() * 2.8, depth: 5.8 + scene() * 2.4, height: 2.8 + scene() * .6 },
      camera: { x: (scene() - .5) * 2.8, y: 1.45 + scene() * .4, z: 4.1 + scene() * .7, targetX: (scene() - .5) * .7 },
      blocking: { x: (scene() - .5) * 2.2, z: -.2 - scene() * 1.4, turn: (scene() - .5) * .5 },
      weather: scene() < .35 ? 'rain' : 'haze', variation: scene(),
    };
  }
  // Head-to-sole height and contact point in the fixed photographic plates.
  // Keep people in clear floor space, not through beds, desks or railings.
  const PLATE_LAYOUTS = {
    hospital: { x: .65, feet: .94, height: .82 },
    kitchen: { x: .52, feet: .95, height: .86 },
    bedroom: { x: .57, feet: .94, height: .82 },
    roddom: { x: .57, feet: .94, height: .82 },
    school: { x: .52, feet: .93, height: .78 },
    office: { x: .52, feet: .94, height: .80 },
    stairwell: { x: .50, feet: .95, height: .84 },
    bus: { x: .50, feet: .95, height: .84 },
    balcony: { x: .50, feet: .95, height: .83 },
  };
  const plateLayout = loc => ({ ...(PLATE_LAYOUTS[loc] || { x: .5, feet: .91, height: .72 }) });
  const api = { describe, hash, random, LOCATIONS, plateLayout };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MemoryWorld = api;
})(typeof window === 'undefined' ? globalThis : window);

if (typeof window !== 'undefined') {
  Object.assign(window.MemoryWorld, (() => {
    const cache = new Map();
    let renderer = null, failed = false, queue = Promise.resolve();
    const W = 1280, H = 800;
    addEventListener('pagehide', () => { if (renderer) { renderer.dispose(); renderer.forceContextLoss(); renderer = null; } });

    function makeScene(d, photographic = false) {
      const T = window.THREE;
      const rnd = MemoryWorld.random(d.sceneSeed);
      const scene = new T.Scene();
      const night = d.time === 'night';
      scene.background = photographic ? null : new T.Color(night ? '#10191e' : '#8b9592');
      if (!photographic) scene.fog = new T.Fog(scene.background, d.outdoor ? 12 : 16, d.outdoor ? 65 : 34);
      const resources = new Set();
      const own = r => { resources.add(r); return r; };
      const mat = (color, roughness = .92) => own(new T.MeshStandardMaterial({ color, roughness, metalness: 0 }));
      function texture(base, type) {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 9000; i++) {
          const v = rnd(); x.fillStyle = v > .5 ? `rgba(230,220,195,${rnd() * .12})` : `rgba(12,10,8,${rnd() * .16})`;
          x.fillRect(rnd() * 256, rnd() * 256, type === 'wood' ? 24 + rnd() * 60 : 1 + rnd() * 4, 1 + rnd() * 2);
        }
        if (type === 'paper') {
          x.strokeStyle = 'rgba(45,48,37,.18)'; x.lineWidth = 1;
          for (let i = 0; i < 256; i += 32) for (let j = 0; j < 256; j += 48) { x.beginPath(); x.ellipse(i, j, 7, 17, .3, 0, Math.PI * 2); x.stroke(); }
        }
        if (type === 'tile') {
          x.strokeStyle = 'rgba(20,25,24,.35)'; x.lineWidth = 2;
          for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
        }
        const t = own(new T.CanvasTexture(c)); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping;
        t.repeat.set(type === 'wood' ? 2 : 3, type === 'wood' ? 2 : 3);
        return t;
      }
      const wood = mat(d.home.wood); wood.map = texture(d.home.wood, 'wood');
      const wall = mat(d.home.wall); wall.map = texture(d.home.wall, 'paper');
      const plaster = mat('#8b8b7e'); plaster.map = texture('#8b8b7e', 'plaster');
      const floor = mat('#5a5346'); floor.map = texture('#5a5346', 'wood');
      const metal = mat('#62685f', .65), dark = mat('#252923'), linen = mat('#b6b1a0');
      function mesh(geometry, material, x, y, z, parent = scene) {
        const m = new T.Mesh(own(geometry), material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
      }
      const box = (w, h, dep, x, y, z, material = wood, parent) => mesh(new T.BoxGeometry(w, h, dep), material, x, y, z, parent);
      const sphere = (r, x, y, z, material, parent) => mesh(new T.SphereGeometry(r, 20, 14), material, x, y, z, parent);
      const cylinder = (r1, r2, h, x, y, z, material, parent) => mesh(new T.CylinderGeometry(r1, r2, h, 20), material, x, y, z, parent);
      function chair(x, z, angle = 0) {
        const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = angle; scene.add(g);
        box(.46, .07, .46, 0, .48, 0, wood, g);
        for (const a of [-.19, .19]) for (const b of [-.19, .19]) box(.045, .47, .045, a, .235, b, wood, g);
        box(.045, .55, .045, -.19, .75, .2, wood, g); box(.045, .55, .045, .19, .75, .2, wood, g);
        box(.43, .2, .045, 0, .92, .2, wood, g);
      }
      function table(x, z, w = 1.5, dep = .85) {
        box(w, .07, dep, x, .77, z);
        for (const a of [-1, 1]) for (const b of [-1, 1]) box(.055, .74, .055, x + a * (w / 2 - .1), .37, z + b * (dep / 2 - .08));
      }
      function bed(x, z, hospital = false) {
        box(1.15, .12, 2, x, .43, z, hospital ? metal : wood);
        box(1.12, .15, 1.96, x, .56, z, linen);
        box(1.1, .06, 1.2, x, .67, z + .3, mat('#6b736a'));
        const pillow = sphere(.3, x, .7, z - .65, linen); pillow.scale.set(1.5, .3, .8);
        for (const a of [-.5, .5]) for (const b of [-.86, .86]) cylinder(.025, .025, .46, x + a, .23, z + b, metal);
        if (hospital) for (const end of [-.94, .94]) {
          box(1.15, .04, .04, x, 1, z + end, metal);
          for (let i = -.5; i <= .5; i += .2) cylinder(.015, .015, .55, x + i, .75, z + end, metal);
        }
      }
      function human(x, z, age = d.age, turn = d.blocking.turn, other = false) {
        if (age === 'none' || age === 'baby') return;
        const g = new T.Group(); scene.add(g); g.position.set(x, 0, z); g.rotation.y = turn;
        const scale = (age === 'child' ? .65 : age === 'teen' ? .9 : 1) * d.identity.stature;
        g.scale.setScalar(scale);
        const coat = mat(other ? '#55534a' : d.identity.coat), hair = mat(age === 'old' ? '#77766e' : d.identity.hair);
        const pants = mat('#303330');
        for (const a of [-.12, .12]) {
          cylinder(.075, .065, .76, a, .45, 0, pants, g);
          box(.15, .11, .3, a, .07, -.06, dark, g);
        }
        const torso = cylinder(.2, .24, .62, 0, 1.1, 0, coat, g); torso.scale.z = .65;
        for (const a of [-1, 1]) {
          const arm = cylinder(.067, .055, .59, a * .25, 1.04, 0, coat, g); arm.rotation.z = a * .12;
          sphere(.055, a * .28, .73, 0, mat('#8c7f6b'), g);
        }
        const head = sphere(.14, 0, 1.58, .015, hair, g); head.scale.set(.85, 1.16, .95);
        // The back of the head is intentional: the witness never sees a face.
        if (d.gender === 'f' && !other) { const back = sphere(.13, 0, 1.5, .06, hair, g); back.scale.set(.9, 1.5, .6); }
        if (age === 'old') g.rotation.x = -.055;
      }
      function keepsake(x, y, z) {
        const name = d.prop.toLowerCase();
        const paper = mat('#c3b999');
        if (/письм|конверт|билет|фото|снимок|тетрад|книг/.test(name)) {
          const p = box(.24, .008, .16, x, y, z, paper); p.rotation.y = rnd() * .4;
          if (/фото|снимок/.test(name)) box(.18, .009, .11, x, y + .005, z, mat('#4c5148'));
        } else if (/ключ/.test(name)) {
          box(.15, .012, .025, x, y, z, metal); mesh(new T.TorusGeometry(.025, .008, 6, 12), metal, x - .08, y, z).rotation.x = Math.PI / 2;
        } else if (/кассет|лент|радио/.test(name)) { box(.15, .04, .1, x, y + .02, z, dark); }
        else { cylinder(.045, .04, .1, x, y + .05, z, linen); }
      }
      function lamp(x, z) {
        const shade = mat('#b9ab82'); shade.side = T.DoubleSide;
        cylinder(.08, .28, .24, x, 2.25, z, shade);
        cylinder(.007, .007, .7, x, 2.7, z, dark);
        const glow = own(new T.MeshBasicMaterial({ color: '#e6c186' })); sphere(.045, x, 2.16, z, glow);
        const light = new T.PointLight(0xffd3a0, night ? 2 : 1.3, 9, 1.5); light.position.set(x, 2.12, z); scene.add(light);
      }
      const hemi = new T.HemisphereLight(night ? 0x657b94 : 0xbccbd2, 0x393027, night ? .48 : .8); scene.add(hemi);
      const key = new T.DirectionalLight(night ? 0x8ca9c3 : 0xd9ded6, night ? .65 : 1.75);
      key.position.set(d.home.window * 3, 6, -4); key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -9; key.shadow.camera.right = 9; key.shadow.camera.top = 9; key.shadow.camera.bottom = -9; key.shadow.normalBias = .025;
      scene.add(key);
      const { width: rw, depth: rd, height: rh } = d.room;
      if (!d.outdoor && !photographic) {
        box(rw, .16, rd + 4, 0, -.09, 0, floor);
        const clinical = ['hospital', 'roddom'].includes(d.loc);
        const wm = clinical ? plaster : wall;
        // A real opening, not a white rectangle pasted onto a solid wall.
        const wx = d.home.window * (rw * .2), wz = -rd / 2;
        const ww = 1.5, wh = 1.65, wy = 1.65;
        const left = wx - ww / 2, right = wx + ww / 2;
        box(left + rw / 2, rh, .13, (-rw / 2 + left) / 2, rh / 2, wz, wm);
        box(rw / 2 - right, rh, .13, (right + rw / 2) / 2, rh / 2, wz, wm);
        box(ww, wy - wh / 2, .13, wx, (wy - wh / 2) / 2, wz, wm);
        box(ww, rh - wy - wh / 2, .13, wx, (rh + wy + wh / 2) / 2, wz, wm);
        box(.13, rh, rd, -rw / 2, rh / 2, 0, wm); box(.13, rh, rd, rw / 2, rh / 2, 0, wm);
        box(rw, .1, rd, 0, rh, 0, plaster);
        const frame = mat('#b4b2a0');
        for (const a of [-1, 0, 1]) box(.045, wh + .1, .16, wx + a * ww / 2, wy, wz, frame);
        for (const a of [-1, 1]) box(ww + .1, .05, .16, wx, wy + a * wh / 2, wz, frame);
        box(ww + .25, .055, .4, wx, wy - wh / 2, wz + .1, frame);
        for (let i = 0; i < 11; i++) box(.075, .5, .15, wx - .6 + i * .12, .43, wz + .18, metal);
        const sheer = own(new T.MeshStandardMaterial({ color: '#c4c2ae', transparent: true, opacity: .2, side: T.DoubleSide, roughness: 1, depthWrite: false }));
        for (const a of [-1, 1]) { const curtain = box(.35, 1.95, .025, wx + a * .72, 1.55, wz + .2, sheer); curtain.castShadow = false; }
        // Grounding details: skirting, plugs, frames, worn carpet.
        box(rw, .1, .04, 0, .05, wz + .1, wood);
        box(.1, .15, .03, rw / 2 - .12, .45, -.5, linen).rotation.y = Math.PI / 2;
        const rug = mat('#53463a'); rug.map = texture('#53463a', 'paper'); box(2.1, .012, 1.5, -.2, .012, .3, rug);
        lamp(d.variation > .5 ? -.5 : .65, -.5);
        switch (d.loc) {
          case 'kitchen':
            table(.2, -.8); chair(.2, .05); chair(-.9, -.8, -Math.PI / 2);
            box(1.4, .8, .58, -rw / 2 + .8, .4, -1.8, mat('#858677'));
            box(.65, 1.65, .65, rw / 2 - .5, .825, -2, linen);
            for (let i = 0; i < 3; i++) box(.34, .55, .32, -rw / 2 + .4 + i * .42, 1.8, -2, wood);
            keepsake(.2, .82, -.8); cylinder(.12, .15, .22, -.2, .92, -1, metal); break;
          case 'bedroom': case 'empty':
            bed(-1.25, -1.2); box(.9, 2.3, .6, 1.65, 1.15, -2, wood);
            table(1.3, -.1, .8, .6); keepsake(1.3, .82, -.1);
            if (d.loc === 'empty') { box(1, .02, .65, 1.3, .84, -.1, linen); }
            break;
          case 'roddom':
            bed(-1.5, -1.2, true);
            box(.7, .08, 1, .5, .7, -.9, metal); box(.65, .1, .9, .5, .79, -.9, linen);
            const baby = sphere(.18, .5, .92, -.9, linen); baby.scale.set(.7, .65, 1.6);
            for (const a of [-.3, .3]) for (const b of [-.45, .45]) cylinder(.02, .02, 1, .5 + a, .5, -.9 + b, metal);
            break;
          case 'hospital':
            bed(-1.4, -1.2, true); chair(1.1, -.8); table(1.1, -1.65, .6, .45); keepsake(1.1, .82, -1.65); break;
          case 'school':
            box(2.5, 1.1, .06, 0, 1.65, -rd / 2 + .15, mat('#2b3d34'));
            for (let z = -1.6; z < 2; z += 1.3) for (const x of [-1.25, 1.25]) { table(x, z, 1, .55); chair(x, z + .55); }
            break;
          case 'office':
            table(-.4, -1.1, 1.7, .9); chair(-.4, -.35); keepsake(-.4, .82, -1.1);
            for (let i = 0; i < 3; i++) { box(.7, 1.6, .55, 1.7, .8, -2 + i * .7, metal); for (let j = 0; j < 4; j++) box(.6, .015, .02, 1.7, .25 + j * .38, -1.71 + i * .7, dark); }
            break;
          case 'factory':
            for (let i = 0; i < 3; i++) { box(1, .8, 1.1, -1.7 + i * 1.7, .4, -1.5, metal); cylinder(.18, .18, 1.3, -1.7 + i * 1.7, 1.05, -1.5, dark); }
            break;
          case 'stairwell':
            for (let i = 0; i < 10; i++) box(1.65, .17 * (i + 1), .32, -.7, .085 * (i + 1), 1 - i * .32, plaster);
            for (let i = 0; i < 6; i++) { box(.25, .32, .12, 2, 1.15 + (i % 2) * .35, -1 + Math.floor(i / 2) * .3, metal); }
            break;
        }
      } else if (!photographic) {
        const ground = mat(['field', 'cemetery'].includes(d.loc) ? '#65684d' : '#666b65'); ground.map = texture('#66675a', 'plaster');
        box(120, .1, 120, 0, -.07, -20, ground);
        function tree(x, z) {
          const trunk = mat('#96998b'); cylinder(.075, .12, 5, x, 2.5, z, trunk);
          for (let i = 0; i < 7; i++) { const branch = cylinder(.012, .035, 1.3, x + (rnd() - .5) * .6, 2.7 + i * .3, z, dark); branch.rotation.z = (i % 2 ? 1 : -1) * .7; }
        }
        if (['yard', 'bus', 'balcony'].includes(d.loc)) {
          for (let i = 0; i < 4; i++) {
            const x = -13 + i * 9, z = -18 - rnd() * 5;
            box(7.5, 12, 4, x, 6, z, plaster);
            for (let row = 0; row < 6; row++) for (let col = 0; col < 4; col++) box(.75, 1.1, .04, x - 2.6 + col * 1.65, 1 + row * 1.8, z + 2.03, mat(rnd() < .15 ? '#9b8d60' : '#394a50'));
          }
        }
        switch (d.loc) {
          case 'sea':
            const sea = mat('#687e82', .35); box(160, .06, 120, 0, -.015, -65, sea);
            for (let i = 0; i < 38; i++) box(90, .008, .035 + rnd() * .1, 0, .023, -7 - i * 1.5, mat(i % 2 ? '#74898a' : '#5b7278'));
            for (let i = 0; i < 24; i++) box(1.35, .08, .25, -1, .2, -1 - i * .28, wood);
            break;
          case 'field':
            for (let i = 0; i < 90; i++) { const x = (rnd() - .5) * 36, z = -rnd() * 35; cylinder(.015, .025, .5 + rnd() * .5, x, .35, z, mat('#8a8965')); }
            tree(-3, -6); break;
          case 'cemetery':
            for (let i = 0; i < 14; i++) { const x = (rnd() - .5) * 16, z = -3 - rnd() * 16; box(.5, .65, .12, x, .325, z, mat('#71766c')); if (i % 3 === 0) tree(x + 1.5, z - 1); }
            break;
          case 'platform':
            box(3, .24, 45, 1, .08, -15, plaster);
            box(2.8, 2.8, 30, -3, 1.4, -13, mat('#3e554e'));
            for (let i = 0; i < 14; i++) box(.035, .75, 1, -1.58, 1.85, -1 - i * 1.7, mat('#899b96'));
            for (const x of [0, 2]) cylinder(.06, .06, 3.1, x, 1.55, -4, metal);
            box(4, .15, 5, 1, 3.15, -4, metal); break;
          case 'bus':
            for (const x of [-1.3, 1.3]) box(.08, 2.4, .08, x, 1.2, -2, metal);
            box(3, .1, 1.8, 0, 2.4, -2.4, metal); box(2.8, 1.9, .08, 0, 1.25, -3.1, mat('#777e73'));
            table(0, -2.4, 2, .4); break;
          case 'yard':
            for (const x of [-1, 1]) { const leg = cylinder(.035, .035, 2.6, x, 1.3, -2, metal); leg.rotation.z = x * .1; }
            box(2.4, .07, .07, 0, 2.55, -2, metal);
            for (const x of [-.25, .25]) cylinder(.008, .008, 1.9, x, 1.55, -2, metal);
            box(.65, .05, .32, 0, .6, -2, wood); tree(3, -5); break;
          case 'balcony':
            box(5, .12, 3, 0, 0, -.5, plaster);
            for (let i = -6; i <= 6; i++) cylinder(.018, .018, 1.1, i * .35, .55, -1.8, metal);
            box(4.5, .045, .06, 0, 1.1, -1.8, metal); break;
        }
      }
      if (photographic) {
        // Contact shadows ground independently rendered people in the plate.
        const shadow = own(new T.ShadowMaterial({ opacity: .28 }));
        const ground = mesh(new T.PlaneGeometry(100, 100), shadow, 0, -.01, 0); ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
        if (d.age !== 'none' && d.age !== 'baby') {
          // Keep the witness small enough that the memory stays about a place.
          d = { ...d, blocking: { ...d.blocking, x: d.blocking.x * .45, z: 1.2 + d.variation * .3 } };
        }
      }
      human(d.blocking.x, d.blocking.z);
      if (d.age !== 'none') for (let i = 0; i < Math.min(2, d.others); i++) human((i ? 1 : -1) * (1.4 + rnd() * .4), photographic ? .5 : -2.2, 'adult', i ? -.2 : .3, true);
      const camera = new T.PerspectiveCamera(d.outdoor ? 49 : 57, W / H, .05, 160);
      camera.position.set(d.camera.x, d.camera.y, d.camera.z);
      camera.lookAt(d.camera.targetX, d.age === 'baby' ? .85 : 1.1, -1.2);
      return { scene, camera, dispose() { resources.forEach(r => r.dispose()); key.shadow.map?.dispose(); } };
    }
    const plates = new Map();
    let varietyPromise;
    function loadVariety() {
      return varietyPromise ||= fetch('assets/photographic/variety.json?v=1')
        .then(r => r.ok ? r.json() : {}).catch(() => ({}));
    }
    const localPlates = new Set(MemoryWorld.LOCATIONS);
    const actors = new Map();
    function loadActor(gender, age, variant) {
      if (age === 'none' || age === 'baby') return Promise.resolve(null);
      const stage = age === 'teen' ? 'teen' : age === 'child' ? 'child' : age === 'old' ? 'old' : 'adult';
      const key = variant || `${gender === 'f' ? 'f' : 'm'}-${stage}`;
      if (!actors.has(key)) actors.set(key, new Promise(resolve => {
        const img = new Image();
        img.onerror = () => { actors.delete(key); resolve(null); };
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = 512; c.height = 768;
          const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, c.width, c.height);
          const pixels = x.getImageData(0, 0, c.width, c.height), p = pixels.data;
          for (let i = 0; i < p.length; i += 4) {
            const r = p[i], g = p[i + 1], b = p[i + 2], excess = g - Math.max(r, b);
            if (excess > 25 && g > 65) {
              p[i + 3] = Math.round(255 * Math.max(0, 1 - (excess - 25) / 55));
              p[i + 1] = Math.min(g, Math.max(r, b) + 8);
            }
          }
          x.putImageData(pixels, 0, 0);
          // Trim the green studio margins: height must mean head-to-sole,
          // not the arbitrary dimensions of the source photograph.
          let left = c.width, top = c.height, right = 0, bottom = 0;
          for (let py = 0; py < c.height; py++) for (let px = 0; px < c.width; px++) {
            if (p[(py * c.width + px) * 4 + 3] < 200) continue;
            left = Math.min(left, px); right = Math.max(right, px);
            top = Math.min(top, py); bottom = Math.max(bottom, py);
          }
          const trimmed = document.createElement('canvas');
          trimmed.width = right - left + 1; trimmed.height = bottom - top + 1;
          trimmed.getContext('2d').drawImage(c, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
          resolve(trimmed);
        };
        img.src = `assets/photographic/${key}-actor.jpg`;
      }));
      return actors.get(key);
    }
    function loadPlate(loc) {
      if (!localPlates.has(loc) && !loc.includes('-')) return Promise.resolve(null);
      if (!plates.has(loc)) plates.set(loc, new Promise(resolve => {
        const img = new Image(); img.onload = () => resolve(img); img.onerror = () => { plates.delete(loc); resolve(null); };
        img.src = `assets/photographic/${loc}-plate.jpg`;
      }));
      return plates.get(loc);
    }
    function composePlate(plate, foreground, d, actor) {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'), rnd = MemoryWorld.random(d.sceneSeed);
      // Crop remains independent of character blocking; fixed plates have no baked actors.
      const zoom = 1, ratio = W / H;
      const sw = Math.min(plate.width, plate.height * ratio) / zoom, sh = sw / ratio;
      const sx = (plate.width - sw) / 2, sy = (plate.height - sh) / 2;
      x.filter = `saturate(${.45 + d.variation * .25}) brightness(${d.time === 'night' ? .9 : 1.08})`;
      x.drawImage(plate, sx, sy, sw, sh, 0, 0, W, H); x.filter = 'none';
      if (actor) {
        const setting = d.plateLayout || MemoryWorld.plateLayout(d.loc);
        const size = setting.height * (d.age === 'child' ? .67 : d.age === 'teen' ? .94 : 1);
        const h = H * size * d.identity.stature, w = h * actor.width / actor.height;
        const ax = W * setting.x, feet = H * setting.feet;
        x.save(); x.fillStyle = 'rgba(0,0,0,.42)'; x.filter = 'blur(4px)'; x.beginPath(); x.ellipse(ax, feet - 2, w * .36, h * .018, 0, 0, Math.PI * 2); x.fill(); x.restore();
        const dressed = document.createElement('canvas'); dressed.width = actor.width; dressed.height = actor.height;
        const dress = dressed.getContext('2d'); dress.drawImage(actor, 0, 0);
        dress.globalCompositeOperation = 'source-atop'; dress.globalAlpha = .24;
        dress.fillStyle = d.identity.coat; dress.fillRect(0, actor.height * .25, actor.width, actor.height * .55);
        dress.fillStyle = d.age === 'old' ? '#8f8d82' : d.identity.hair; dress.fillRect(0, 0, actor.width, actor.height * .24);
        x.save(); x.filter = `brightness(${d.time === 'night' ? .65 : .8}) saturate(.5) sepia(${.1 + d.variation * .2}) blur(.45px)`;
        x.globalAlpha = .96; x.drawImage(dressed, ax - w / 2, feet - h, w, h); x.restore();
        // Never duplicate the protagonist as a miniature "other person".
      } else { x.save(); x.globalAlpha = .8; x.filter = 'blur(1px)'; x.drawImage(foreground, 0, 0); x.restore(); }
      // Foreground occlusion: looking through a doorway, never a decorative UI frame.
      if (!d.outdoor && d.variation < .6) {
        const side = d.home.window > 0 ? 0 : W - 80;
        x.fillStyle = 'rgba(10,9,8,.8)'; x.fillRect(side, 0, 80, H);
        x.fillStyle = 'rgba(70,62,48,.25)'; x.fillRect(side + (side ? 0 : 75), 0, 5, H);
      }
      // Keepsakes need a calibrated physical surface; never scatter symbolic
      // photographs or letters onto an arbitrary foreground floor.
      const shade = x.createRadialGradient(W * .5, H * .4, H * .15, W * .5, H * .5, W * .75);
      shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.65)'); x.fillStyle = shade; x.fillRect(0, 0, W, H);
      if (d.weather === 'rain' && d.outdoor) {
        x.strokeStyle = 'rgba(185,195,195,.11)'; x.lineWidth = .7;
        for (let i = 0; i < 150; i++) { const a = rnd() * W, b = rnd() * H; x.beginPath(); x.moveTo(a, b); x.lineTo(a - 3, b + 10 + rnd() * 18); x.stroke(); }
      }
      for (let i = 0; i < 18000; i++) { x.fillStyle = rnd() > .5 ? 'rgba(230,225,210,.035)' : 'rgba(0,0,0,.055)'; x.fillRect(rnd() * W, rnd() * H, 1, 1); }
      return c;
    }
    async function render(person, index) {
      const d = MemoryWorld.describe(person, index);
      if (cache.has(d.id)) return cache.get(d.id);
      let world;
      try {
        const variety = await loadVariety();
        const matches = item => (!item.time || item.time === d.time)
          && (!item.shapes || item.shapes.includes(person.shape))
          && (!item.lifeIds || item.lifeIds.includes(person.id))
          && (!item.locations || item.locations.includes(d.loc))
          && (item.outdoor == null || item.outdoor === d.outdoor);
        const environments = (variety.plates?.[d.loc] || []).filter(matches);
        const environment = environments.length ? environments[d.seed % environments.length] : null;
        if (environment) d.plateLayout = environment.layout;
        const outfits = (variety.actors?.[`${d.gender}-${d.age}`] || [])
          .filter(matches);
        const outfit = outfits.length ? outfits[d.seed % outfits.length] : null;
        const [plate, actor] = await Promise.all([loadPlate(environment?.key || d.loc), loadActor(d.gender, d.age, outfit?.key)]);
        if ((failed || !window.THREE) && !plate) return null;
        if (plate && (actor || d.age === 'none' || d.age === 'baby' || failed || !window.THREE)) {
          const blank = document.createElement('canvas'); blank.width = W; blank.height = H;
          const output = composePlate(plate, blank, d, actor);
          const blob = await new Promise(resolve => output.toBlob(resolve, 'image/jpeg', .9));
          if (!blob) return null;
          const url = URL.createObjectURL(blob); cache.set(d.id, url);
          if (cache.size > 10) { const oldest = cache.keys().next().value; URL.revokeObjectURL(cache.get(oldest)); cache.delete(oldest); }
          return url;
        }
        if (!renderer) {
          renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
          renderer.setSize(W, H); renderer.setPixelRatio(1);
          renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
          renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        world = makeScene(d, Boolean(plate)); renderer.render(world.scene, world.camera);
        const output = plate ? composePlate(plate, renderer.domElement, d, actor) : renderer.domElement;
        const blob = await new Promise(resolve => output.toBlob(resolve, 'image/jpeg', .9));
        if (!blob) return null;
        const url = URL.createObjectURL(blob); cache.set(d.id, url);
        // A handful of decoded memories, never 3,000 frames in RAM.
        if (cache.size > 10) { const oldest = cache.keys().next().value; URL.revokeObjectURL(cache.get(oldest)); cache.delete(oldest); }
        return url;
      } catch (error) { failed = true; console.warn('Memory renderer unavailable; using source photograph.', error); return null; }
      finally { world?.dispose(); }
    }
    function image(person, index) {
      const task = queue.then(() => render(person, index));
      queue = task.catch(() => null); return task;
    }
    function release() { renderer?.dispose(); renderer?.forceContextLoss(); renderer = null; }
    return { image, release };
  })());
}
