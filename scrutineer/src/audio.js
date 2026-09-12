// ============================================================================
// SCR.audio — the car, synthesised.
//
// No samples and no files: the page already draws its own pixels with a software rasterizer,
// so it makes its own noise the same way. Everything here is driven by the car's own state —
// the engine note is its speed through its gearbox, the tyres are the load it is carrying
// through a corner, the rush is how fast it is going — so the sound cannot drift out of step
// with the picture, because there is nothing to drift.
//
// Nothing is created until the listener asks for it: browsers refuse to start audio without a
// gesture, and a page that makes noise before you ask deserves to be closed.
// ============================================================================
(function (SCR) {
'use strict';
const A = SCR.audio = {};

// A V6 firing three times a revolution, idling at 3,200 and running to 12,000.
const IDLE_RPM = 3200, MAX_RPM = 12000, FIRE_PER_REV = 3;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const st = {
  ctx: null, on: false, master: null, nodes: null,
  gear: 1, rpm: IDLE_RPM, lastSpeed: 0, shift: 0, suspended: false,
  // What the last update decided. Web Audio parameters are eased toward a target rather than
  // set, so reading a node's .value tells you where it is, not where it was asked to go — and
  // in a suspended context it never moves at all. Recording the targets is the only way to
  // check this without listening to it.
  want: { fund: 0, gear: 1, rpm: IDLE_RPM, engine: 0, cutoff: 0, tyre: 0, wind: 0, brake: 0, gun: 0, road: 0, master: 0 },
  cues: 0,
};

function noiseBuffer(ctx) {
  const n = Math.floor(ctx.sampleRate * 2), buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // value-noise rather than pure white: a little correlated, so it reads as rush and grain
  // instead of a hiss off a broken television
  let last = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = last * 0.22 + w * 0.78; d[i] = last; }
  return buf;
}

function build(ctx) {
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  // A little air on everything, so it sits in a room instead of against your ear.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 22; comp.ratio.value = 3.5;
  comp.attack.value = 0.008; comp.release.value = 0.22;
  comp.connect(master);

  // ---- engine ------------------------------------------------------------------------------
  // Two detuned sawtooths through a lowpass is, almost exactly, the definition of a buzz. An
  // engine is not a bright waveform played loudly; it is a warm one with the upper harmonics
  // already gone. This wave rolls off far faster than a saw's 1/n, which is what takes the
  // edge off, and a sine an octave down carries the weight the harmonics used to.
  const real = new Float32Array([0, 1, 0.55, 0.30, 0.16, 0.09, 0.05, 0.03]);
  const wave = ctx.createPeriodicWave(real, new Float32Array(real.length), { disableNormalization: false });

  const engGain = ctx.createGain(); engGain.gain.value = 0;
  const engFilt = ctx.createBiquadFilter(); engFilt.type = 'lowpass';
  engFilt.frequency.value = 700; engFilt.Q.value = 1.4;      // Q 6 was ringing, which is the whine
  engFilt.connect(engGain); engGain.connect(comp);

  const osc = ctx.createOscillator(); osc.setPeriodicWave(wave);
  const oscG = ctx.createGain(); oscG.gain.value = 0.55;
  osc.connect(oscG); oscG.connect(engFilt); osc.start();

  const sub = ctx.createOscillator(); sub.type = 'sine';
  const subG = ctx.createGain(); subG.gain.value = 0.4;
  sub.connect(subG); subG.connect(engFilt); sub.start();

  // a slow wander on the tuning, so it breathes rather than sitting dead still
  const drift = ctx.createOscillator(), driftG = ctx.createGain();
  drift.type = 'sine'; drift.frequency.value = 0.27; driftG.gain.value = 7;
  drift.connect(driftG); driftG.connect(osc.detune); drift.start();

  const nb = noiseBuffer(ctx);
  const mkNoise = (type, freq, q, dest) => {
    const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    if (q !== undefined) f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(dest || comp); src.start();
    return { f, g };
  };
  const tyre = mkNoise('bandpass', 1150, 1.1);   // the load through a corner
  const wind = mkNoise('lowpass', 520);          // the rush of going fast
  const brake = mkNoise('highpass', 2600);       // only with speed to scrub
  const road = mkNoise('lowpass', 170);          // surface under the car: body, not buzz
  const gun = mkNoise('bandpass', 2300, 3);      // the wheel gun in the box

  const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
  lfo.type = 'square'; lfo.frequency.value = 26; lfoGain.gain.value = 1;
  lfo.connect(lfoGain); lfoGain.connect(gun.g.gain); lfo.start();

  // ---- cues: short sounds for things that happen, rather than things that continue ----------
  const cueBus = ctx.createGain(); cueBus.gain.value = 1; cueBus.connect(comp);

  return { master, comp, engGain, engFilt, osc, sub, tyre, wind, brake, road, gun, cueBus, nb };
}

// Every parameter is eased rather than set, or the whole thing clicks on every frame.
const ramp = (p, v, t, tau) => { try { p.setTargetAtTime(v, t, tau); } catch (e) { p.value = v; } };

// ---------------------------------------------------------------------------------------
// Cues. The continuous voices are the car; these are the loop. An interface landing clean, a
// gate passing, a change being kept — the things this whole page exists to show — each get a
// sound, so you can follow the run with your eyes somewhere else.
// ---------------------------------------------------------------------------------------
const CUES = {
  // name        wave      from  to    len   level  type
  shift:      { w: 'square',   f0: 520, f1: 300, len: 0.07, g: 0.045 },
  pageOk:     { w: 'sine',     f0: 780, f1: 1180, len: 0.09, g: 0.075 },
  pageBad:    { w: 'triangle', f0: 300, f1: 190, len: 0.11, g: 0.065 },
  gateOk:     { w: 'sine',     f0: 1040, f1: 1040, len: 0.06, g: 0.055 },
  gateBad:    { w: 'sawtooth', f0: 260, f1: 130, len: 0.26, g: 0.07 },
  lap:        { w: 'sine',     f0: 660, f1: 990, len: 0.14, g: 0.05 },
  drs:        { w: 'sine',     f0: 420, f1: 820, len: 0.18, g: 0.035 },
};
// A kept change deserves more than a blip: three notes, rising, because something got better.
const CHORDS = { kept: [523.25, 659.25, 987.77], refused: [523.25, 415.30, 311.13] };

function blip(spec, when, detune) {
  const ctx = st.ctx, n = st.nodes; if (!ctx || !n) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = spec.w; o.frequency.setValueAtTime(spec.f0, when);
  if (spec.f1 !== spec.f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, spec.f1), when + spec.len);
  if (detune) o.detune.value = detune;
  // a short percussive envelope; anything squarer than this clicks
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(spec.g, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + spec.len);
  o.connect(g); g.connect(n.cueBus);
  o.start(when); o.stop(when + spec.len + 0.02);
}

