// ============================================================================
// SCR.trackScene — cars lapping a circuit with broadcast cameras.
//
// The director is deliberately not a fixed rota. Every session rolls its own camera
// personality and every cut rolls its own framing, so two runs of the same circuit are
// never covered the same way — which is what a real world feed looks like.
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine, TS = SCR.trackScene = {};
TS.MODES = ['AUTO', 'CHASE', 'ONBOARD', 'TV', 'HELI', 'APEX', 'DETAIL', 'PITLANE', 'STUDIO'];

// The showcase shot. The car is the harness, so every part of it belongs to a component, and
// this walks the camera round them one at a time while the car keeps lapping. Offsets are in
// car-local metres: x right, y up, z forward.
const DETAIL_PARTS = TS.DETAIL_PARTS = [
  { part: 'frontWing', label: 'FRONT WING',  key: 'AERO',
    look: [0, 0.28, 2.0],      cam: [1.5, 0.78, 3.5] },
  { part: 'rearWing',  label: 'REAR WING',   key: 'AERO',
    look: [0, 0.86, -1.9],     cam: [1.6, 1.35, -3.7] },
  { part: 'floor',     label: 'FLOOR',       key: 'DATA',
    look: [0, 0.16, -0.1],     cam: [2.5, 0.52, 0.5] },
  { part: 'engine',    label: 'POWER UNIT',  key: 'POWER_UNIT',
    look: [0, 0.68, -1.15],    cam: [1.9, 1.25, -2.5] },
  { part: 'tyres',     label: 'TYRES',       key: 'TYRES',
    look: [0.86, 0.36, -1.88], cam: [2.7, 0.82, -2.5] },
  { part: 'drs',       label: 'DRS',         key: 'SIMULATOR',
    look: [0, 0.92, -1.95],    cam: [1.2, 1.15, -3.9] },
  { part: 'brakes',    label: 'BRAKES',      key: 'PIT_CREW',
    look: [0.86, 0.36, 1.72],  cam: [2.6, 0.8, 2.6] },
];

// Shots the director can call, with how often it reaches for each and how long it holds.
// APEX and TV are hard cuts; CHASE and HELI are moves, so the camera glides into them.
const SHOTS = {
  TV:      { w: 3.2, min: 4.0, max: 7.0, cut: true },
  CHASE:   { w: 2.8, min: 5.0, max: 9.0, cut: false },
  HELI:    { w: 1.7, min: 6.0, max: 10.0, cut: false },
  ONBOARD: { w: 1.4, min: 3.5, max: 6.0, cut: true },
  APEX:    { w: 1.6, min: 3.0, max: 5.0, cut: true },
  DETAIL:  { w: 1.8, min: 3.4, max: 5.2, cut: true },
};
const SHOT_KEYS = Object.keys(SHOTS);

// Frame-rate independent exponential smoothing. min(1, dt*lag) overshoots on a long frame
// and undershoots on a short one, which is most of why the camera snapped through corners.
const K = (lag, dt) => 1 - Math.exp(-lag * dt);
// shortest-arc angle lerp, so a heading crossing ±π does not whip the camera round
const angLerp = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };

