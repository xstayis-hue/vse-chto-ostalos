const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { describe } = require('./memory-world.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('content.js', 'utf8'), context);
const lives = context.window.CURATED_LIVES;

test('photographic adults use calibrated head-to-sole scale, not miniature cutouts', () => {
  const { plateLayout } = require('./memory-world.js');
  for (const loc of ['hospital', 'kitchen', 'bedroom', 'school', 'office']) {
    const layout = plateLayout(loc);
    assert.ok(layout.height >= .78 && layout.height <= .9, loc);
    assert.ok(layout.feet <= 1 && layout.feet - layout.height >= 0, loc);
  }
});

test('all offered memories compile to distinct deterministic scene descriptions', () => {
  const signatures = new Set();
  for (const life of lives) for (let i = 0; i < life.memories.length; i++) {
    const scene = describe(life, i);
    assert.deepEqual(scene, describe(life, i));
    signatures.add(JSON.stringify({ loc: scene.loc, room: scene.room, camera: scene.camera, blocking: scene.blocking, identity: scene.identity }));
    assert.ok(Number.isFinite(scene.year));
    assert.ok(scene.camera.z > scene.blocking.z);
  }
  assert.equal(signatures.size, lives.length * 6);
});
test('one person keeps appearance and home materials across life stages', () => {
  for (const life of lives) {
    const birth = describe(life, 0);
    for (let i = 1; i < 6; i++) {
      const scene = describe(life, i);
      assert.deepEqual(scene.identity, birth.identity);
      assert.deepEqual(scene.home, birth.home);
      assert.equal(scene.loc, life.memories[i].loc);
      assert.equal(scene.prop, life.memories[i].prop);
    }
    assert.equal(describe(life, 5).age, 'none');
  }
});
test('ascent fallback completes when THREE is missing or WebGL creation fails', () => {
  const source = fs.readFileSync('ascent.js', 'utf8');
  for (const webglFailure of [false, true]) {
    let deferred, completed = 0, prepared = 0;
    const sandbox = { document: { createElement: () => ({ style: {} }) }, matchMedia: () => ({ matches: false }), setTimeout: f => { deferred = f; }, cancelAnimationFrame() {} };
    if (webglFailure) sandbox.THREE = { WebGLRenderer: function () { throw Error('unavailable'); } };
    vm.runInNewContext(source, sandbox);
    const stop = sandbox.playAscent({}, {}, () => completed++, () => prepared++);
    deferred(); stop();
    assert.equal(completed, 1); assert.equal(prepared, 1);
  }
});

test('every local photographic environment and life-stage cutout is bundled', () => {
  const { LOCATIONS } = require('./memory-world.js');
  for (const loc of LOCATIONS) assert.ok(fs.statSync(`assets/photographic/${loc}-plate.jpg`).size > 1000, loc);
  for (const gender of ['m', 'f']) for (const age of ['child', 'teen', 'adult', 'old']) {
    assert.ok(fs.statSync(`assets/photographic/${gender}-${age}-actor.jpg`).size > 1000);
  }
});