// name: any key of CUES, or 'kept' / 'refused'
A.cue = function (name) {
  if (!st.on || !st.ctx || !st.nodes) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  const t = st.ctx.currentTime;
  st.cues++;
  const chord = CHORDS[name];
  if (chord) {
    chord.forEach((f, i) => blip({ w: 'sine', f0: f, f1: f, len: 0.42, g: 0.06 }, t + i * 0.085));
    return;
  }
  const spec = CUES[name]; if (!spec) return;
  blip(spec, t);
};

A.available = () => !!(window.AudioContext || window.webkitAudioContext);
A.isOn = () => st.on;

// Only ever called from a click, which is the only time a browser will allow it.
A.enable = function () {
  if (!A.available()) return false;
  if (!st.ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    st.ctx = new Ctor();
    st.nodes = build(st.ctx);
  }
  if (st.ctx.state === 'suspended') st.ctx.resume();
  st.on = true;
  return true;
};

A.disable = function () {
  st.on = false;
  if (st.nodes) ramp(st.nodes.master.gain, 0, st.ctx.currentTime, 0.05);
};

A.toggle = function () { if (st.on) { A.disable(); return false; } return A.enable(); };

// o: { active, speed, topSpeed, gears, braking, drs, steer, pit, lift }
A.update = function (o, dt) {
  if (!st.on || !st.ctx || !st.nodes) return;
  const ctx = st.ctx, n = st.nodes, t = ctx.currentTime;
  // A tab in the background should not be making engine noise.
  const hidden = typeof document !== 'undefined' && document.hidden;
  if (hidden !== st.suspended) {
    st.suspended = hidden;
    if (hidden) ctx.suspend(); else ctx.resume();
  }
  if (hidden) return;

  if (!o || !o.active) { ramp(n.master.gain, 0, t, 0.08); st.want.master = 0; return; }
  ramp(n.master.gain, 0.5, t, 0.15); st.want.master = 0.5;

  const top = Math.max(20, o.topSpeed || 70), gears = Math.max(4, o.gears || 6);
  const speed = Math.max(0, o.speed || 0);

  // Where the car is in its gearbox. The pitch falling back on every upshift is the whole
  // character of the sound, and it comes out of the model rather than being faked.
  const band = top / gears;
  const gear = clamp(Math.ceil(speed / band) || 1, 1, gears);
  const frac = clamp((speed - (gear - 1) * band) / band, 0, 1);
  if (gear !== st.gear) { if (gear > st.gear) A.cue('shift'); st.shift = 1; st.gear = gear; }
  st.shift = Math.max(0, st.shift - dt * 7);

  const rpm = IDLE_RPM + frac * (MAX_RPM - IDLE_RPM);
  st.rpm = rpm;
  const fund = rpm / 60 * FIRE_PER_REV;

  ramp(n.osc.frequency, fund, t, 0.035);
  ramp(n.sub.frequency, fund / 2, t, 0.035);
  st.want.fund = fund; st.want.gear = gear; st.want.rpm = rpm;

  // Throttle is inferred from what the car is doing, because that is what you can hear: gaining
  // speed is on the power, losing it is on the brakes, holding it is neither.
  const dv = (speed - st.lastSpeed) / Math.max(dt, 1e-3);
  st.lastSpeed = speed;
  const throttle = o.braking ? 0 : clamp(dv / 12 + 0.45, 0, 1);

  // A shift cuts the note for a moment; so does the pit limiter, which flattens it.
  const limiter = o.pit ? 0.55 : 1;
  const load = (0.16 + 0.5 * frac + 0.34 * throttle) * limiter * (1 - 0.8 * st.shift);
  // Was 0.5 at full song, which is twice everything else put together — so the only thing you
  // could hear was the engine, and the only thing the engine was doing was buzzing.
  st.want.engine = speed < 0.6 ? 0.03 : load * 0.22;
  st.want.cutoff = (300 + 2600 * throttle + 1500 * frac) * limiter;
  ramp(n.engGain.gain, st.want.engine, t, 0.04);
  ramp(n.engFilt.frequency, st.want.cutoff, t, 0.05);

  // Tyres: lateral load. steer stands in for curvature — it is derived from it — so this rises
  // through a corner and falls on the straight without needing the circuit.
  const lat = speed * Math.abs(o.steer || 0);
  // Fitted to the real distribution rather than guessed: over full laps the load runs 0 to 9.4
  // with a median of 1.7, so silent below 3 (which is most of a straight), rising through a
  // corner, and full in the hardest of them. The guessed numbers peaked at a fifth of the level
  // they should have, which is to say inaudible.
  st.want.tyre = clamp((lat - 3.0) / 6.0, 0, 1) * 0.20;
  ramp(n.tyre.g.gain, st.want.tyre, t, 0.07);

  // The rush of going fast, which is most of what you hear from outside a car.
  const vr = speed / top;
  st.want.wind = vr * vr * 0.12;
  ramp(n.wind.g.gain, st.want.wind, t, 0.09);
  // Surface under the car. Low and wide: it gives the engine a body to sit on, which is what
  // was missing when the engine was on its own.
  st.want.road = vr * 0.085;
  ramp(n.road.g.gain, st.want.road, t, 0.08);
  ramp(n.road.f.frequency, 120 + vr * 150, t, 0.1);
  ramp(n.wind.f.frequency, 320 + vr * 900, t, 0.09);

  // Brakes only sing when there is speed to scrub off.
  st.want.brake = (o.braking && speed > 14) ? 0.05 : 0;
  ramp(n.brake.g.gain, st.want.brake, t, 0.05);

  // The wheel gun, only while the car is stationary in the box.
  st.want.gun = (o.pit === 'stopped' && speed < 1) ? 0.11 : 0;
  ramp(n.gun.g.gain, st.want.gun, t, 0.02);
};

A.diag = () => ({ available: A.available(), on: st.on,
  state: st.ctx ? st.ctx.state : 'none',
  gear: st.want.gear, rpm: Math.round(st.want.rpm), fundamentalHz: Math.round(st.want.fund),
  cutoffHz: Math.round(st.want.cutoff),
  cues: st.cues,
  gain: { master: +st.want.master.toFixed(3), engine: +st.want.engine.toFixed(3),
          tyre: +st.want.tyre.toFixed(3), wind: +st.want.wind.toFixed(3),
          brake: +st.want.brake.toFixed(3), road: +st.want.road.toFixed(3),
          gun: +st.want.gun.toFixed(3) } });
})(window.SCR = window.SCR || {});
