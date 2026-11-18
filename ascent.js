/* Ascent: what dying feels like from inside, then what comes after.

   This is one continuous shot, not a cutscene, and it has four movements:

     0.0 - 5.2   the last memory. It stalls, the edges close in, the heartbeat
                 slows, then a flash of clinical white — the moment of death
     5.2 - 10.0  the white resolves into cloud tops. We are just above the
                 surface, still moving up, the horizon already curving
    10.0 - 20.0  through the last of the atmosphere: the sky thins from blue to
                 black, the air glow detaches from the limb
    20.0 - 28.5  the planet recedes to a coin, the sun comes over the edge,
                 and the mind stops being attached to a body

   The Earth here is built from the same materials as the space scene, so the
   hand-off at the end is invisible: the same ocean glint, the same city lights,
   the same one window. */
function playAscent(host, person, onDone, onPrepare) {
  const female = person?.gender === 'f';
  const caption = document.createElement('div');
  caption.className = 'ascent-caption';
  const flash = document.createElement('div');
  flash.className = 'ascent-flash';
  const iris = document.createElement('div');
  iris.className = 'ascent-iris';
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

  // Movement 0: the last memory, as the player last saw it.
  const memLayer = document.createElement('div');
  memLayer.className = 'ascent-memory';
  const last = (person?.memories?.length || 6) - 2;
  const url = typeof memoryImageUrl === 'function' ? memoryImageUrl(person, last) : '';
  if (url) memLayer.style.backgroundImage = `url("${url}")`;
  if (typeof composedMemoryUrl === 'function') composedMemoryUrl(person, last).then((src) => { if (src && !done) memLayer.style.backgroundImage = `url("${src}")`; });
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) { setTimeout(finish, 600); return finish; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.className = 'ascent-canvas';
  host.append(renderer.domElement, memLayer, iris, flash, caption);
  cleanup.push(() => renderer.dispose());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.0008, 2600);
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

  // Milky Way — the real mosaic, tilted like the space scene
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
      const vis = Math.max(0.16, Math.min(1.35, Math.pow(10, -0.17 * (mag - 0.4))));
      col[i * 3] = rgb[0] * vis; col[i * 3 + 1] = rgb[1] * vis; col[i * 3 + 2] = rgb[2] * vis;
      siz[i] = Math.max(0.55, Math.min(3.1, 2.2 - mag * 0.3));
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
  const sunDir = new THREE.Vector3(1, 0.18, -0.42).normalize();
  const earthTex = { day: tex('assets/earth.jpg'), night: tex('assets/earth-night.jpg'), clouds: tex('assets/earth-clouds.jpg') };
  const earthMat = window.SpaceScene
    ? SpaceScene.earthMaterial(THREE, earthTex, { oneLight: [0.5059, 0.2285] })
    : new THREE.MeshBasicMaterial({ map: earthTex.day });
  if (earthMat.uniforms?.uSunPos) earthMat.uniforms.uSunPos.value.copy(sunDir).multiplyScalar(80);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 110), earthMat);
  earth.rotation.y = -1.9 + ((person?.id || 0) % 7) * 0.12;
  earth.rotation.x = 0.34;
  scene.add(earth);

  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.0035, 128, 96),
    new THREE.MeshStandardMaterial({ map: earthTex.clouds, transparent: true, opacity: 0.66, depthWrite: false, roughness: 1, metalness: 0, color: 0xe4ebee, alphaMap: earthTex.clouds }));
  clouds.rotation.copy(earth.rotation);
  scene.add(clouds);

  // Atmosphere: a thin shell that is bright at the limb and gone overhead
  const atmoMat = window.SpaceScene
    ? SpaceScene.atmosphereMaterial(THREE, { colors: [[0.26, 0.54, 1.2], [1.15, 0.42, 0.15]], density: 1.0, power: 4.6, thickness: 0.055, night: 0.4 })
    : new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  atmoMat.uniforms?.uSunDir?.value.copy(sunDir);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.018, 160, 110), atmoMat);
  scene.add(atmo);

  // The sun: a soft sprite just past the limb, plus the real light behind it
  const sunCanvas = document.createElement('canvas'); sunCanvas.width = sunCanvas.height = 256;
  const sg = sunCanvas.getContext('2d'), grd = sg.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,250,235,1)'); grd.addColorStop(0.05, 'rgba(255,238,204,.92)');
  grd.addColorStop(0.18, 'rgba(255,196,128,.28)'); grd.addColorStop(1, 'rgba(255,150,70,0)');
  sg.fillStyle = grd; sg.fillRect(0, 0, 256, 256);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sunCanvas), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
  sunSprite.position.copy(sunDir).multiplyScalar(300);
  sunSprite.scale.setScalar(26);
  scene.add(sunSprite);

  const sunLight = new THREE.PointLight(0xfff1dc, 3.0, 0, 0);
  sunLight.position.copy(sunDir).multiplyScalar(60);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x2a3746, 0.14));

  cleanup.push(() => {
    scene.traverse((object) => {
      object.geometry?.dispose();
      const material = object.material;
      material?.map?.dispose();
      material?.alphaMap?.dispose();
      Object.values(material?.uniforms || {}).forEach((u) => { if (u.value?.isTexture) u.value.dispose(); });
      material?.dispose();
    });
    renderer.forceContextLoss();
  });

  /* Camera path.

     Unlike the old version this starts *inside* the atmosphere, at 1.004 radii,
     with the horizon already in frame: the first thing the mind sees after the
     white is the top of the clouds, not a distant globe. Altitude then grows
     exponentially, and the view tilts from the horizon to the planet's centre. */
  const up = new THREE.Vector3(0, 1, 0);
  const startDir = new THREE.Vector3().copy(sunDir).applyAxisAngle(up, -1.62).normalize();
  const sideDir = new THREE.Vector3().crossVectors(startDir, up).normalize();
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (v) => v * v * (3 - 2 * v);
  const seg = (t, a, b) => ease(clamp((t - a) / (b - a)));

  const lines = [
    [6600, 10600, 'тело осталось внизу.'],
    [12200, 16400, 'отсюда не видно, кто был прав.'],
    [17800, 22000, female ? 'всё, что ты любила, — под этой тонкой полосой.' : 'всё, что ты любил, — под этой тонкой полосой.'],
    [23200, 27400, 'вот она. вся.'],
  ];
  const TOTAL = 28500;
  const t0 = performance.now();
  const camPos = new THREE.Vector3(), look = new THREE.Vector3();
  let lastAlt = 0;

  function frame(now) {
    if (!host.isConnected) { finish(); return; }
    const elapsed = now - t0;
    const t = elapsed;

    /* Movement 0 — the memory dies.

       Not an instant cut: the photograph holds, then the edges darken (iris),
       contrast drains, a slow breath pushes the scale, and only then the white. */
    const closing = seg(t, 900, 4200);
    const over = seg(t, 3600, 5000);
    memLayer.style.opacity = String(1 - seg(t, 4300, 5400));
    memLayer.style.filter = `brightness(${1 - closing * 0.45 + over * 4}) contrast(${1 - closing * 0.3}) blur(${closing * 2.2 + over * 8}px) saturate(${1 - closing * 0.7 - over})`;
    memLayer.style.transform = `scale(${1 + closing * 0.05 + over * 0.12})`;
    iris.style.opacity = String(closing * 0.92 * (1 - over));
    iris.style.setProperty('--iris', `${(1 - closing * 0.92).toFixed(3)}`);
    flash.style.opacity = String(Math.max(0, 1 - seg(t, 4900, 8200)) * (t > 3800 ? 1 : 0));
    if (t > 5600) memLayer.style.display = 'none';

    /* Movements 1-3 — altitude grows exponentially: just above cloud tops to
       far enough away that the planet becomes a coin. */
    const rise = seg(t, 4800, 27000);
    const alt = 0.004 * Math.pow(320, rise);       // 0.004 → ~4.5 radii
    const drift = rise * 1.05;
    const dir = startDir.clone().applyAxisAngle(up, drift * 0.85).normalize();
    camPos.copy(dir).multiplyScalar(1 + alt).addScaledVector(up, rise * 0.32);
    camera.position.copy(camPos);

    // look along the horizon at first, then slowly down at the planet's centre
    const horizon = camPos.clone()
      .add(sideDir.clone().applyAxisAngle(up, drift * 0.85).multiplyScalar(2.4))
      .addScaledVector(dir, -0.42);
    look.lerpVectors(horizon, new THREE.Vector3(0, 0, 0), seg(t, 9200, 23500));
    camera.up.set(0, 1, 0);
    camera.lookAt(look);

    // the whole shot breathes: tiny drift, widening with the climb
    const speed = Math.abs(alt - lastAlt); lastAlt = alt;
    const breathe = 0.0014 + Math.min(0.005, speed * 0.5);
    camera.rotateY(Math.sin(t * 0.00062) * breathe);
    camera.rotateX(Math.cos(t * 0.00081) * breathe * 0.75);

    // where the light is: the atmosphere dims as we climb out of it
    const inAir = clamp(1 - (alt - 0.05) / 0.55);
    atmo.material.uniforms && (atmo.material.uniforms.uDensity.value = 1.0 + inAir * 0.6);

    earth.rotation.y += 0.000035;
    clouds.rotation.y += 0.000055;
    starMat.uniforms.uTime.value = t * 0.001;
    // stars only become visible once the air is thin enough
    starMat.uniforms.uOpacity.value = 0.15 + 0.85 * clamp((alt - 0.02) / 0.35);

    // exposure opens up as the frame leaves the atmosphere
    renderer.toneMappingExposure = 0.86 + rise * 0.22;
    renderer.render(scene, camera);

    let text = '', ca = 0;
    for (const [a, b, s] of lines) if (t >= a && t <= b) { text = s; ca = Math.min(1, (t - a) / 1100, (b - t) / 1100); }
    if (caption.textContent !== text) caption.textContent = text;
    caption.style.opacity = ca.toFixed(3);

    if (t >= 25200 && !prepared) {
      prepared = true;
      const forward = new THREE.Vector3(); camera.getWorldDirection(forward);
      onPrepare?.({ pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z }, yaw: Math.atan2(forward.x, forward.z), pitch: Math.asin(forward.y) });
    }
    host.style.opacity = String(1 - seg(t, 26000, 28500));

    if (elapsed >= TOTAL) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return finish;
}
