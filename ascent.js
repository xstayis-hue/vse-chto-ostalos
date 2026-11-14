/* Ascent: consciousness leaving the Earth. ~28 s, three.js.
   1. the last memory overexposes into white light (the moment of leaving)
   2. out of the white: low over the real Earth at the terminator, city side in shadow
   3. slow rise: the curve of the horizon, thin atmosphere, sunrise along the limb
   4. the planet recedes until it is small among the Milky Way
   Text appears only in pauses. Falls back to a short fade without WebGL. */
function playAscent(host, person, onDone, onPrepare) {
  const female = person?.gender === 'f';
  const caption = document.createElement('div');
  caption.className = 'ascent-caption';
  const flash = document.createElement('div');
  flash.className = 'ascent-flash';
  let done = false, raf = 0, renderer = null;
  const cleanup = [];
  function finish() {
    if (done) return; done = true;
    cancelAnimationFrame(raf);
    cleanup.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
    if (!prepared) { prepared = true; onPrepare?.(); }
    onDone();
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || typeof THREE === 'undefined') {
    setTimeout(finish, 600); return finish;
  }

  // Phase 1 layer: the last memory, as the user saw it.
  const memLayer = document.createElement('div');
  memLayer.className = 'ascent-memory';
  const last = (person?.memories?.length || 6) - 2;
  const url = typeof memoryImageUrl === 'function' ? memoryImageUrl(person, last) : '';
  if (url) memLayer.style.backgroundImage = `url("${url}")`;

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) { setTimeout(finish, 600); return finish; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.className = 'ascent-canvas';
  host.append(renderer.domElement, memLayer, flash, caption);
  cleanup.push(() => renderer.dispose());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.001, 200);
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 62 : 48;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  cleanup.push(() => window.removeEventListener('resize', resize));

  const loader = new THREE.TextureLoader();
  const tex = (src) => { const t = loader.load(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

  // Milky Way background
  const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 32),
    new THREE.MeshBasicMaterial({ map: tex('assets/milky-way-4k.jpg'), side: THREE.BackSide, color: 0xd8dce4 }));
  sky.rotation.set(0.5, 0.3, 0.9);
  scene.add(sky);

  // Earth: day texture lit by the sun; night side keeps a faint warm glow of cities.
  const sunDir = new THREE.Vector3(1, 0.15, -0.35).normalize();
  const earthMat = new THREE.ShaderMaterial({
    uniforms: { day: { value: tex('assets/earth.jpg') }, sun: { value: sunDir } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position,1.0); vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `
      uniform sampler2D day; uniform vec3 sun; varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){
        vec3 c = texture2D(day, vUv).rgb;
        float l = dot(vN, sun);
        float dayK = smoothstep(-0.08, 0.25, l);
        vec3 lit = c * (0.08 + 1.15 * max(l, 0.0));
        // cities: land pixels (not blue, not white) on the night side
        float land = step(c.b, c.r * 1.05) * step(c.r, 0.75);
        vec2 q = vUv * vec2(6000.0, 3000.0); vec2 g = floor(q); vec2 fq = fract(q) - 0.5;
        float dot1 = smoothstep(0.22, 0.0, length(fq));
        float cluster = smoothstep(0.55, 0.9, h(floor(vUv * vec2(180.0, 90.0))));
        float city = step(0.93 - cluster * 0.25, h(g)) * dot1 * land * (1.0 - smoothstep(0.6, 0.8, abs(vUv.y - 0.5) * 2.0));
        vec3 night = c * 0.015 + vec3(1.0, 0.72, 0.38) * city * 1.4;
        vec3 col = mix(night, lit, dayK);
        // warm terminator band
        col += vec3(0.9, 0.4, 0.15) * 0.04 * exp(-pow(l * 9.0, 2.0));
        // atmosphere haze toward the limb
        float rim = pow(1.0 - max(dot(vN, vView), 0.0), 3.0);
        col += vec3(0.35, 0.55, 1.0) * rim * (0.15 + 0.85 * smoothstep(-0.2, 0.4, l));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), earthMat);
  earth.rotation.y = -1.9 + ((person?.id || 0) % 7) * 0.12;
  earth.rotation.x = 0.35;
  scene.add(earth);

  // Atmosphere shell: scattering glow, bright only on the sun side.
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.025, 96, 64), new THREE.ShaderMaterial({
    uniforms: { sun: { value: sunDir } },
    vertexShader: `varying vec3 vN; varying vec3 vView;
      void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position,1.0);
        vView = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 sun; varying vec3 vN; varying vec3 vView;
      void main(){
        float rim = pow(1.0 - abs(dot(vN, vView)), 4.0);
        float lit = smoothstep(-0.35, 0.5, dot(vN, sun));
        vec3 col = mix(vec3(1.0, 0.45, 0.2), vec3(0.35, 0.6, 1.0), smoothstep(-0.1, 0.4, dot(vN, sun)));
        gl_FragColor = vec4(col * rim * (0.2 + 1.6 * lit), rim * (0.15 + 0.85 * lit));
      }`,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(atmo);

  // Sun: a soft sprite low on the horizon.
  const sunCanvas = document.createElement('canvas'); sunCanvas.width = sunCanvas.height = 256;
  const sg = sunCanvas.getContext('2d'), grd = sg.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,250,235,1)'); grd.addColorStop(0.06, 'rgba(255,236,200,.9)');
  grd.addColorStop(0.2, 'rgba(255,190,120,.25)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = grd; sg.fillRect(0, 0, 256, 256);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sunCanvas), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sunSprite.position.copy(sunDir).multiplyScalar(60);
  sunSprite.scale.setScalar(14);
  scene.add(sunSprite);

  // Camera path: from just above the night side near the terminator, rising and turning
  // so the horizon curve and sunrise come into view, then pulling far away.
  const up = new THREE.Vector3(0, 1, 0);
  const startDir = new THREE.Vector3().copy(sunDir).applyAxisAngle(up, -1.75).normalize();
  const sideDir = new THREE.Vector3().crossVectors(startDir, up).normalize();
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (v) => v * v * (3 - 2 * v);
  const seg = (t, a, b) => ease(clamp((t - a) / (b - a)));

  const lines = [
    [2200, 5600, 'тело осталось внизу.'],
    [9000, 12800, 'отсюда не видно, кто был прав.'],
    [15200, 19600, female ? 'всё, что ты любила, — под этой тонкой полосой.' : 'всё, что ты любил, — под этой тонкой полосой.'],
    [22400, 26600, 'вот она. вся.'],
  ];
  const TOTAL = 28500;
  const t0 = performance.now();
  const camPos = new THREE.Vector3(), look = new THREE.Vector3();
  let prepared = false;

  function frame(now) {
    if (!host.isConnected) { finish(); return; }
    const t = now - t0;

    // 1: memory overexposes, white holds, then opens onto the Earth
    const over = seg(t, 400, 3800);
    memLayer.style.opacity = String(1 - seg(t, 3600, 4600));
    memLayer.style.filter = `brightness(${1 + over * 3}) blur(${over * 6}px) saturate(${1 - over})`;
    memLayer.style.transform = `scale(${1 + over * 0.08})`;
    flash.style.opacity = String(1 - seg(t, 1200, 7000));
    memLayer.style.display = 'none';

    // 2-4: altitude grows exponentially; the view tilts from horizon to planet
    const rise = seg(t, 4200, 26500);
    const alt = 0.03 * Math.pow(160, rise);              // 0.03 → ~4.8 radii
    const drift = rise * 0.9;
    const dir = startDir.clone().applyAxisAngle(up, drift * 0.9).normalize();
    camPos.copy(dir).multiplyScalar(1 + alt).addScaledVector(up, rise * 0.4);
    camera.position.copy(camPos);
    // look along the horizon at first, toward the planet's centre at the end
    const horizon = camPos.clone().add(sideDir.clone().applyAxisAngle(up, drift * 0.9).multiplyScalar(2)).addScaledVector(dir, -0.35);
    look.lerpVectors(horizon, new THREE.Vector3(0, 0, 0), seg(t, 12000, 24000));
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    earth.rotation.y += 0.00004;

    renderer.toneMappingExposure = 0.9 + 0.3 * seg(t, 13000, 18000) - 0.3 * seg(t, TOTAL - 1600, TOTAL);
    renderer.render(scene, camera);

    let text = '', ca = 0;
    for (const [a, b, s] of lines) if (t >= a && t <= b) { text = s; ca = Math.min(1, (t - a) / 1000, (b - t) / 1000); }
    if (caption.textContent !== text) caption.textContent = text;
    caption.style.opacity = ca.toFixed(3);
    if (t >= TOTAL - 3200 && !prepared) { prepared = true; onPrepare?.(); }
    host.style.opacity = String(1 - seg(t, TOTAL - 2600, TOTAL));

    if (t >= TOTAL) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return finish;
}
