'use strict';

function visitors(T, kit) {
  const group = new T.Group(),
    S = new T.SphereGeometry(1, 14, 10),
    C = new T.CylinderGeometry(1, 1, 1, 10),
    P = new T.MeshStandardMaterial({ roughness: 0.78 }),
    mats = new Map(),
    V = (x, y, z) => new T.Vector3(x, y, z),
    tau = Math.PI * 2;
  function fixed(host, g, c, x, y, z, sx, sy, sz) {
    if (!mats.has(c)) mats.set(c, new T.MeshStandardMaterial({ color: c }));
    const p = new T.Mesh(g, mats.get(c));
    p.position.set(x, y, z);
    p.scale.set(sx, sy, sz);
    host.add(p);
    return p;
  }
  function rail(a, b, r, c) {
    const d = b.clone().sub(a),
      o = fixed(group, C, c, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, r, d.length(), r);
    o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  }
  function person(coat, hat, scarf, bag) {
    const model = new T.Group(),
      rig = new T.Group(),
      parts = [],
      legs = [],
      arms = [];
    model.userData.dynamic = true;
    function limb(x, y, z) {
      const q = new T.Group();
      q.position.set(x, y, z);
      rig.add(q);
      return q;
    }
    function shape(j, c, x, y, z, a, b, d) {
      const m = new T.Matrix4().makeScale(a, b, d);
      m.setPosition(x, y, z);
      parts.push([j, m, c]);
    }
    const ink = 0x323e51,
      boot = 0x51424b,
      skin = 0xd5a18b;
    for (const s of [-1, 1]) {
      const l = limb(s * 0.102, 0.81, 0),
        a = limb(s * 0.2, 1.3, 0);
      legs.push(l);
      arms.push(a);
      shape(l, ink, 0, -0.214, 0, 0.096, 0.244, 0.093);
      shape(l, ink, s * 0.003, -0.5, 0.007, 0.076, 0.217, 0.075);
      shape(l, boot, s * 0.003, -0.7, -0.042, 0.082, 0.106, 0.138);
      shape(l, 0x303843, 0, -0.767, -0.048, 0.084, 0.031, 0.14);
      shape(a, coat, s * 0.039, -0.135, 0, 0.084, 0.19, 0.088);
      shape(a, coat, s * 0.064, -0.328, -0.016, 0.072, 0.147, 0.076);
      shape(a, ink, s * 0.072, -0.471, -0.035, 0.055, 0.079, 0.048);
    }
    shape(rig, coat, 0, 1.069, 0.008, 0.224, 0.318, 0.153);
    for (let i = 0; i < 5; i++)
      shape(rig, coat, 0, 0.819 + 0.102 * i, 0.009, 0.213 + 0.011 * Math.sin(i * 0.8), 0.093, 0.154);
    shape(rig, skin, 0, 1.49, -0.009, 0.116, 0.137, 0.105);
    shape(rig, skin, 0, 1.493, -0.113, 0.022, 0.029, 0.02);
    for (const s of [-1, 1]) shape(rig, 0x3a3340, s * 0.044, 1.517, -0.108, 0.009, 0.006, 0.006);
    shape(rig, hat, 0, 1.585, -0.005, 0.124, 0.092, 0.115);
    shape(rig, hat, 0, 1.555, -0.006, 0.129, 0.031, 0.12);
    shape(rig, hat, 0.006, 1.681, 0.01, 0.039, 0.037, 0.039);
    shape(rig, scarf, 0, 1.39, -0.008, 0.132, 0.05, 0.12);
    shape(rig, scarf, 0.074, 1.28, -0.117, 0.038, 0.117, 0.018);
    if (bag) shape(rig, 0x4e6170, 0, 1.072, 0.158, 0.132, 0.147, 0.074);
    const withoutBlades = parts.length;
    for (const leg of legs) {
      for (const z of [-0.13, 0.045]) shape(leg, 0x708b97, 0, -0.793, z, 0.022, 0.033, 0.026);
      shape(leg, 0xcde0e7, 0, -0.83, -0.045, 0.015, 0.018, 0.167);
    }
    const body = new T.InstancedMesh(S, P, parts.length),
      tmp = new T.Matrix4();
    body.frustumCulled = false;
    parts.forEach((p, i) => body.setColorAt(i, new T.Color(p[2])));
    model.add(body);
    function pose(t, speed, ground = true, skate = false, sliding = false, wearingSkates = skate) {
      body.count = wearingSkates ? parts.length : withoutBlades;
      const a = Math.min(1.35, speed / 2),
        w = Math.sin(t);
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        legs[i].rotation.x = sliding
          ? 1.18
          : ground
          ? w * s * a * (skate ? 0.22 : 0.55)
          : 0.24 + s * 0.13;
        legs[i].rotation.z = skate ? s * Math.max(0, w * s) * 0.18 : 0;
        arms[i].rotation.x = sliding ? 0.59 : -w * s * a * 0.43;
        arms[i].rotation.z = s * (skate ? 0.39 : 0.04);
      }
      rig.position.y = sliding ? -0.44 : ground ? Math.abs(Math.cos(t)) * 0.013 * a : 0;
      if (wearingSkates) rig.position.y += 0.04;
      rig.updateMatrixWorld(true);
      parts.forEach(([j, m], i) => body.setMatrixAt(i, tmp.multiplyMatrices(j.matrixWorld, m)));
      body.instanceMatrix.needsUpdate = true;
    }
    pose(0, 0);
    return { model, pose };
  }
  const hero = person(0x567a8d, 0xe2d4c1, 0xd78d69, true),
    guests = [];
  for (let i = 0; i < 5; i++) {
    const a = person(
      [0xae675e, 0x547c80, 0xc09059, 0x816e92, 0x67859a][i],
      [0xdac9ac, 0x7c6479][i % 2],
      0xcfad9c
    );
    guests.push(a);
    group.add(a.model);
  }
  const colliders = [];
  let prev;
  for (let i = 0; i <= 24; i++) {
    const th = Math.PI + 0.36 + ((tau - 0.72) * i) / 24,
      x = skatingRink.x + skatingRink.rx * Math.cos(th),
      z = skatingRink.z + skatingRink.rz * Math.sin(th),
      p = V(x, 0.82, z);
    rail(V(x, 0.04, z), V(x, 0.94, z), 0.069, 0x45606b);
    fixed(group, S, 0xdce6eb, x, 0.956, z, 0.09, 0.037, 0.09);
    if (prev) {
      rail(prev, p, 0.055, 0x756168);
      rail(V(prev.x, 0.34, prev.z), V(x, 0.34, z), 0.035, 0x526474);
      const dx = x - prev.x, dz = z - prev.z;
      colliders.push({
        type: 'rinkRail', x: (x + prev.x) / 2, z: (z + prev.z) / 2,
        dx, dz, invLengthSq: 1 / (dx * dx + dz * dz), r: 0.09, maxY: 0.94,
      });
    }
    prev = p;
  }
  const rack = new T.Group(), rackBox = new T.BoxGeometry();
  rack.position.set(skatingRink.deskX, 0, skatingRink.deskZ);
  group.add(rack);
  const rackPart = (x, y, z, w, h, d, color) => fixed(rack, rackBox, color, x, y, z, w, h, d);
  for (const x of [-0.85, 0.85]) rackPart(x, 0.66, -0.16, 0.09, 1.32, 0.1, 0x536c75);
  rackPart(0, 0.44, 0, 1.90, 0.10, 0.53, 0x986f53);
  rackPart(0, 1.21, -0.16, 1.9, 0.42, 0.09, 0xc5ddd8);
  for (const x of [-0.65, -0.42, -0.06, 0.17, 0.54, 0.76]) {
    fixed(rack, S, 0x344f65, x, 0.62, 0.01, 0.085, 0.13, 0.13);
    fixed(rack, S, 0x7599a4, x, 0.57, 0.09, 0.09, 0.08, 0.15);
    rackPart(x, 0.505, 0.065, 0.023, 0.035, 0.30, 0xe9f6ff);
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 384; canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#193842'; ctx.fillRect(0, 0, 384, 96);
    ctx.fillStyle = '#d8f6ea'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 47px sans-serif'; ctx.fillText('冰鞋领取处', 192, 49);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    const sign = new T.Mesh(new T.PlaneGeometry(1.80, 0.39), new T.MeshBasicMaterial({ map }));
    sign.position.set(0, 1.21, -0.108);
    rack.add(sign);
  }
  colliders.push({ type: 'box', x: skatingRink.deskX, z: skatingRink.deskZ, w: 1.9, d: 0.54, maxY: 1.43 });
  const targets = [],
    targetModels = [],
    elapsed = [];
  for (let i = 0; i < 3; i++) {
    const x = i === 1 ? -50.8 : -46.8,
      z = 65.6 + i * 4.4,
      d = V(-33 - x, 0, 70 - z).normalize(),
      g = new T.Group(),
      q = new T.Group(),
      col = [0x69b3a5, 0xde9c62, 0xd2879e][i];
    g.position.set(x, 0.045, z);
    g.rotation.y = Math.atan2(-d.x, -d.z);
    g.add(q);
    group.add(g);
    for (const [y, r] of [
      [0.52, 0.67],
      [1.22, 0.51],
      [1.91, 0.36],
    ])
      fixed(q, S, 0xe4ecf1, 0, y, 0, r, r, r * 0.94);
    fixed(q, S, col, 0, 1.57, 0, 0.355, 0.086, 0.325);
    fixed(q, S, col, 0, 2.17, 0, 0.32, 0.165, 0.3);
    fixed(q, S, col, 0, 2.33, 0, 0.08, 0.08, 0.08);
    for (const s of [-1, 1]) fixed(q, S, 0x394048, s * 0.13, 1.96, -0.305, 0.036, 0.039, 0.025);
    fixed(q, S, 0xe29c5f, 0, 1.86, -0.36, 0.049, 0.053, 0.14);
    for (const [r, c, o] of [
      [0.3, col, 0],
      [0.204, 0xebedf0, 0.023],
      [0.113, col, 0.045],
    ])
      fixed(q, S, c, 0, 1.31, -0.458 - o, r, r, 0.035);
    batch(T, q);
    g.userData.dynamic = true;
    targets.push({ position: V(x + 0.46 * d.x, 1.355, z + 0.46 * d.z), radius: 0.76 });
    targetModels.push(q);
    elapsed.push(3);
    colliders.push({ type: 'circle', x, z, r: 0.65, maxY: 2.4 });
  }
  for (const s of [-1, 1]) {
    fixed(group, S, 0xcddbe5, -37.7, 0.11, 70 + 4.9 * s, 1.5, 0.63, 1.19);
    colliders.push({ type: 'circle', x: -37.7, z: 70 + 4.9 * s, r: 1.1, maxY: 0.7 });
  }
  let phase = 0;
  return {
    group,
    colliders,
    avatar: hero.model,
    targets,
    hitTarget(i) {
      if (targetModels[i]) elapsed[i] = 0;
    },
    resetTargets() {
      elapsed.fill(3);
      targetModels.forEach((q) => (q.rotation.x = 0));
    },
    update(t, dt, p) {
      const speed = p.speed || 0;
      phase += dt * (2.8 + Math.min(7, speed) * 1.3) * Math.min(1, speed * 2);
      hero.pose(phase, speed, p.grounded, p.skating, p.sliding || p.seated, p.skatesOn);
      guests.forEach((a, i) => {
        const skating = i > 2,
          k = t * (skating ? 0.28 : 0.08) + i * 1.8,
          rx = skating ? 9.7 : 1.6,
          rz = skating ? 5.7 : 9;
        a.model.position.set(
          (skating ? 43 : [6.4, 7.2, -6.1][i]) + rx * Math.sin(k),
          0.075,
          (skating ? 70 : [32, 36, 18][i]) + rz * Math.cos(k)
        );
        a.model.rotation.y = Math.atan2(-rx * Math.cos(k), rz * Math.sin(k));
        a.pose(t * (skating ? 2.7 : 3.6) + i, skating ? 2.5 : 0.78, true, skating);
      });
      targetModels.forEach((q, i) => {
        elapsed[i] += dt;
        q.rotation.x =
          elapsed[i] < 2 ? 0.38 * Math.sin(13 * elapsed[i]) * Math.exp(-3.2 * elapsed[i]) : 0;
      });
    },
  };
}
