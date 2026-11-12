/* Frame-rate independent drift; looking around never rotates momentum. */
(function (root) {
  const settings = Object.freeze({ acceleration: 3.2, drag: 0.025, brake: 2.8, maxSpeed: 12 });
  function step(velocity, thrust, basis, dt, braking = false) {
    const length = Math.max(1, Math.hypot(thrust.x, thrust.y));
    const active = Math.hypot(thrust.x, thrust.y) > 0;
    const rate = braking && !active ? settings.brake : settings.drag;
    const decay = Math.exp(-rate * dt);
    const impulse = (1 - decay) / rate;
    const movement = {};
    for (const axis of ["x", "y", "z"]) {
      const acceleration = (basis.f[axis] * thrust.y + basis.r[axis] * thrust.x) * settings.acceleration / length;
      const initial = velocity[axis];
      velocity[axis] = initial * decay + acceleration * impulse;
      movement[axis] = initial * impulse + acceleration * (dt - impulse) / rate;
    }
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    if (speed > settings.maxSpeed) {
      const scale = settings.maxSpeed / speed;
      for (const axis of ["x", "y", "z"]) { velocity[axis] *= scale; movement[axis] *= scale; }
    }
    if (braking && !active && speed < 0.015) {
      velocity.x = velocity.y = velocity.z = 0;
    }
    return { movement, braking: braking && !active && speed >= 0.015 };
  }
  const api = { settings, step };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CalmFlight = api;
})(typeof window !== "undefined" ? window : globalThis);
