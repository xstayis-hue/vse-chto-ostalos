const assert = require('node:assert/strict');
const { test } = require('node:test');
const { step, settings } = require('./flight.js');
const basis = { f: { x: 0, y: 0, z: 1 }, r: { x: 1, y: 0, z: 0 } };
function simulate(fps, seconds, thrust, velocity = { x: 0, y: 0, z: 0 }, braking = false) {
  for (let i = 0; i < fps * seconds; i++) step(velocity, thrust, basis, 1 / fps, braking);
  return velocity;
}
test('acceleration agrees at 30, 60 and 120 FPS', () => {
  const speeds = [30, 60, 120].map(fps => simulate(fps, 2, { x: 0, y: 1 }).z);
  assert.ok(Math.max(...speeds) - Math.min(...speeds) < 1e-9);
});
test('released input preserves a long drift', () => {
  const v = simulate(60, 10, { x: 0, y: 0 }, { x: 0, y: 0, z: 5 });
  assert.ok(v.z > 3.8 && v.z < 4);
});
test('peace brakes smoothly, then stops', () => {
  const v = { x: 0, y: 0, z: 5 };
  step(v, { x: 0, y: 0 }, basis, 1 / 60, true);
  assert.ok(v.z > 0 && v.z < 5);
  simulate(60, 4, { x: 0, y: 0 }, v, true);
  assert.equal(v.z, 0);
});
test('diagonal input does not exceed straight acceleration', () => {
  const v = simulate(60, 2, { x: 1, y: 1 });
  const straight = simulate(60, 2, { x: 0, y: 1 });
  assert.ok(Math.abs(Math.hypot(v.x, v.z) - straight.z) < 1e-9);
});
test('speed remains bounded and fresh thrust cancels braking', () => {
  const v = simulate(60, 60, { x: 0, y: 1 });
  assert.ok(v.z <= settings.maxSpeed);
  assert.equal(step(v, { x: 0, y: 1 }, basis, 1 / 60, true).braking, false);
});
test('looking away does not redirect coasting velocity', () => {
  const v = { x: 0, y: 0, z: 5 };
  step(v, { x: 0, y: 0 }, { f: basis.r, r: basis.f }, 1, false);
  assert.equal(v.x, 0);
  assert.ok(v.z > 0);
});