// create({R, world, car(state), ghost?, seed?}) -> scene
TS.create = function (o) {
  const R = o.R;
  const rng = E.mulberry32((o.seed === undefined ? 1 : o.seed) | 0);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => lerp(a, b, rng());
  // The session's own way of covering a race, rolled once: how close it likes to sit, how high
  // it likes to fly, how long it holds a shot.
  const style = { tight: rng(), high: rng(), patient: rng() };

  const sc = {
    world: o.world, circ: o.world.circuit, car: o.car, ghost: o.ghost || null, ghostActive: false,
    mode: 'AUTO', activeTV: -1, label: 'CAM · CHASE', fx: [], orbit: 0.9, style, studioDist: o.studioDist || 5.4,
    smooth: { x: 0, y: 3, z: -10, tx: 0, ty: 0, tz: 0, fov: 40, init: false },
    // low-passed track state: the raw values step every 4 m of circuit, and stepping is what
    // made the corners feel rough
    filt: { curv: 0, head: 0, init: false },
    dir: { shot: 'CHASE', t: 0, dur: 6, prev: '', shape: {} },
  };
  const cam = R.cam;
  sc.setWorld = w => { sc.world = w; sc.circ = w.circuit; sc.activeTV = -1;
    sc.smooth.init = false; sc.filt.init = false; sc.pairS = undefined; };

  const tvDist = k => { let d = sc.world.tvcams[k].s - sc.car.s; if (d > sc.circ.len / 2) d -= sc.circ.len; if (d < -sc.circ.len / 2) d += sc.circ.len; return d; };
  function tvPick() {
    const cams = sc.world.tvcams; if (!cams.length) return -1;
    // a camera looking at the back of a grandstand column is not a shot; cut to chase instead
    const usable = k => (cams[k].clear === undefined ? 1 : cams[k].clear) > 0.55;
    if (sc.activeTV >= 0 && sc.activeTV < cams.length && usable(sc.activeTV)) { const d = tvDist(sc.activeTV); if (d > -70 && d < 110) return sc.activeTV; }
    let best = -1, bd = 1e9; for (let k = 0; k < cams.length; k++) { if (!usable(k)) continue; const d = tvDist(k); if (d >= -8 && d < 110 && d < bd) { bd = d; best = k; } } if (best >= 0) return best;
    for (let k = 0; k < cams.length; k++) { if (!usable(k)) continue; const d = tvDist(k); if (d < 0 && d > -70 && -d < bd) { bd = -d; best = k; } } if (best >= 0) return best;
    // The cameras sit on the corners, so the gap between two of them can be longer than the
    // approach window. Take the nearest usable one rather than silently falling back to chase,
    // which is why trackside shots almost never appeared.
    // Prefer a clean sightline and enough distance to be a shot rather than a close-up of a
    // barrier; fall back to plain nearest only if nothing qualifies.
    let bs = -1;
    for (let k = 0; k < cams.length; k++) { if (!usable(k)) continue;
      const d = Math.abs(tvDist(k)); if (d < 25) continue;
      const score = (cams[k].clear === undefined ? 1 : cams[k].clear) * 200 - d * 0.35;
      if (score > bs) { bs = score; best = k; } }
    if (best >= 0) return best;
    bd = 1e9;
    for (let k = 0; k < cams.length; k++) { if (!usable(k)) continue; const d = Math.abs(tvDist(k)); if (d < bd) { bd = d; best = k; } }
    return best;
  }

  // Every cut re-rolls the framing inside the shot's own range, nudged by the session's style.
  function frameShot(shot) {
    const s = {};
    if (shot === 'CHASE') {
      s.dist = rand(7.0, 11.5) - style.tight * 2.2;
      s.height = rand(2.5, 4.4) + style.high * 0.9;
      s.swing = rand(18, 34);            // how far the camera leans out of a corner
      s.ahead = rand(3.6, 6.4);
      s.fov = rand(39, 47);
      s.lag = rand(5.0, 8.0);
    } else if (shot === 'HELI') {
      s.height = rand(24, 40) + style.high * 12;
      s.back = rand(15, 30);
      s.side = rand(8, 22) * (rng() < 0.5 ? -1 : 1);
      s.fov = rand(33, 42);
      s.lag = rand(2.2, 3.6);
    } else if (shot === 'ONBOARD') {
      s.height = rand(1.18, 1.46);
      s.fov = rand(58, 72);
      s.lag = rand(24, 44);
    } else if (shot === 'DETAIL') {
      // Walk the parts in order rather than at random, so watching for a while shows you the
      // whole car instead of the front wing four times.
      sc.detailAt = (sc.detailAt === undefined ? Math.floor(rng() * DETAIL_PARTS.length) : sc.detailAt + 1);
      s.spec = DETAIL_PARTS[sc.detailAt % DETAIL_PARTS.length];
      s.side = rng() < 0.5 ? -1 : 1;       // either flank
      s.fov = rand(34, 46);
      s.lag = 55;                          // effectively bolted to the car
    } else if (shot === 'APEX') {
      // low and long, planted on the inside of a corner the car has not reached yet
      s.ahead = Math.round(rand(9, 26));
      s.height = rand(0.6, 1.7);
      s.fov = rand(17, 33);
      s.lag = rand(10, 18);
      s.side = 0;                        // resolved against the circuit when the shot is taken
      s.anchor = null;
    }
    return s;
  }

  function callShot(force) {
    const d = sc.dir, prev = d.shot;
    let shot = force;
    if (!shot) {
      let total = 0; const w = {};
      // While the old harness is close enough to frame alongside, reach for the two shots that
      // can hold both cars. The comparison is the point of the ghost, and it is no use if the
      // director is on a T-cam while it happens.
      const duel = sc.ghostActive && sc.pairS > 4;
      for (const k of SHOT_KEYS) {
        w[k] = k === prev ? 0 : SHOTS[k].w * (duel && (k === 'CHASE' || k === 'HELI') ? 2.6 : 1);
        total += w[k];
      }
      let r = rng() * total;
      shot = SHOT_KEYS[SHOT_KEYS.length - 1];
      for (const k of SHOT_KEYS) { r -= w[k]; if (r <= 0) { shot = k; break; } }
    }
    // PITLANE (and STUDIO) are not shots the director calls for itself; they are held for as
    // long as whatever asked for them needs, so they are not in the weighted table.
    const spec = SHOTS[shot] || { min: 6, max: 10, cut: true };
    d.prev = prev; d.shot = shot; d.t = 0; d.fresh = true;
    d.dur = lerp(spec.min, spec.max, rng()) * (0.85 + style.patient * 0.4);
    d.shape = frameShot(shot);
    if (spec.cut) { sc.smooth.init = false; sc.activeTV = shot === 'TV' ? -1 : sc.activeTV; }
    if (shot === 'APEX') {
      // pick the corner ahead, and stand on its inside
      const i0 = Math.floor(sc.car.s / sc.circ.step);
      let bi = i0 + d.shape.ahead, bk = 0;
      for (let q = 4; q < 46; q++) { const kk = Math.abs(sc.circ.at(i0 + q).curv); if (kk > bk) { bk = kk; bi = i0 + q; } }
      const side = sc.circ.geomInside(bi);
      // Stand well back from the racing line. At three metres off it a car at sixty metres a
      // second sweeps past at nearly four hundred degrees a second, which is not a shot, it is
      // a smear. Twenty to forty metres out keeps the pan readable. Clamped by however much
      // room there is beside the track, so the camera never ends up inside a grandstand.
      const RW = SCR.world.ROAD_W;
      const room = sc.circ.room ? sc.circ.room(bi, side) : 40;
      const want = RW + 14 + rng() * 20;
      const off = Math.max(RW + 6, Math.min(want, room - 2));
      const p = sc.circ.pos(bi, side * off, d.shape.height);
      d.shape.anchor = p;
      d.shape.minD = 1e9;
    }
  }
  callShot('CHASE');

  sc.updateCamera = function (dt) {
    const car = sc.car, circ = sc.circ, d = sc.dir;
    let mode = sc.mode;
    if (sc.mode === 'AUTO') {
      d.t += dt;
      if (d.t > d.dur) callShot();
      mode = d.shot;
    } else if (sc.mode !== 'STUDIO' && d.shot !== sc.mode) {
      callShot(sc.mode);
    }
    const shape = d.shape || {};

    // How far behind the ghost is, and therefore how much room the shot needs. Taken raw this
    // was the worst jerk in the whole director: the moment the gap crossed the cut-off, or the
    // ghost was put back on the line, it fell from ninety metres to nothing in a single frame
    // and threw the camera the length of a straight. Capped so the pullback stays a shot, and
    // low-passed so it eases in and out.
    let pairRaw = 0;
    if (sc.ghostActive && sc.ghost) {
      let gd = car.s - sc.ghost.s;
      if (gd > circ.len / 2) gd -= circ.len; if (gd < -circ.len / 2) gd += circ.len;
      if (gd > 0 && gd < 130) pairRaw = Math.min(gd, 45);
    }
    sc.pairS = sc.pairS === undefined ? pairRaw : sc.pairS + (pairRaw - sc.pairS) * K(1.2, dt);
    const pair = sc.pairS;
    sc.pair = pair;

    const i = Math.floor(car.s / circ.step), a = circ.at(i);
    // Low-pass the track's own tangent and curvature before anything is framed against them.
    const f = sc.filt, head = Math.atan2(a.tx, a.tz);
    if (!f.init) { f.init = true; f.curv = a.curv; f.head = head; }
    f.curv += (a.curv - f.curv) * K(3.2, dt);
    f.head = angLerp(f.head, head, K(4.5, dt));
    const tx = Math.sin(f.head), tz = Math.cos(f.head), nx = -tz, nz = tx;

    let px_, py_, pz_, tx_, ty_, tz_, fov = 40, lag = 6;
    if (mode === 'TV') {
      if (sc.activeTV < 0 || sc.activeTV >= sc.world.tvcams.length) {
        const k = tvPick(); if (k < 0) mode = 'CHASE'; else sc.activeTV = k;
      } else {
        // Hold the camera that was cut to for the length of the shot. Re-picking part way
        // through slid the view between two cameras tens of metres apart, which reads as a
        // smear rather than a cut. If this one has lost the car, end the shot and let the
        // director cut properly on the next frame.
        const gap = tvDist(sc.activeTV);
        if (gap < -110 || gap > 220) d.t = d.dur;
      }
    }

    if (mode === 'CHASE') {
      // Back off and lift by however far the ghost is adrift, and aim between the two, so the
      // separation is the subject of the shot rather than something happening off camera.
      const dist = (shape.dist || 8.4) + pair * 0.9, sw = (shape.swing || 26) * f.curv;
      px_ = car.x - tx * dist - nx * sw; py_ = (shape.height || 3.2) + pair * 0.16; pz_ = car.z - tz * dist - nz * sw;
      // Aim between the two cars, but never behind the one you are following: a target behind
      // the camera's own subject shortens the look vector and makes every corner whip.
      const aim = Math.max(1.5, (shape.ahead || 4.5) - pair * 0.35);
      tx_ = car.x + tx * aim; ty_ = 0.75; tz_ = car.z + tz * aim;
      fov = shape.fov || 42; lag = shape.lag || 7;
    } else if (mode === 'STUDIO') {
      const ang = E.time * 0.5 + sc.orbit, rr = sc.studioDist;
      px_ = car.x + Math.sin(ang) * rr; py_ = 1.75; pz_ = car.z + Math.cos(ang) * rr;
      tx_ = car.x; ty_ = 0.45; tz_ = car.z; fov = 34; lag = 60;
    } else if (mode === 'ONBOARD') {
      px_ = car.x - tx * 0.15; py_ = shape.height || 1.3; pz_ = car.z - tz * 0.15;
      tx_ = car.x + tx * 40; ty_ = 0.6; tz_ = car.z + tz * 40;
      fov = shape.fov || 66; lag = shape.lag || 40;
    } else if (mode === 'HELI') {
      const side = circ.outside(i), back = (shape.back || 22) + pair * 0.6, off = (shape.side || 16);
      px_ = car.x - tx * back - nx * side * off; py_ = (shape.height || 34) + pair * 0.25; pz_ = car.z - tz * back - nz * side * off;
      const aim = 8 - pair * 0.45;
      tx_ = car.x + tx * aim; ty_ = 0; tz_ = car.z + tz * aim;
      fov = shape.fov || 38; lag = shape.lag || 3;
    } else if (mode === 'DETAIL') {
      // Car-local to world. The car's yaw gives forward; right is that turned ninety degrees.
      const sp = shape.spec || DETAIL_PARTS[0], sgn = shape.side || 1;
      const fx2 = Math.sin(car.yaw), fz = Math.cos(car.yaw), rx = fz, rz2 = -fx2;
      const at = (o, k) => [car.x + o[2] * fx2 + o[0] * k * rx, o[1], car.z + o[2] * fz + o[0] * k * rz2];
      const lookP = at(sp.look, sgn), camP = at(sp.cam, sgn);
      px_ = camP[0]; py_ = camP[1]; pz_ = camP[2];
      tx_ = lookP[0]; ty_ = lookP[1]; tz_ = lookP[2];
      fov = shape.fov || 40; lag = shape.lag || 55;
      sc.detail = sp;
    } else if (mode === 'PITLANE') {
      // The pit camera is a fixed position on the wall, the way it is at a circuit: it does not
      // follow the car, it watches the box and lets the car arrive in shot.
      const pc = sc.world.pit && sc.world.pit.cam;
      if (pc) {
        px_ = pc[0]; py_ = pc[1]; pz_ = pc[2];
        tx_ = car.x; ty_ = 0.6; tz_ = car.z;
        const dd = Math.hypot(pc[0] - car.x, pc[2] - car.z);
        fov = Math.max(14, Math.min(44, 330 / Math.max(8, dd)));
        lag = 9;
      } else { mode = 'CHASE'; px_ = car.x - tx * 8.4; py_ = 3.2; pz_ = car.z - tz * 8.4; tx_ = car.x; ty_ = 0.75; tz_ = car.z; }
    } else if (mode === 'APEX') {
      const p = shape.anchor;
      if (!p) { mode = 'CHASE'; px_ = car.x - tx * 8.4; py_ = 3.2; pz_ = car.z - tz * 8.4; tx_ = car.x; ty_ = 0.75; tz_ = car.z; }
      else {
        px_ = p[0]; py_ = p[1]; pz_ = p[2];
        tx_ = car.x; ty_ = 0.55; tz_ = car.z;
        const dd = Math.hypot(p[0] - car.x, p[2] - car.z);
        // hold the car the same size in frame as it comes to you, the way a long lens does
        fov = Math.max(16, Math.min(shape.fov || 26, 760 / Math.max(16, dd)));
        lag = shape.lag || 14;
        // Hold while the car is coming; cut away only once it has been and gone, never on the
        // approach — the approach is the shot.
        shape.minD = Math.min(shape.minD === undefined ? 1e9 : shape.minD, dd);
        if (dd > 55 && dd > shape.minD + 30) d.t = d.dur;
      }
    } else {
      const c = sc.world.tvcams[sc.activeTV];
      px_ = c.x; py_ = c.y; pz_ = c.z; tx_ = car.x; ty_ = 0.6; tz_ = car.z;
      const dd = Math.hypot(c.x - car.x, c.z - car.z);
      fov = Math.max(9, Math.min(46, 620 / Math.max(12, dd))); lag = 14;
    }

    const sm = sc.smooth;
    // CHASE and HELI are moves rather than cuts, so the camera glides into them. That only
    // reads as a move over a short distance: gliding seventy metres from a trackside anchor to
    // behind the car covers it in half a second and looks like a lurch, not an edit. Past
    // twenty-five metres, take it as a cut.
    if (d.fresh) {
      d.fresh = false;
      if (sm.init && Math.hypot(px_ - sm.x, py_ - sm.y, pz_ - sm.z) > 25) sm.init = false;
    }
    if (!sm.init) { sm.x = px_; sm.y = py_; sm.z = pz_; sm.tx = tx_; sm.ty = ty_; sm.tz = tz_; sm.fov = fov; sm.init = true; }
    const kp = K(lag, dt), kt = K(lag * 1.8, dt);
    sm.x += (px_ - sm.x) * kp; sm.y += (py_ - sm.y) * kp; sm.z += (pz_ - sm.z) * kp;
    sm.tx += (tx_ - sm.tx) * kt; sm.ty += (ty_ - sm.ty) * kt; sm.tz += (tz_ - sm.tz) * kt;
    // The zoom is smoothed too — a long lens tracking a car towards you changes focal length
    // every frame, and stepping it is as visible as stepping the position.
    sm.fov += (fov - sm.fov) * K(6, dt);
    cam.pos = [sm.x, sm.y, sm.z]; cam.target = [sm.tx, sm.ty, sm.tz]; cam.fov = sm.fov;
    sc.label = mode === 'STUDIO' ? 'CAM · GRID' : mode === 'TV' ? `CAM ${sc.activeTV + 1} · TRACKSIDE`
      : mode === 'CHASE' ? 'CAM · CHASE' : mode === 'ONBOARD' ? 'CAM · T-CAM'
      : mode === 'APEX' ? 'CAM · APEX'
      : mode === 'DETAIL' ? 'CAM · DETAIL'
      : mode === 'PITLANE' ? 'CAM · PIT LANE' : 'CAM · HELI';
    sc.shot = mode;
    if (mode !== 'DETAIL') sc.detail = null;
  };

  // render: draws sky, world, pools, shadow, ghost, car, sparks, outline. meshes: {car, ghost}
  sc.render = function (meshes) {
    R.begin(); R.sky(); R.drawStatic(sc.world.mesh); R.drawLightPools(sc.world.lightpools);
    // The car carries its own jack height, so a car up in the pit box is the body on the jacks
    // with the wheels still on the floor rather than the whole car floating.
    const lift = sc.car.lift || 0;
    const xf = SCR.car.makeXform(sc.car, lift ? { lift, wheelDrop: lift } : undefined);
    R.drawDynamic(meshes.car, xf, 'shadow', 0);
    if (sc.ghostActive && sc.ghost && meshes.ghost) R.drawDynamic(meshes.ghost, SCR.car.makeXform(sc.ghost), 'ghost', 0);
    R.drawDynamic(meshes.car, xf, 'solid', 0); SCR.sim.drawSparks(R, sc.fx); R.outline();
  };
  // Called when the two cars are put back on the line together: cut to the shot that shows one
  // pulling away from the other.
  sc.duel = () => {
    if (sc.mode !== 'AUTO') return;
    // If a shot that already frames both cars is running, hold it rather than re-calling it:
    // re-calling re-rolls the framing, which moves the camera mid-shot without a cut and reads
    // as a lurch rather than an edit.
    if (sc.dir.shot === 'CHASE' || sc.dir.shot === 'HELI') { sc.dir.t = 0; return; }
    callShot(rng() < 0.6 ? 'CHASE' : 'HELI');
  };
  sc.setMode = m => { if (TS.MODES.includes(m)) { sc.mode = m; if (m !== 'AUTO' && m !== 'STUDIO') callShot(m); else sc.dir.t = 0; } };
  sc.cut = () => callShot();
  return sc;
};
})(window.SCR = window.SCR || {});
