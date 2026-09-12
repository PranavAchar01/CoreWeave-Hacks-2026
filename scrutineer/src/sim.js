// ============================================================================
// SCR.sim — lap physics driven by the derived spec and team multipliers, lap prediction, sparks
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine, S = SCR.sim = {};
const cornerSpeed = (k, dd, wearF) => Math.sqrt(dd.cornerG * wearF / Math.max(Math.abs(k), 0.0015));
// physics(c, dd, sp, circuit, dt, opts) ; opts: {fx: sparks array, noise: fn()->[-1,1] for driver variance, timeNow}
S.physics = function (c, dd, sp, circ, dt, opts = {}) {
  const LAP = circ.len, at = circ.at, STEP = circ.step;
  const wearF = Math.max(0.8, 1 - dd.wear * c.lapsDone);
  const learnF = 1 + Math.min(0.06, (dd.learn || 0) * c.lapsDone);            // data department: the car learns the sealed circuit lap by lap
  const i = Math.floor(c.s / STEP), f = (c.s / STEP) - i, a = at(i), b = at(i + 1);
  const curv = a.curv + (b.curv - a.curv) * f;
  const drsZone = sp.drs && Math.abs(curv) < 0.003 && c.speed > 36;
  c.drsOn = drsZone; c.drsAngle += ((drsZone ? 0.75 : 0) - c.drsAngle) * Math.min(1, dt * 8);
  const top = dd.topSpeed + (drsZone ? dd.drsBoost : 0);
  const jitter = opts.noise ? 1 + opts.noise() * 0.06 * (1 - Math.min(1, dd.consistency)) : 1;   // driver inconsistency (tyre & performance role)
  let vAllow = Math.min(top, cornerSpeed(curv, dd, wearF) * learnF * jitter);
  for (let d = 6; d <= 130; d += 6) { const kk = at(Math.floor((c.s + d) / STEP)).curv; const va2 = Math.min(top, cornerSpeed(kk, dd, wearF) * learnF); vAllow = Math.min(vAllow, Math.sqrt(va2 * va2 + 2 * dd.braking * d)); }
  const prev = c.speed;
  if (c.speed < vAllow) c.speed = Math.min(vAllow, c.speed + dd.accel * (1 - 0.8 * c.speed / top) * dt); else c.speed = Math.max(vAllow, c.speed - dd.braking * dt);
  c.braking = c.speed < prev - 1e-6; c.topSeen = Math.max(c.topSeen || 0, c.speed);
  const sBefore = c.s; c.s += c.speed * dt;
  const secNow = Math.floor(c.s / LAP * 3);
  if (secNow !== c.sector && c.s < LAP) { const tNow = (opts.timeNow ?? E.time); c.sectorTimes[c.sector] = tNow - (c.sectorStart ?? c.lapStart); c.sectorStart = tNow; }
  if (c.s >= LAP) { c.s -= LAP; c.lap++; c.lapsDone++; const tNow = (opts.timeNow ?? E.time), lt = tNow - c.lapStart; c.sectorTimes[2] = tNow - (c.sectorStart ?? c.lapStart); c.lastLapSectors = c.sectorTimes.slice(0, 3); c.lapTimes.push(lt); c.last = lt; c.best = c.best === null ? lt : Math.min(c.best, lt); c.lapStart = tNow; c.sectorStart = tNow; c.sectorTimes = []; }
  c.x = a.x + (b.x - a.x) * f; c.z = a.z + (b.z - a.z) * f; c.y = 0;
  const tx = a.tx + (b.tx - a.tx) * f, tz = a.tz + (b.tz - a.tz) * f; c.yaw = Math.atan2(tx, tz);
  c.steer = Math.max(-0.35, Math.min(0.35, curv * 22));
  c.roll += ((-curv * 9 * (c.speed / dd.topSpeed)) - c.roll) * Math.min(1, dt * 6);
  c.pitch += (((c.speed - prev) / Math.max(dt, 1e-3)) * -0.0012 - c.pitch) * Math.min(1, dt * 5);
  c.spin += c.speed / SCR.car.R_R * dt; c.fanSpin += c.speed * 0.6 * dt; c.sector = Math.min(2, secNow);
  void sBefore;
  if (opts.fx && c.braking && c.speed > 30) for (let k = 0; k < 3; k++) { const side = k % 2 ? 1 : -1, nx = -tz, nz = tx, n = opts.fx.length;
    opts.fx.push({ x: c.x + nx * side * 0.6 - tx * 1.5, y: 0.05, z: c.z + nz * side * 0.6 - tz * 1.5, vx: -tx * (8 + E.hash2(n, 1) * 6) + nx * side * (E.hash2(n, 2) * 3), vy: 1 + E.hash2(n, 3) * 2, vz: -tz * (8 + E.hash2(n, 4) * 6) + nz * side * (E.hash2(n, 5) * 3), life: 0.25 + E.hash2(n, 6) * 0.25 }); }
};
S.stepSparks = function (fx, dt) { for (let k = fx.length - 1; k >= 0; k--) { const s = fx[k]; s.life -= dt; if (s.life <= 0) { fx.splice(k, 1); continue; } s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vy -= 9.8 * dt; if (s.y < 0) { s.y = 0; s.vy *= -0.3; } } };
S.drawSparks = function (R, fx) { const W = E.hex('#FFFFFF'), G = E.hex('#F4C542'); for (const s of fx) R.drawPoint(s.x, s.y, s.z, s.life > 0.2 ? W : G); };
// headless lap from a flying start; returns seconds. tm = team multipliers
S.predictLap = function (sp, circ, tm) { const dd = SCR.car.derive(sp, tm), c = SCR.car.newState(); c.speed = 30; let t = 0; for (let n = 0; n < 20000 && c.lap === 1; n++) { S.physics(c, dd, sp, circ, 0.02, { timeNow: t }); t += 0.02; } return t; };
S.fmt = t => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
S.fmt3 = t => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(3)}`; };
S.fmtD = d => (d <= 0 ? '−' : '+') + Math.abs(d).toFixed(2) + 's';
})(window.SCR = window.SCR || {});
