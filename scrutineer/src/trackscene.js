// ============================================================================
// SCR.trackScene — cars lapping a circuit with broadcast cameras (chase, T-cam, trackside, heli, grid, auto director)
// One instance per session; the season swaps circuits between sessions.
// ============================================================================
(function (SCR) {
'use strict';
const E = SCR.engine, TS = SCR.trackScene = {};
TS.MODES = ['AUTO', 'CHASE', 'ONBOARD', 'TV', 'HELI', 'STUDIO'];
// create({R, world, car(state), ghost?, meshFor(state)->mesh, ghostMesh}) -> scene
TS.create = function (o) {
  const R = o.R, sc = { world: o.world, circ: o.world.circuit, car: o.car, ghost: o.ghost || null, ghostActive: false, mode: 'AUTO', activeTV: -1, autoPhase: 0, autoT: 0, label: 'CAM · CHASE', fx: [], orbit: 0.9, smooth: { x: 0, y: 3, z: -10, tx: 0, ty: 0, tz: 0, init: false } };
  const cam = R.cam;
  sc.setWorld = w => { sc.world = w; sc.circ = w.circuit; sc.activeTV = -1; sc.smooth.init = false; };
  const tvDist = k => { let d = sc.world.tvcams[k].s - sc.car.s; if (d > sc.circ.len / 2) d -= sc.circ.len; if (d < -sc.circ.len / 2) d += sc.circ.len; return d; };
  function tvPick() {
    const cams = sc.world.tvcams; if (!cams.length) return -1;
    // a camera looking at the back of a grandstand column is not a shot; cut to chase instead
    const usable = k => (cams[k].clear === undefined ? 1 : cams[k].clear) > 0.55;
    if (sc.activeTV >= 0 && sc.activeTV < cams.length && usable(sc.activeTV)) { const d = tvDist(sc.activeTV); if (d > -70 && d < 110) return sc.activeTV; }
    let best = -1, bd = 1e9; for (let k = 0; k < cams.length; k++) { if (!usable(k)) continue; const d = tvDist(k); if (d >= -8 && d < 110 && d < bd) { bd = d; best = k; } } if (best >= 0) return best;
    for (let k = 0; k < cams.length; k++) { if (!usable(k)) continue; const d = tvDist(k); if (d < 0 && d > -70 && -d < bd) { bd = -d; best = k; } } return best;
  }
  sc.updateCamera = function (dt) {
    const car = sc.car, circ = sc.circ; let mode = sc.mode;
    if (sc.mode === 'AUTO') { sc.autoT += dt; const seq = ['TV', 'CHASE', 'TV', 'ONBOARD', 'HELI', 'CHASE']; if (sc.autoT > 7) { sc.autoT = 0; sc.autoPhase = (sc.autoPhase + 1) % seq.length; } mode = seq[sc.autoPhase]; }
    const i = Math.floor(car.s / circ.step), a = circ.at(i), tx = a.tx, tz = a.tz, nx = a.nx, nz = a.nz;
    let px_, py_, pz_, tx_, ty_, tz_, fov = 40, lag = 6;
    if (mode === 'TV') { const k = tvPick(); if (k < 0) mode = 'CHASE'; else sc.activeTV = k; }
    if (mode === 'CHASE') { px_ = car.x - tx * 8.4 - nx * a.curv * 26; py_ = 3.2; pz_ = car.z - tz * 8.4 - nz * a.curv * 26; tx_ = car.x + tx * 4.5; ty_ = 0.75; tz_ = car.z + tz * 4.5; fov = 42; lag = 7; }
    else if (mode === 'STUDIO') { const ang = E.time * 0.5 + sc.orbit, rr = 5.4; px_ = car.x + Math.sin(ang) * rr; py_ = 1.75; pz_ = car.z + Math.cos(ang) * rr; tx_ = car.x; ty_ = 0.45; tz_ = car.z; fov = 34; lag = 60; }
    else if (mode === 'ONBOARD') { px_ = car.x - tx * 0.15; py_ = 1.3; pz_ = car.z - tz * 0.15; tx_ = car.x + tx * 40; ty_ = 0.6; tz_ = car.z + tz * 40; fov = 66; lag = 40; }
    else if (mode === 'HELI') { const side = circ.outside(i); px_ = car.x - tx * 22 - nx * side * 16; py_ = 34; pz_ = car.z - tz * 22 - nz * side * 16; tx_ = car.x + tx * 8; ty_ = 0; tz_ = car.z + tz * 8; fov = 38; lag = 3; }
    else { const c = sc.world.tvcams[sc.activeTV]; px_ = c.x; py_ = c.y; pz_ = c.z; tx_ = car.x; ty_ = 0.6; tz_ = car.z; const d = Math.hypot(c.x - car.x, c.z - car.z); fov = Math.max(9, Math.min(46, 620 / Math.max(12, d))); lag = 14; }
    const sm = sc.smooth, snap = mode === 'TV' || mode === 'ONBOARD' || mode === 'STUDIO';
    if (!sm.init || snap) { sm.x = px_; sm.y = py_; sm.z = pz_; sm.init = true; }
    const k2 = Math.min(1, dt * lag); sm.x += (px_ - sm.x) * k2; sm.y += (py_ - sm.y) * k2; sm.z += (pz_ - sm.z) * k2;
    sm.tx += (tx_ - sm.tx) * Math.min(1, dt * lag * 2); sm.ty += (ty_ - sm.ty) * Math.min(1, dt * lag * 2); sm.tz += (tz_ - sm.tz) * Math.min(1, dt * lag * 2);
    if (snap) { sm.tx = tx_; sm.ty = ty_; sm.tz = tz_; }
    cam.pos = [sm.x, sm.y, sm.z]; cam.target = [sm.tx, sm.ty, sm.tz]; cam.fov = fov;
    sc.label = mode === 'STUDIO' ? 'CAM · GRID' : mode === 'TV' ? `CAM ${sc.activeTV + 1} · TRACKSIDE` : mode === 'CHASE' ? 'CAM · CHASE' : mode === 'ONBOARD' ? 'CAM · T-CAM' : 'CAM · HELI';
  };
  // render: draws sky, world, pools, shadow, ghost, car, sparks, outline. meshes: {car, ghost}
  sc.render = function (meshes) {
    R.begin(); R.sky(); R.drawStatic(sc.world.mesh); R.drawLightPools(sc.world.lightpools);
    const xf = SCR.car.makeXform(sc.car); R.drawDynamic(meshes.car, xf, 'shadow', 0);
    if (sc.ghostActive && sc.ghost && meshes.ghost) R.drawDynamic(meshes.ghost, SCR.car.makeXform(sc.ghost), 'ghost', 0);
    R.drawDynamic(meshes.car, xf, 'solid', 0); SCR.sim.drawSparks(R, sc.fx); R.outline();
  };
  sc.setMode = m => { if (TS.MODES.includes(m)) { sc.mode = m; sc.autoT = 0; } };
  return sc;
};
})(window.SCR = window.SCR || {});
