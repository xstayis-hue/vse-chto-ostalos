/* The dying-consciousness frame.

   Everything between the first memory and the space screen happens inside one
   person's head in the last seconds of life. That is a structural fact, not a
   caption: it decides what the player is allowed to see and hear.

   What this module owns:
     - the flicker: as the life goes on, the present-tense frame loses signal
       (blur, dropped contrast, a pulse of the heartbeat that slows down)
     - the heartbeat: one slow thump, getting slower and further apart
     - the last three seconds: the frame starts to close on the space screen
       before the ascent, so leaving the body is one continuous movement
     - the recorder: the small line at the bottom that is the mind noticing itself

   It is deliberately small and dependency-free: no build step, no globals other
   than `DyingFrame`. */
(function (root) {
  'use strict';

  const state = { started: false, beat: 0, bpm: 64, audio: null, lastBeat: 0 };

  /* Heartbeat: two low thumps, quieter as the life runs out. Built from an
     oscillator pair rather than a sample, so it never loads from disk and can
     slow down continuously. */
  function ensureAudio(ctx, destination) {
    if (state.audio || !ctx) return state.audio;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(destination);
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sine'; osc.frequency.value = 52;
    sub.type = 'sine'; sub.frequency.value = 34;
    filter.type = 'lowpass'; filter.frequency.value = 140; filter.Q.value = 0.8;
    gain.gain.value = 0.0;
    osc.connect(gain); sub.connect(gain); gain.connect(filter); filter.connect(out);
    osc.start(); sub.start();
    state.audio = { out, osc, sub, gain, filter };
    return state.audio;
  }

  function thump(volume) {
    const ctx = state.ctx;
    const a = state.audio;
    if (!ctx || !a) return;
    const now = ctx.currentTime;
    a.out.gain.cancelScheduledValues(now);
    a.out.gain.setValueAtTime(Math.max(0.0001, volume), now);
    a.out.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    a.gain.gain.cancelScheduledValues(now);
    a.gain.gain.setValueAtTime(0.9, now);
    a.gain.gain.exponentialRampToValueAtTime(0.05, now + 0.5);
    a.osc.frequency.setValueAtTime(56, now);
    a.osc.frequency.exponentialRampToValueAtTime(38, now + 0.35);
  }

  /* Called once when the memory sequence starts. `progress` runs 0 → 1 across the
     whole life; the heartbeat slows and the frame closes as it approaches 1. */
  function attach(ctx, destination) {
    state.ctx = ctx;
    ensureAudio(ctx, destination);
    state.started = true;
    state.beat = 0;
    state.bpm = 64;
    return state;
  }

  /* Applies the flicker to the host element.
     Only the room and the body text lose focus: the scripture stays sharp and
     underlined, because that line was not remembered, it was known. */
  function frame(host, progress, muted) {
    if (!host) return;
    const p = Math.max(0, Math.min(1, progress));
    const blur = p * 1.4;
    const desat = 0.74 - p * 0.42;
    const drop = 1.02 - p * 0.2;
    host.style.setProperty('--dying', p.toFixed(3));
    host.style.setProperty('--dying-blur', blur.toFixed(2) + 'px');
    host.style.setProperty('--dying-sat', desat.toFixed(2));
    host.style.setProperty('--dying-bright', drop.toFixed(2));
    if (muted) return;
    // heartbeat slows: 64 bpm at birth, 34 bpm in the last room
    const bpm = 64 - p * 30;
    const period = 60000 / bpm;
    const now = performance.now();
    if (now - state.lastBeat > period) {
      state.lastBeat = now;
      thump(0.32 * (1 - p * 0.55));
    }
  }

  /* The last three seconds: the frame starts to close before the ascent takes
     over, so the white of the departure grows out of the memory rather than
     cutting to it. Returns opacity for the closing overlay. */
  function closing(elapsed, duration) {
    const left = Math.max(0, duration - elapsed);
    return Math.max(0, Math.min(1, 1 - left / 3000));
  }

  /* The line the mind says about itself, in the first person, without naming
     the mechanism. Shown sparingly: on the first beat and on the last. */
  const NOTICES = [
    'это не я вспоминаю. это вспоминается во мне.',
    'я не знаю, сколько это длится.',
    'я ещё здесь.',
  ];

  root.DyingFrame = { attach, frame, closing, thump, NOTICES, get state() { return state; } };
})(typeof window !== 'undefined' ? window : globalThis);
