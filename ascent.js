/* Ascent: consciousness leaving the Earth. ~28 s, three.js.
   1. the last memory overexposes into white light (the moment of leaving)
   2. out of the white: low over the real Earth at the terminator, city side in shadow
   3. slow rise: the curve of the horizon, thin atmosphere, sunrise along the limb
   4. the planet recedes until it is small among the Milky Way
   Text appears only in pauses. Falls back to a short fade without WebGL.
   The Earth here uses the same materials as the space scene: one light,
   real clouds, city lights, the window that is still on. */
function playAscent(host, person, onDone, onPrepare) {
  const female = person?.gender === 'f';
  const caption = document.createElement('div');
  caption.className = 'ascent-caption';
  const flash = document.createElement('div');
  flash.className = 'ascent-flash';
  let done = false, prepared = false, raf = 0, renderer = null;
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
  if (typeof composedMemoryUrl === 'function') composedMemoryUrl(person, last).then(src => { if (src && !done) memLayer.style.backgroundImage = `url("${src}")`; });
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
  const camera = new THREE.PerspectiveCamera(50, 1, 0.001, 2600);
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

  // Milky Way background — the real mosaic, tilted like the space scene
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 32),
    new THREE.MeshBasicMaterial({ map: tex('assets/milky-way-real-4k.jpg'), side: THREE.BackSide, color: 0xffffff }));
  sky.rotation.set(0.42, 0.9, -0.62);
  scene.add(sky);

  // real catalogue stars over the plate
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1.0 } },
    vertexShader: `
      attribute float size; varying vec3 vColor; uniform float uTime;
      void main(){
        vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.88 + 0.12 * sin(uTime * (0.7 + size) + position.x * 0.02);
        gl_PointSize = clamp(size * tw * (900.0 / max(-mv.z, 1.0)), 0.6, 4.4);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uOpacity; varying vec3 vColor;
      void main(){ float d = length(gl_PointCoord - vec2(0.5)); float a = smoothstep(0.5, 0.04, d); gl_FragColor = vec4(vColor, a * uOpacity); }`,
  });
  const catalog = window.STAR_CATALOG;
  if (catalog && catalog.length > 40 && window.SpaceScene) {
    const count = Math.floor(catalog.length / 4);
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), siz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const l = catalog[i * 4] * Math.PI / 180, b = catalog[i * 4 + 1] * Math.PI / 180;
      const mag = catalog[i * 4 + 2], bv = catalog[i * 4 + 3];
      const cb = Math.cos(b);
      pos[i * 3] = cb * Math.cos(l) * 1200; pos[i * 3 + 1] = -Math.sin(b) * 1200; pos[i * 3 + 2] = cb * Math.sin(l) * 1200;
      const rgb = SpaceScene.bvToRgb(Math.max(-0.4, Math.min(2.0, bv)));
      const vis = Math.max(0.16, Math.min(1.35, Math.pow(10, -0.16 * (mag - 0.4))));
      col[i * 3] = rgb[0] * vis; col[i * 3 + 1] = rgb[1] * vis; col[i * 3 + 2] = rgb[2] * vis;
      siz[i] = Math.max(0.55, Math.min(3.1, 2.15 - mag * 0.28));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(siz, 1));
    const stars = new THREE.Points(geo, starMat);
    stars.rotation.copy(sky.rotation);
    stars.frustumCulled = false;
    scene.add(stars);
  }

  // Earth: same shader as the space scene — day, night lights, the lit window, clouds, glint
  const sunDir = new THREE.Vector3(1, 0.15, -0.35).normalize();
  const earthTex = { day: tex('assets/earth.jpg'), night: tex('assets/earth-night.jpg'), clouds: tex('assets/earth-clouds.jpg') };
  const earthMat = window.SpaceScene
    ? SpaceScene.earthMaterial(THREE, earthTex, { oneLight: [0.5059, 0.2285] })
    : new THREE.MeshBasicMaterial({ map: earthTex.day });
  if (earthMat.uniforms?.uSunPos) earthMat.uniforms.uSunPos.value.copy(sunDir).multiplyScalar(50);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), earthMat);
  earth.rotation.y = -1.9 + ((person?.id || 0) % 7) * 0.12;
  earth.rotation.x = 0.35;
  scene.add(earth);

  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.004, 96, 64),
    new THREE.MeshStandardMaterial({ map: earthTex.clouds, transparent: true, opacity: 0.6, depthWrite: false, roughness: 1, metalness: 0, color: 0xdfe6e8 }));
  clouds.rotation.copy(earth.rotation);
  scene.add(clouds);

  // Atmosphere shell: Rayleigh-ish limb, bright only on the sun side
  const atmoMat = window.SpaceScene
    ? SpaceScene.atmosphereMaterial(THREE, { colors: [[0.28, 0.55, 1.0], [1.0, 0.42, 0.18]], density: 1.0, power: 4.2, thickness: 1.0 })
    : new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  atmoMat.uniforms?.uSunDir?.value.copy(sunDir);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.028, 96, 64), atmoMat);
  scene.add(atmo);

  // Sun: a soft sprite low on the horizon, with the granulated disc behind it
  const sunCanvas = document.createElement('canvas'); sunCanvas.width = sunCanvas.height = 256;
  const sg = sunCanvas.getContext('2d'), grd = sg.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,250,235,1)'); grd.addColorStop(0.06, 'rgba(255,236,200,.9)');
  grd.addColorStop(0.2, 'rgba(255,190,120,.25)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = grd; sg.fillRect(0, 0, 256, 256);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sunCanvas), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sunSprite.position.copy(sunDir).multiplyScalar(120);
  sunSprite.scale.setScalar(16);
  scene.add(sunSprite);

  const sunLight = new THREE.PointLight(0xffefd8, 3.2, 0, 0);
  sunLight.position.copy(sunDir).multiplyScalar(60);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x2c3a4a, 0.16));

  cleanup.push(() => {
    scene.traverse((object) => {
      object.geometry?.dispose();
      const material = object.material;
      material?.map?.dispose();
      Object.values(material?.uniforms || {}).forEach(u => { if (u.value?.isTexture) u.value.dispose(); });
      material?.dispose();
    });
    renderer.forceContextLoss();
  });

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
  let lastSpeed = 0;

  function frame(now) {
    if (!host.isConnected) { finish(); return; }
    const elapsed = now - t0;
    const t = elapsed;

    // 1: memory overexposes, white holds, then opens onto the Earth
    const over = seg(t, 400, 3800);
    memLayer.style.opacity = String(1 - seg(t, 3600, 4600));
    memLayer.style.filter = `brightness(${1 + over * 3}) blur(${over * 6}px) saturate(${1 - over})`;
    memLayer.style.transform = `scale(${1 + over * 0.08})`;
    flash.style.opacity = String(1 - seg(t, 1200, 7000));
    if (t > 4600) memLayer.style.display = 'none';

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

    // the whole shot breathes: tiny hand-held drift, widening with speed
    const speed = Math.abs(alt - lastSpeed); lastSpeed = alt;
    const breathe = 0.0016 + Math.min(0.004, speed * 0.6);
    camera.rotateY(Math.sin(t * 0.0007) * breathe);
    camera.rotateX(Math.cos(t * 0.0009) * breathe * 0.7);

    earth.rotation.y += 0.00004;
    clouds.rotation.y += 0.00006;
    starMat.uniforms.uTime.value = t * 0.001;

    renderer.toneMappingExposure = 0.92;
    renderer.render(scene, camera);

    let text = '', ca = 0;
    for (const [a, b, s] of lines) if (t >= a && t <= b) { text = s; ca = Math.min(1, (t - a) / 1000, (b - t) / 1000); }
    if (caption.textContent !== text) caption.textContent = text;
    caption.style.opacity = ca.toFixed(3);
    if (t >= 25300 && !prepared) {
      prepared = true;
      const forward = new THREE.Vector3(); camera.getWorldDirection(forward);
      onPrepare?.({ pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z }, yaw: Math.atan2(forward.x, forward.z), pitch: Math.asin(forward.y) });
    }
    host.style.opacity = String(1 - seg(t, 25900, 28500));

    if (elapsed >= TOTAL) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return finish;
}
