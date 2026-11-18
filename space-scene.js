/* Space scene for «Всё, что от меня ОСТАЛОСЬ» — three.js r160 (UMD build).
   Target look: a planetarium render (Celestia-like), not a diagram.

   Pipeline: everything renders LINEAR into a half-float target, one ACES pass
   tonemaps and encodes to sRGB at the very end. That is why raw ShaderMaterials
   decode their sRGB textures by hand (`srgb` helper) — otherwise they would sit
   on a different response curve than MeshStandardMaterial and the Earth would
   read as a black disc next to a correct Saturn.

   Scene: one light at the origin.
   - Earth: day/night maps, clouds, ocean glint, one window still lit, Moon eclipse
   - Atmospheres: Rayleigh-ish limb, sun-side only, forward scatter
   - Rings: Cassini radial texture, planet shadow on rings, ring shadow on planet
   - Stars: real Hipparcos/BSC catalogue in the galactic frame, colour from B-V
   - Sun: granulation, spots, limb darkening, soft corona (no fake rays)
   - Post: HDR bright-pass bloom, speed chromatic aberration, vignette, eye adaptation
   - Asteroid belt and dust: small and dark, visible only when you get close. */
(function () {
  'use strict';

  const SRGB_FN = `
    vec3 srgb(vec3 c){ return mix(c * 0.0773993808, pow(max(c, vec3(0.04045)) * 0.9478672986 + 0.0521327014, vec3(2.4)), step(vec3(0.04045), c)); }
  `;

  // ---------- colour of a star from its B-V index ----------
  function bvToRgb(bv) {
    const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
    const k = t / 100;
    let r, g, b;
    if (k <= 66) { r = 255; g = 99.47 * Math.log(k) - 161.12; }
    else { r = 329.7 * Math.pow(k - 60, -0.1332); g = 288.12 * Math.pow(k - 60, -0.0755); }
    if (k >= 66) b = 255;
    else if (k <= 19) b = 0;
    else b = 138.52 * Math.log(k - 10) - 305.04;
    const c = [r, g, b].map((v) => Math.max(0, Math.min(255, v)) / 255);
    return c.map((v) => Math.pow(v, 2.1) * 0.85 + v * 0.15);
  }

  // ---------- star geometry from the catalogue ----------
  function catalogueStars(THREE, catalog, radius) {
    const count = Math.floor(catalog.length / 4);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const l = catalog[i * 4] * Math.PI / 180;
      const b = catalog[i * 4 + 1] * Math.PI / 180;
      const mag = catalog[i * 4 + 2];
      const bv = catalog[i * 4 + 3];
      const cb = Math.cos(b);
      // galactic frame, aligned with the equirect sky plate
      pos[i * 3] = cb * Math.cos(l) * radius;
      pos[i * 3 + 1] = -Math.sin(b) * radius;
      pos[i * 3 + 2] = cb * Math.sin(l) * radius;
      const rgb = bvToRgb(Math.max(-0.4, Math.min(2.0, bv)));
      const vis = Math.max(0.14, Math.min(1.5, Math.pow(10, -0.17 * (mag - 0.4))));
      col[i * 3] = rgb[0] * vis;
      col[i * 3 + 1] = rgb[1] * vis;
      col[i * 3 + 2] = rgb[2] * vis;
      // bright stars get a slightly larger point, faint ones stay at one pixel
      size[i] = Math.max(0.5, Math.min(3.4, 2.2 - mag * 0.3));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    return geo;
  }

  function starMaterial(THREE, scale) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1.0 }, uScale: { value: scale || 760 } },
      vertexShader: `
        attribute float size; varying vec3 vColor; uniform float uTime; uniform float uScale;
        void main(){
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float tw = 0.9 + 0.1 * sin(uTime * (0.6 + size * 0.8) + position.x * 0.02 + position.z * 0.013);
          gl_PointSize = clamp(size * tw * (uScale / max(-mv.z, 1.0)), 0.55, 4.6);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uOpacity; varying vec3 vColor;
        void main(){
          float d = length(gl_PointCoord - vec2(0.5));
          float a = smoothstep(0.5, 0.06, d);
          gl_FragColor = vec4(vColor, a * uOpacity);
        }`,
    });
  }

  // ---------- sun ----------
  function sunMaterial(THREE, surfaceTexture) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSurface: { value: surfaceTexture } },
      vertexShader: `
        varying vec3 vN; varying vec3 vP; varying vec2 vUv;
        void main(){
          vN = normalize(normalMatrix * normal); vP = position; vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float uTime; uniform sampler2D uSurface;
        varying vec3 vN; varying vec3 vP; varying vec2 vUv;
        ${SRGB_FN}
        float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float noise(vec3 p){
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
        void main(){
          // granulation cells: ~1/60 of the disc, so they read as texture, not noise
          vec3 p = vP * 6.0;
          float cellA = fbm(p * 5.0 + vec3(0.0, 0.0, uTime * 0.05));
          float cellB = fbm(p * 13.0 - vec3(uTime * 0.04, 0.0, 0.0));
          float lanes = fbm(p * 1.6 + vec3(3.0, uTime * 0.02, 1.0));
          float n = cellA * 0.46 + cellB * 0.34 + lanes * 0.20;
          // sunspots: rare, dark, with a soft penumbra
          float sp = fbm(vP * 2.2 + vec3(9.0, uTime * 0.01, 2.0));
          float spot = smoothstep(0.70, 0.80, sp) * 0.8;
          vec3 dark = vec3(0.62, 0.12, 0.015);
          vec3 mid = vec3(1.45, 0.55, 0.08);
          vec3 hot = vec3(2.55, 1.65, 0.62);
          vec3 col = mix(dark, mid, smoothstep(0.24, 0.50, n));
          col = mix(col, hot, smoothstep(0.46, 0.78, n) * 0.92);
          col *= 1.0 - spot;
          vec3 source = texture2D(uSurface, vUv + vec2(uTime * 0.0026, 0.0)).rgb;
          col = mix(col, source * vec3(1.7, 1.15, 0.5), 0.14);
          // limb darkening + hot chromosphere ring
          float mu = clamp(vN.z, 0.0, 1.0);
          float limb = 1.0 - 0.62 * (1.0 - pow(mu, 0.5));
          col *= mix(0.34, 1.0, limb);
          col += vec3(2.2, 0.75, 0.14) * pow(1.0 - mu, 5.0) * 0.55;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
  }

  function coronaMaterial(THREE) {
    return new THREE.ShaderMaterial({
      // depth-tested: the corona must never paint over a planet in front of the Sun
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }
        float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.05; a *= 0.5; } return s; }
        void main(){
          vec2 q = vUv - 0.5;
          float r = length(q) * 2.0;
          if (r > 1.0) discard;
          float ang = atan(q.y, q.x);
          // streamers live in the angle, so they fade into the dark instead of banding
          float s1 = fbm(vec2(ang * 1.8 + 3.0, r * 1.1 - uTime * 0.02));
          float s2 = fbm(vec2(ang * 4.2 - 2.0, r * 2.2 - uTime * 0.035));
          float stream = mix(0.7, 1.25, s1 * 0.6 + s2 * 0.4);
          float falloff = pow(max(0.0, 1.0 - r), 3.2);
          float a = falloff * stream * 0.9;
          vec3 col = mix(vec3(3.1, 1.0, 0.22), vec3(2.4, 1.7, 0.9), smoothstep(0.15, 0.75, r));
          gl_FragColor = vec4(col * a, a);
        }`,
    });
  }

  // ---------- Earth ----------
  function earthMaterial(THREE, tex, opts) {
    return new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: tex.day }, nightMap: { value: tex.night }, cloudMap: { value: tex.clouds },
        uOneLight: { value: new THREE.Vector2(opts.oneLight ? opts.oneLight[0] : 0.5059, opts.oneLight ? opts.oneLight[1] : 0.2285) },
        uMoonPos: { value: new THREE.Vector3(1e6, 1e6, 1e6) }, uMoonR: { value: 0.27 },
        uSunPos: { value: new THREE.Vector3(0, 0, 0) },
        uCloudShift: { value: new THREE.Vector2(0, 0) },
        uLight: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vView;
        void main(){
          vUv = uv;
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz;
          vView = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D cloudMap;
        uniform vec2 uOneLight; uniform vec2 uCloudShift;
        uniform vec3 uMoonPos; uniform float uMoonR;
        uniform vec3 uSunPos; uniform float uLight;
        varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vView;
        ${SRGB_FN}

        // the Moon really does cut a hole in the sunlight here
        float moonShadow(vec3 W, vec3 S){
          vec3 toM = uMoonPos - W;
          float along = dot(toM, S);
          if (along <= 0.0) return 1.0;
          float d = length(toM - S * along);
          float penumbra = smoothstep(uMoonR * 0.85, uMoonR * 2.4, d);
          return mix(0.18, 1.0, penumbra);
        }

        void main(){
          vec3 N = normalize(vN);
          vec3 V = normalize(vView);
          vec3 S = normalize(uSunPos - vW);
          float l = dot(N, S);
          float dayK = smoothstep(-0.06, 0.18, l);

          vec3 day = texture2D(dayMap, vUv).rgb;
          vec3 nightTex = texture2D(nightMap, vUv).rgb;
          float clouds = texture2D(cloudMap, vUv + uCloudShift).r;
          clouds = clamp((clouds - 0.1) * 1.7, 0.0, 1.0);

          // water is blue and dark; glint only where the sun specular lobe lands
          float water = smoothstep(0.02, 0.16, day.b - max(day.r, day.g) * 0.95);
          vec3 H = normalize(S + V);
          float spec = pow(max(dot(N, H), 0.0), 220.0) * water * (1.0 - clouds) * smoothstep(0.0, 0.3, l);
          float sheen = pow(max(dot(N, H), 0.0), 18.0) * water * (1.0 - clouds) * smoothstep(0.0, 0.4, l) * 0.05;

          // Lambert with a touch of wrapped light so the terminator is not a razor
          float lambert = max(l, 0.0);
          float wrap = max((l + 0.06) / 1.06, 0.0);
          vec3 lit = day * (0.010 + 1.05 * mix(lambert, wrap, 0.28)) * uLight;
          // clouds: bright at a high sun angle, grey toward the terminator
          vec3 cloudLight = vec3(0.94, 0.95, 0.98) * (0.012 + 1.15 * wrap) * uLight;
          lit = mix(lit, cloudLight, clouds * 0.9);
          lit += vec3(1.0, 0.96, 0.9) * (spec * 3.0 + sheen);

          // night side: city lights. Textures arrive already decoded by the GPU
          // (three.js uploads sRGB maps as SRGB8_ALPHA8 on WebGL2), so the raw
          // sample is linear and the ocean haze floor is small — 0.05 would zero it.
          vec3 nightClean = max(nightTex - vec3(0.0075, 0.0092, 0.0195), 0.0);
          // soft shoulder: dense clusters keep their shape instead of blowing out
          vec3 city = (nightClean * 16.0) / (1.0 + nightClean * 9.0) * vec3(1.18, 0.80, 0.46) * 2.6;
          vec2 d2 = (vUv - uOneLight) * vec2(1.0, 2.0);
          float nearOne = smoothstep(0.05, 0.0, length(d2));
          city *= 0.6 + 0.85 * nearOne;
          float glow = smoothstep(0.010, 0.0, length(d2));
          float halo = smoothstep(0.045, 0.0, length(d2));
          vec3 window = vec3(1.0, 0.76, 0.44) * (glow * 3.4 + halo * 0.18);
          // airglow: Earth's night sky is not pure black
          vec3 nightBase = day * vec3(0.012, 0.016, 0.026) + vec3(0.004, 0.008, 0.012);
          vec3 nightSide = nightBase + city + window;

          float shadow = moonShadow(vW, S);
          vec3 col = mix(nightSide, lit, dayK) * shadow;

          // a thin warm line where day meets night, then the blue limb
          col += vec3(1.1, 0.36, 0.10) * 0.045 * exp(-pow(l * 14.0, 2.0));
          float rim = pow(1.0 - max(dot(N, V), 0.0), 3.6);
          col += vec3(0.30, 0.52, 1.0) * rim * (0.06 + 0.9 * smoothstep(-0.2, 0.5, l));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
  }

  // ---------- atmospheres ----------
  function atmosphereMaterial(THREE, opts) {
    const c = opts.colors;
    return new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: new THREE.Vector3(-1, 0, 0) },
        uDensity: { value: opts.density || 1.0 },
        uCold: { value: new THREE.Vector3(c[0][0], c[0][1], c[0][2]) },
        uWarm: { value: new THREE.Vector3(c[1][0], c[1][1], c[1][2]) },
        uPower: { value: opts.power || 4.0 },
        uThickness: { value: opts.thickness || 1.0 },
        uNightGlow: { value: opts.night || 0.0 },
      },
      vertexShader: `
        varying vec3 vN; varying vec3 vW; varying vec3 vView;
        void main(){
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz; vView = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform vec3 uSunDir; uniform float uDensity;
        uniform vec3 uCold; uniform vec3 uWarm; uniform float uPower; uniform float uThickness;
        uniform float uNightGlow;
        varying vec3 vN; varying vec3 vW; varying vec3 vView;
        void main(){
          vec3 N = normalize(vN);
          vec3 V = normalize(vView);
          vec3 S = normalize(uSunDir);
          float mu = clamp(dot(N, V), 0.0, 1.0);
          float rim = pow(1.0 - mu, uPower) * uThickness;
          float sun = dot(N, S);
          float lit = smoothstep(-0.38, 0.42, sun);
          float forward = pow(clamp(dot(-V, S), 0.0, 1.0), 10.0);
          vec3 col = mix(uWarm, uCold, smoothstep(0.02, 0.62, sun));
          float a = rim * (0.06 + 1.15 * lit) * uDensity;
          // the forward-scatter glow exists only where the sun is behind the limb,
          // otherwise it paints a wide brown band across the terminator
          col += uCold * forward * rim * 1.1 * lit;
          // airglow on the night limb: a faint blue-green ring, the way Earth actually
          // looks from orbit when the sun is not touching it
          float nightGlow = (1.0 - lit) * uNightGlow;
          col = mix(col, vec3(0.30, 0.62, 0.72), nightGlow * 0.34);
          a += rim * nightGlow * 0.55;
          gl_FragColor = vec4(col * a, a);
        }`,
      side: THREE.FrontSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
  }

  // ---------- rings ----------
  function ringMaterial(THREE, texture, o) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uRing: { value: texture }, uCenter: { value: new THREE.Vector3() }, uRingN: { value: new THREE.Vector3(0, 1, 0) },
        uInner: { value: o.inner }, uOuter: { value: o.outer }, uPlanetR: { value: o.planetR },
        uSunPos: { value: new THREE.Vector3(0, 0, 0) },
        uBright: { value: 0.5 },
      },
      vertexShader: `
        varying vec3 vW; varying vec2 vLocal;
        void main(){
          vLocal = position.xy;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform sampler2D uRing; uniform vec3 uCenter; uniform vec3 uRingN;
        uniform float uInner; uniform float uOuter; uniform float uPlanetR;
        uniform vec3 uSunPos;
        uniform float uBright;
        varying vec3 vW; varying vec2 vLocal;
        ${SRGB_FN}
        void main(){
          float r = length(vLocal);
          float u = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
          vec4 t = texture2D(uRing, vec2(u, 0.5));
          float density = t.a;
          if (density < 0.008) discard;
          vec3 base = mix(vec3(0.52, 0.48, 0.42), vec3(1.15, 1.10, 1.0), t.r);
          vec3 S = normalize(uSunPos - vW);
          vec3 V = normalize(cameraPosition - vW);

          // planet shadow on the rings: the sun is occluded by the globe
          float shade = 1.0;
          float denom = dot(uRingN, S);
          if (abs(denom) > 1e-4) {
            float tHit = dot(uCenter - vW, uRingN) / denom;
            if (tHit > 0.0) {
              vec3 q = vW + S * tHit;
              float rr = length(q - uCenter);
              shade = smoothstep(uPlanetR * 0.92, uPlanetR * 1.10, rr);
              shade = mix(0.03, 1.0, shade);
            }
          }
          // ring particles scatter forward hard: backlit rings glow, front-lit are dimmer
          float back = pow(clamp(dot(-V, S), 0.0, 1.0), 1.7);
          float ndl = abs(dot(uRingN, S));
          // ice is bright even at grazing angles; keep a readable floor
          float diffuse = 0.22 + 0.55 * sqrt(clamp(ndl, 0.0, 1.0));
          vec3 col = base * diffuse * shade;
          col += base * back * 0.9 * density * shade;
          gl_FragColor = vec4(col * uBright, clamp(density * (0.72 + 0.28 * shade), 0.0, 1.0));
        }`,
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });
  }

  // ---------- gas-giant banding ----------
  function addGasFlow(material, THREE, opts) {
    const uniforms = { uFlowTime: { value: 0 }, uGRS: { value: new THREE.Vector2(opts.grs[0], opts.grs[1]) }, uSwirl: { value: opts.swirl || 1 } };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uFlowTime = uniforms.uFlowTime;
      shader.uniforms.uGRS = uniforms.uGRS;
      shader.uniforms.uSwirl = uniforms.uSwirl;
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform float uFlowTime; uniform vec2 uGRS; uniform float uSwirl;\nvoid main() {')
        .replace('#include <map_fragment>', `
          vec2 flowUv = vMapUv;
          flowUv.x += sin(flowUv.y * 52.0 + uFlowTime * 0.10) * 0.0008;
          flowUv.x += sin(flowUv.y * 15.0 - uFlowTime * 0.05) * 0.0013;
          vec2 gr = flowUv - uGRS; gr.y *= 2.2;
          float gd = length(gr);
          float swirl = exp(-gd * 9.0) * uSwirl;
          flowUv += normalize(gr + vec2(1e-5)) * swirl * 0.005;
          vec4 sampledDiffuseColor = texture2D( map, flowUv );
          diffuseColor *= sampledDiffuseColor;
        `);
    };
    material.customProgramCacheKey = () => 'gasflow' + opts.grs[0];
    return uniforms;
  }

  // ---------- ring shadow cast on the planet ----------
  function addRingShadow(material, THREE, ringInfo) {
    const uniforms = {
      uRingTex: { value: ringInfo.texture }, uRingC: { value: ringInfo.center },
      uRingN: { value: ringInfo.normal }, uRingIn: { value: ringInfo.inner }, uRingOut: { value: ringInfo.outer },
    };
    const prev = material.onBeforeCompile;
    material.onBeforeCompile = (shader) => {
      if (prev) prev(shader);
      shader.uniforms.uRingTex = uniforms.uRingTex;
      shader.uniforms.uRingC = uniforms.uRingC;
      shader.uniforms.uRingN = uniforms.uRingN;
      shader.uniforms.uRingIn = uniforms.uRingIn;
      shader.uniforms.uRingOut = uniforms.uRingOut;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRingW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvRingW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vRingW;
          uniform sampler2D uRingTex; uniform vec3 uRingC; uniform vec3 uRingN;
          uniform float uRingIn; uniform float uRingOut;
          float ringShadow(vec3 W){
            vec3 S = normalize(-W);
            float dn = dot(uRingN, S);
            if (abs(dn) < 1e-4) return 1.0;
            float tHit = dot(uRingC - W, uRingN) / dn;
            if (tHit <= 0.0) return 1.0;
            vec3 q = W + S * tHit;
            float rr = length(q - uRingC);
            if (rr < uRingIn || rr > uRingOut) return 1.0;
            float u = (rr - uRingIn) / (uRingOut - uRingIn);
            return 1.0 - 0.92 * texture2D(uRingTex, vec2(u, 0.5)).a;
          }`)
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb *= ringShadow(vRingW);');
    };
    material.customProgramCacheKey = () => 'ringshadow';
    return uniforms;
  }

  // ---------- post: linear HDR -> ACES -> bloom -> sRGB ----------
  function makePost(THREE, renderer, W, H) {
    const opts = { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false };
    const rtScene = new THREE.WebGLRenderTarget(W, H, opts);
    const halfW = Math.max(64, Math.round(W / 2)), halfH = Math.max(64, Math.round(H / 2));
    const rtA = new THREE.WebGLRenderTarget(halfW, halfH, { type: THREE.HalfFloatType, depthBuffer: false });
    const rtB = new THREE.WebGLRenderTarget(halfW, halfH, { type: THREE.HalfFloatType, depthBuffer: false });
    const quadScene = new THREE.Scene();
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    quad.frustumCulled = false;
    quadScene.add(quad);

    const bright = new THREE.ShaderMaterial({
      uniforms: { tex: { value: rtScene.texture }, uThreshold: { value: 0.9 }, uKnee: { value: 0.45 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tex; uniform float uThreshold; uniform float uKnee; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tex, vUv).rgb;
          float l = max(c.r, max(c.g, c.b));
          float soft = clamp((l - uThreshold + uKnee) / (2.0 * uKnee), 0.0, 1.0);
          float w = max(l - uThreshold, 0.0) + soft * soft * uKnee * 0.5;
          gl_FragColor = vec4(c * (w / max(l, 1e-4)), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    const blur = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uTexel: { value: new THREE.Vector2(1 / halfW, 1 / halfH) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tex; uniform vec2 uDir; uniform vec2 uTexel; varying vec2 vUv;
        void main(){
          vec2 s = uTexel * uDir;
          vec3 c = texture2D(tex, vUv).rgb * 0.227027;
          c += (texture2D(tex, vUv + s * 1.3846).rgb + texture2D(tex, vUv - s * 1.3846).rgb) * 0.316216;
          c += (texture2D(tex, vUv + s * 3.2308).rgb + texture2D(tex, vUv - s * 3.2308).rgb) * 0.070270;
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    const composite = new THREE.ShaderMaterial({
      uniforms: {
        tex: { value: rtScene.texture }, bloom: { value: rtB.texture },
        uBloom: { value: 0.62 }, uSpeed: { value: 0 }, uVignette: { value: 0.34 }, uExposure: { value: 1.0 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tex; uniform sampler2D bloom; uniform float uBloom; uniform float uSpeed;
        uniform float uVignette; uniform float uExposure; varying vec2 vUv;
        vec3 tonemap(vec3 x){
          // ACES fitted curve (Narkowicz)
          x *= 0.6;
          return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
        }
        vec3 toSRGB(vec3 c){
          c = max(c, vec3(0.0));
          return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
        }
        void main(){
          vec2 d = vUv - 0.5;
          float k = 0.0016 * uSpeed;
          vec3 c;
          c.r = texture2D(tex, vUv + d * k).r;
          c.g = texture2D(tex, vUv).g;
          c.b = texture2D(tex, vUv - d * k).b;
          vec3 b = texture2D(bloom, vUv).rgb;
          c = tonemap((c + b * uBloom) * uExposure);
          float v = 1.0 - uVignette * dot(d, d) * 1.1;
          c *= clamp(v, 0.0, 1.0);
          gl_FragColor = vec4(toSRGB(c), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });

    function setSize(w, h) {
      rtScene.setSize(w, h);
      const hw = Math.max(64, Math.round(w / 2)), hh = Math.max(64, Math.round(h / 2));
      rtA.setSize(hw, hh); rtB.setSize(hw, hh);
      blur.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    }
    function pass(material, target) {
      quad.material = material;
      renderer.setRenderTarget(target);
      renderer.render(quadScene, quadCam);
    }
    function render(scene, camera) {
      renderer.setRenderTarget(rtScene);
      renderer.clear();
      renderer.render(scene, camera);
      pass(bright, rtA);
      blur.uniforms.tex.value = rtA.texture;
      blur.uniforms.uDir.value.set(1.0, 0.0); pass(blur, rtB);
      blur.uniforms.tex.value = rtB.texture;
      blur.uniforms.uDir.value.set(0.0, 1.0); pass(blur, rtA);
      blur.uniforms.tex.value = rtA.texture;
      blur.uniforms.uDir.value.set(1.0, 0.0); pass(blur, rtB);
      pass(composite, null);
    }
    return { render, setSize, composite, bright, dispose() { rtScene.dispose(); rtA.dispose(); rtB.dispose(); } };
  }

  // ---------- the scene ----------
  function build(opts) {
    const THREE = opts.THREE;
    const canvas = opts.canvas, stage = opts.stage;
    const coarse = !!opts.coarse;
    const BODIES = opts.BODIES;
    const quality = { dprCap: coarse ? 1.25 : 2, level: coarse ? 'balanced' : 'high', starOpacity: 1.0 };

    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dprCap));
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // tonemapping happens in the composite pass, not per material
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.domElement.className = 'space-webgl';
    canvas.insertAdjacentElement('beforebegin', renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, stage.clientWidth / stage.clientHeight, 0.02, 6000);
    const loader = new THREE.TextureLoader();
    const srgb = (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; };
    const load = (src) => srgb(loader.load(src));

    // --- sky: real Milky Way mosaic, tilted so the band is not level ---
    const skyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2400, 64, 40),
      new THREE.MeshBasicMaterial({ map: load('assets/milky-way-real-4k.jpg'), side: THREE.BackSide, color: 0xffffff })
    );
    skyMesh.rotation.set(0.42, 0.9, -0.62);
    scene.add(skyMesh);

    // --- stars: real catalogue, same tilt as the plate ---
    const starGroup = new THREE.Group();
    starGroup.rotation.copy(skyMesh.rotation);
    const starMat = starMaterial(THREE, 760);
    let starPoints = null;
    if (opts.catalog && opts.catalog.length > 40) {
      starPoints = new THREE.Points(catalogueStars(THREE, opts.catalog, 1600), starMat);
      starPoints.frustumCulled = false;
      starGroup.add(starPoints);
    }
    scene.add(starGroup);

    // --- sun ---
    const sunMat = sunMaterial(THREE, load('assets/sun-api-candidate.jpg'));
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), sunMat);
    sunMesh.position.set(0, 0, 0); sunMesh.scale.setScalar(12);
    scene.add(sunMesh);
    // The corona is a quad only slightly wider than the disc. A big quad is a big
    // occluder problem: with the Sun behind a planet, its glow bled across the globe.
    const corona = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), coronaMaterial(THREE));
    corona.renderOrder = 2;
    scene.add(corona);
    // outer halo: a soft sprite, depth-tested, only for the blinding spill near the disc
    const haloCanvas = document.createElement('canvas'); haloCanvas.width = haloCanvas.height = 256;
    const hctx = haloCanvas.getContext('2d');
    const hg = hctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    hg.addColorStop(0, 'rgba(255,236,190,0.55)'); hg.addColorStop(0.18, 'rgba(255,190,110,0.20)');
    hg.addColorStop(0.45, 'rgba(255,150,70,0.06)'); hg.addColorStop(1, 'rgba(255,120,40,0)');
    hctx.fillStyle = hg; hctx.fillRect(0, 0, 256, 256);
    const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(haloCanvas), transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending,
    }));
    sunHalo.renderOrder = 3;
    scene.add(sunHalo);

    scene.add(new THREE.AmbientLight(0x2e3d4d, 0.10));
    const light = new THREE.PointLight(0xfff3e0, 2.6, 0, 0);
    light.position.set(0, 0, 0);
    scene.add(light);

    // --- bodies ---
    const names = { 'ЗЕМЛЯ': 'earth', 'ЛУНА': 'moon', 'МЕРКУРИЙ': 'mercury', 'ВЕНЕРА': 'venus', 'МАРС': 'mars', 'ЮПИТЕР': 'jupiter', 'САТУРН': 'saturn', 'УРАН': 'uranus', 'НЕПТУН': 'neptune' };
    const geometry = new THREE.SphereGeometry(1, 128, 80);
    const meshes = [];
    const extra = {};

    const earthTex = { day: load('assets/earth.jpg'), night: load('assets/earth-night.jpg'), clouds: load('assets/earth-clouds.jpg') };
    const earthMat = earthMaterial(THREE, earthTex, { oneLight: opts.oneLight });
    const cloudTexture = srgb(loader.load('assets/earth-clouds.jpg'));
    const earthCloudMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      map: cloudTexture, transparent: true, opacity: 0.72, depthWrite: false, roughness: 1, metalness: 0, color: 0xffffff,
      alphaMap: cloudTexture,
    }));
    earthCloudMesh.scale.setScalar(1.004);
    scene.add(earthCloudMesh);

    const atmoSpecs = {
      'ЗЕМЛЯ': { colors: [[0.22, 0.50, 1.15], [1.15, 0.42, 0.14]], density: 1.05, power: 5.2, thickness: 0.05, scale: 1.016, night: 0.30 },
      'ВЕНЕРА': { colors: [[1.15, 0.92, 0.62], [1.05, 0.70, 0.36]], density: 1.5, power: 3.0, thickness: 0.075, scale: 1.048 },
      'МАРС': { colors: [[0.95, 0.68, 0.52], [0.85, 0.50, 0.28]], density: 0.5, power: 4.8, thickness: 0.045, scale: 1.022 },
      'УРАН': { colors: [[0.42, 0.86, 0.95], [0.34, 0.72, 0.86]], density: 0.9, power: 3.8, thickness: 0.055, scale: 1.032 },
      'НЕПТУН': { colors: [[0.30, 0.52, 1.15], [0.22, 0.42, 0.95]], density: 0.9, power: 3.8, thickness: 0.055, scale: 1.032 },
    };
    const atmoMeshes = {};

    const ringTexture = srgb(loader.load('assets/saturn-ring.png'));
    ringTexture.wrapS = THREE.ClampToEdgeWrapping; ringTexture.wrapT = THREE.ClampToEdgeWrapping;

    const gasUniforms = {};

    for (const body of BODIES) {
      const key = names[body.name];
      let material, mesh;
      if (body.name === 'СОЛНЦЕ') { meshes.push(sunMesh); continue; }
      if (body.name === 'ЗЕМЛЯ') {
        material = earthMat;
        mesh = new THREE.Mesh(geometry, material);
        extra.earth = mesh;
        extra.earthCloud = earthCloudMesh;
      } else {
        const texture = load(`assets/${key}.jpg`);
        // farther out, the sunlight is genuinely weaker: 1/r², softened so it stays readable
        const orbit = Math.hypot(body.x, body.z) || 120;
        const falloff = Math.max(0.42, Math.min(1.1, Math.pow(120 / orbit, 0.42)));
        material = new THREE.MeshStandardMaterial({
          map: texture, roughness: key === 'moon' ? 1 : 0.9, metalness: 0,
          color: new THREE.Color(falloff, falloff * 0.99, falloff * 0.96),
        });
        mesh = new THREE.Mesh(geometry, material);
        if (body.name === 'ЮПИТЕР' || body.name === 'САТУРН') {
          gasUniforms[body.name] = addGasFlow(material, THREE, body.name === 'ЮПИТЕР'
            ? { grs: opts.grs || [0.375, 0.613], swirl: 1.0 }
            : { grs: [0.7, 0.4], swirl: 0.12 });
        }
      }
      mesh.position.set(body.x, body.y, body.z);
      mesh.scale.setScalar(body.r);
      scene.add(mesh);
      meshes.push(mesh);

      const spec = atmoSpecs[body.name];
      if (spec) {
        const atmo = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), atmosphereMaterial(THREE, spec));
        atmo.scale.setScalar(body.r * spec.scale);
        atmo.position.copy(mesh.position);
        scene.add(atmo);
        atmoMeshes[body.name] = atmo;
      }
    }

    // Saturn rings
    let rings = null, ringShader = null;
    const saturnIndex = BODIES.findIndex((b) => b.name === 'САТУРН');
    if (saturnIndex >= 0) {
      const saturn = BODIES[saturnIndex];
      const inner = saturn.r * 1.24, outer = saturn.r * 2.30;
      const ringGeo = new THREE.RingGeometry(inner, outer, 512, 8);
      ringShader = ringMaterial(THREE, ringTexture, { inner, outer, planetR: saturn.r });
      ringShader.uniforms.uBright.value = 0.5;
      rings = new THREE.Mesh(ringGeo, ringShader);
      rings.rotation.x = Math.PI / 2 - 0.47;   // Saturn's real 26.7° axial tilt
      rings.rotation.z = 0.10;
      rings.position.set(saturn.x, saturn.y, saturn.z);
      rings.renderOrder = 1;
      scene.add(rings);
      const n = new THREE.Vector3(0, 0, 1).applyEuler(rings.rotation).normalize();
      ringShader.uniforms.uRingN.value.copy(n);
      ringShader.uniforms.uCenter.value.set(saturn.x, saturn.y, saturn.z);
      const saturnMaterial = meshes[saturnIndex]?.material;
      if (saturnMaterial) {
        addRingShadow(saturnMaterial, THREE, {
          texture: ringTexture, center: ringShader.uniforms.uCenter.value,
          normal: ringShader.uniforms.uRingN.value, inner, outer,
        });
      }
      extra.rings = rings;
    }

    // moons with their own surfaces
    const moonGroup = new THREE.Group();
    scene.add(moonGroup);
    const moonDefs = [
      { parent: 'ЗЕМЛЯ', key: 'moon', r: 0.09, d: 1.9, speed: 0.4, tilt: 0.16 },
      { parent: 'МАРС', key: 'moon', r: 0.035, d: 1.0, speed: 0.9, tilt: 0.2 },
      { parent: 'ЮПИТЕР', key: 'io', r: 0.30, d: 9.4, speed: 0.62 },
      { parent: 'ЮПИТЕР', key: 'europa', r: 0.26, d: 11.6, speed: 0.48 },
      { parent: 'ЮПИТЕР', key: 'ganymede', r: 0.43, d: 14.4, speed: 0.36 },
      { parent: 'ЮПИТЕР', key: 'callisto', r: 0.39, d: 17.8, speed: 0.27 },
      { parent: 'САТУРН', key: 'moon', r: 0.22, d: 8.6, speed: 0.5 },
      { parent: 'САТУРН', key: 'titan', r: 0.44, d: 13.4, speed: 0.32, haze: true },
      { parent: 'УРАН', key: 'ganymede', r: 0.16, d: 4.6, speed: 0.6 },
      { parent: 'НЕПТУН', key: 'triton', r: 0.20, d: 4.2, speed: 0.55 },
    ];
    const moons = moonDefs.map((m, i) => {
      const parentMesh = meshes[BODIES.findIndex((b) => b.name === m.parent)];
      const texture = load(`assets/moons/${m.key}.jpg`);
      texture.wrapS = THREE.RepeatWrapping;
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0, color: 0x9a9a96 }));
      mesh.scale.setScalar(m.r);
      moonGroup.add(mesh);
      let haze = null;
      if (m.haze) {
        haze = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), atmosphereMaterial(THREE, {
          colors: [[1.05, 0.70, 0.38], [0.95, 0.55, 0.26]], density: 2.4, power: 2.0, thickness: 0.09, scale: 1.0,
        }));
        haze.scale.setScalar(m.r * 1.05);
        moonGroup.add(haze);
      }
      return { mesh, haze, parentMesh, d: m.d, speed: m.speed, phase: i * 1.37, tilt: m.tilt || 0.16 };
    });

    // asteroid belt: small, dark, numerous — reads as a field, not as floating rocks.
    // The far half of the belt sits thousands of units away, where a lit pebble still
    // covers two pixels; those are shrunk and dulled by distance in the shader instead
    // of being drawn as brown squares.
    const beltGeo = new THREE.IcosahedronGeometry(1, 1);
    const beltMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, flatShading: true });
    const beltCount = coarse ? 900 : 2200;
    const belt = new THREE.InstancedMesh(beltGeo, beltMat, beltCount);
    belt.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    let seed = 20261113;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const pos = new THREE.Vector3();
    const sc = new THREE.Vector3();
    for (let i = 0; i < beltCount; i++) {
      const a = rnd() * Math.PI * 2;
      const radius = 200 + rnd() * 95;   // between Mars (182) and Jupiter (336)
      const y = (rnd() - 0.5) * (rnd() < 0.88 ? 7 : 19);
      const s = 0.05 + Math.pow(rnd(), 5.0) * 0.9;
      pos.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
      eul.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
      q.setFromEuler(eul);
      sc.set(s, s * (0.55 + rnd() * 0.7), s * (0.55 + rnd() * 0.8));
      m4.compose(pos, q, sc);
      belt.setMatrixAt(i, m4);
      // darker rock, a few brighter ice shards: albedo variation is what stops
      // the belt reading as one flat brown mass. Keep it near-black — a lit pebble
      // at 200 units still covers pixels, and bright albedo turns the belt into grit.
      const tone = 0.035 + Math.pow(rnd(), 2.4) * 0.10;
      belt.setColorAt(i, new THREE.Color(tone, tone * 0.94, tone * 0.86));
    }
    belt.instanceColor.needsUpdate = true;
    belt.instanceMatrix.needsUpdate = true;
    belt.frustumCulled = false;
    scene.add(belt);

    // dust around the traveller: parallax, and a sense of moving through something
    const dustCount = coarse ? 140 : 300;
    const dustPos = new Float32Array(dustCount * 3);
    const dustGeo = new THREE.BufferGeometry();
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (rnd() - 0.5) * 40;
      dustPos[i * 3 + 1] = (rnd() - 0.5) * 40;
      dustPos[i * 3 + 2] = (rnd() - 0.5) * 40;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0x8b9aa2, size: 0.045, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    // The belt is a real field of real rocks, so it must not be visible from Earth
    // as a band of specks. Fade it out while the traveller is still near the start.
    belt.visible = false;
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);

    // station: dead, but still catching light
    const station = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x8a918b, roughness: 0.72, metalness: 0.65 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1d2b3a, roughness: 0.42, metalness: 0.75 });
    const truss = new THREE.Mesh(new THREE.BoxGeometry(9, 0.35, 0.35), metal);
    const module = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 24), metal);
    module.rotation.z = Math.PI / 2;
    const panels = [-3.3, 3.3].flatMap((x) => [-0.85, 0.85].map((z) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.03, 1.3), panelMat); p.position.set(x, 0, z); return p;
    }));
    station.add(truss, module, ...panels);
    // the station is a real object at real scale, not a sub-pixel speck: this is a game-scale planet
    station.scale.setScalar(0.0016);
    scene.add(station);
    const glintCanvas = document.createElement('canvas'); glintCanvas.width = glintCanvas.height = 32;
    const gx = glintCanvas.getContext('2d');
    const glintGrad = gx.createRadialGradient(16, 16, 0, 16, 16, 16);
    glintGrad.addColorStop(0, 'rgba(235,242,238,1)'); glintGrad.addColorStop(0.4, 'rgba(235,242,238,0.3)'); glintGrad.addColorStop(1, 'rgba(235,242,238,0)');
    gx.fillStyle = glintGrad; gx.fillRect(0, 0, 32, 32);
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glintCanvas), transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glint.scale.setScalar(0.05);
    glint.material.opacity = 0.4;
    scene.add(glint);

    let post = null;
    try { post = makePost(THREE, renderer, renderer.domElement.width, renderer.domElement.height); }
    catch (e) { console.warn('post-processing недоступен', e); renderer.toneMapping = THREE.ACESFilmicToneMapping; }

    // ---------- per-frame ----------
    let exposure = 1.0;
    let cloudDrift = 0;
    let earthSpin = 2.1;

    function update(o) {
      const t = o.t;
      camera.position.set(o.cam.pos.x, o.cam.pos.y, o.cam.pos.z);
      if (o.B) camera.lookAt(o.cam.pos.x + o.B.f.x, o.cam.pos.y + o.B.f.y, o.cam.pos.z + o.B.f.z);
      if (o.jitterY || o.jitterP) { camera.rotateY(o.jitterY || 0); camera.rotateX(o.jitterP || 0); }
      if (o.fov && Math.abs(camera.fov - o.fov) > 0.01) { camera.fov = o.fov; camera.updateProjectionMatrix(); }

      skyMesh.position.copy(camera.position);
      starGroup.position.copy(camera.position);
      starMat.uniforms.uTime.value = t;
      starMat.uniforms.uOpacity.value = quality.starOpacity * (1 - 0.55 * (o.sunOnScreen || 0));

      sunMat.uniforms.uTime.value = t;
      corona.material.uniforms.uTime.value = t;
      corona.quaternion.copy(camera.quaternion);
      corona.position.set(0, 0, 0);
      // the halo is a screen-facing sprite on the Sun itself
      sunHalo.position.set(0, 0, 0);
      const sunDist = Math.hypot(o.cam.pos.x, o.cam.pos.y, o.cam.pos.z);
      const nearSun = Math.max(0, 1 - sunDist / 420);
      sunHalo.scale.setScalar(12 * (2.4 + nearSun * 5.2));
      sunHalo.material.opacity = 0.35 + nearSun * 0.5;

      cloudDrift += (o.dt || 0.016) * 0.0016;
      if (cloudDrift > 1) cloudDrift -= 1;

      // плавное вращение Земли: медленнее, чем кажется, но уже читается как планета
      earthSpin += (o.dt || 0.016) * 0.0106;
      if (earthSpin > Math.PI * 2) earthSpin -= Math.PI * 2;
      for (let i = 0; i < BODIES.length; i++) {
        const b = BODIES[i], mesh = meshes[i];
        if (!mesh || b.sun) continue;
        mesh.position.set(b.x, b.y, b.z);
        const spin = (b.name === 'ЮПИТЕР' || b.name === 'САТУРН') ? 0.030 : 0.006;
        mesh.rotation.y = b.name === 'ЗЕМЛЯ' ? earthSpin : t * spin;
        mesh.rotation.z = b.name === 'УРАН' ? 1.71 : 0;
        const atmo = atmoMeshes[b.name];
        if (atmo) {
          atmo.position.copy(mesh.position);
          atmo.material.uniforms.uSunDir.value.set(-b.x, -b.y, -b.z).normalize();
        }
      }
      if (extra.earthCloud) {
        extra.earthCloud.position.copy(extra.earth.position);
        extra.earthCloud.rotation.copy(extra.earth.rotation);
        extra.earthCloud.rotation.y += cloudDrift * 0.06;
      }
      earthMat.uniforms.uSunPos.value.set(0, 0, 0);
      earthMat.uniforms.uMoonPos.value.set(opts.MOON.x, opts.MOON.y, opts.MOON.z);
      earthMat.uniforms.uMoonR.value = opts.MOON.r;
      earthMat.uniforms.uCloudShift.value.set(cloudDrift * 0.06, 0);
      earthMat.uniforms.uLight.value = 1.0;

      if (rings) {
        rings.position.set(BODIES[saturnIndex].x, BODIES[saturnIndex].y, BODIES[saturnIndex].z);
        ringShader.uniforms.uCenter.value.copy(rings.position);
      }
      for (const k in gasUniforms) gasUniforms[k].uFlowTime.value = t;

      for (const m of moons) {
        const a = m.phase + t * m.speed;
        const px = m.parentMesh.position.x, py = m.parentMesh.position.y, pz = m.parentMesh.position.z;
        m.mesh.position.set(px + Math.cos(a) * m.d, py + Math.sin(a) * 0.35 + m.d * m.tilt * 0.1, pz + Math.sin(a) * m.d);
        m.mesh.rotation.y = t * 0.02 + m.phase;
        if (m.haze) m.haze.position.copy(m.mesh.position);
      }

      belt.rotation.y = t * 0.0035;
      // the belt is only worth seeing from nearby; from Earth's orbit it is a row of
      // specks that reads as noise, not rock
      const beltDist = Math.abs(Math.hypot(o.cam.pos.x, o.cam.pos.z) - 248);
      belt.visible = quality.level !== 'economy' && beltDist < 55;

      // dust wraps around the camera: it streams past instead of following
      const dp = dustGeo.attributes.position.array;
      const lim = 20;
      for (let i = 0; i < dustCount; i++) {
        const ix = i * 3;
        const dx = dp[ix] - o.cam.pos.x, dy = dp[ix + 1] - o.cam.pos.y, dz = dp[ix + 2] - o.cam.pos.z;
        if (dx > lim) dp[ix] -= lim * 2; else if (dx < -lim) dp[ix] += lim * 2;
        if (dy > lim) dp[ix + 1] -= lim * 2; else if (dy < -lim) dp[ix + 1] += lim * 2;
        if (dz > lim) dp[ix + 2] -= lim * 2; else if (dz < -lim) dp[ix + 2] += lim * 2;
      }
      dustGeo.attributes.position.needsUpdate = true;
      dustMat.opacity = Math.min(0.42, 0.03 + (o.speed || 0) * 0.042);

      const sa = t * 0.25;
      const earthBody = opts.EARTH;
      station.position.set(earthBody.x + Math.cos(sa) * 1.9, earthBody.y + 0.35, earthBody.z + Math.sin(sa) * 1.9);
      station.rotation.y = -sa;
      glint.position.copy(station.position);

      // eye adaptation: looking into the sun stops the eye down
      const targetExposure = 1.05 - 0.5 * (o.sunOnScreen || 0);
      exposure += (targetExposure - exposure) * Math.min(1, (o.dt || 0.016) * 1.6);

      if (post) {
        post.composite.uniforms.uSpeed.value = Math.min(1, (o.speed || 0) / 9);
        post.composite.uniforms.uBloom.value = 0.5 + Math.max(0, 1 - sunDist / 240) * 0.45;
        post.composite.uniforms.uExposure.value = exposure;
        post.composite.uniforms.uVignette.value = 0.30 + 0.16 * Math.min(1, (o.speed || 0) / 10);
        post.render(scene, camera);
      } else {
        renderer.render(scene, camera);
      }
    }

    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      post?.setSize(renderer.domElement.width, renderer.domElement.height);
    }

    function setQuality(level) {
      quality.level = level;
      quality.dprCap = level === 'economy' ? 1 : level === 'balanced' ? 1.25 : (coarse ? 1.25 : 2);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dprCap));
      quality.starOpacity = level === 'economy' ? 0.7 : level === 'balanced' ? 0.88 : 1.0;
      belt.visible = level !== 'economy';
      resize();
    }

    function dispose() {
      scene.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m) return;
          m.map?.dispose(); m.alphaMap?.dispose(); m.bumpMap?.dispose();
          Object.values(m.uniforms || {}).forEach((u) => { if (u.value?.isTexture) u.value.dispose(); });
          m.dispose();
        });
      });
      post?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }

    return {
      renderer, scene, camera, meshes, quality, setQuality, update, resize, dispose,
      starField: starPoints, starMaterial: starMat, sunUniforms: sunMat.uniforms, rings, moons,
      nebulaSprites: [],
    };
  }

  window.SpaceScene = { build, earthMaterial, atmosphereMaterial, bvToRgb };
})();
