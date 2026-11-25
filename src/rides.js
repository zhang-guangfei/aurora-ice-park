'use strict';

function buildRides(T, k, lighting) {
  const group = new T.Group(),
    wheel = new T.Group(),
    spin = new T.Group(),
    pods = [],
    colliders = [],
    V = (x, y, z) => new T.Vector3(x, y, z),
    up = V(0, 1, 0),
    tau = Math.PI * 2,
    N = k.metal(0xb0c5d5),
    K = k.metal(0x3c586d),
    I = k.ice(0x78d1e9),
    B = k.ice(0x4a91bc),
    P = k.ice(0xae9bdc),
    C = k.glow(0x80dfef, 1.2),
    L = k.glow(0xeab6ef, 1.15),
    G = k.glow(0xffcf8a, 1.35),
    F = k.glow(0xe8f6ff, 1.05),
    snow = k.snow;
  const glass = new T.MeshPhysicalMaterial({
      color: 0x8cc4d6,
      metalness: 0.15,
      roughness: 0.22,
      transparent: true,
      opacity: 0.23,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    boxG = new T.BoxGeometry(),
    sph = new T.SphereGeometry(1, 12, 8),
    pole = new T.CylinderGeometry(1, 1, 1, 7),
    cache = new Map();
  function m(p, g, mat, v, s = V(1, 1, 1)) {
    const o = new T.Mesh(g, mat);
    o.position.copy(v);
    o.scale.copy(s);
    o.receiveShadow = mat === I || mat === snow;
    p.add(o);
    return o;
  }
  function rod(p, a, b, r, mat) {
    const d = b.clone().sub(a);
    if (d.lengthSq() < 1e-8) return;
    const o = m(p, pole, mat, a.clone().lerp(b, 0.5), V(r, d.length(), r));
    o.quaternion.setFromUnitVectors(up, d.normalize());
  }
  const box = (p, v, w, h, d, mat) => m(p, boxG, mat, v, V(w, h, d));
  const orb = (p, v, w, h, d, mat) => m(p, sph, mat, v, V(w, h, d));
  function tor(p, v, r, t, mat, n = 96) {
    let key = [r, t, n].join(',');
    if (!cache.has(key)) cache.set(key, new T.TorusGeometry(r, t, 6, n));
    return m(p, cache.get(key), mat, v);
  }
  const tube = (p, points, r, mat, n) =>
    m(p, new T.TubeGeometry(new T.CatmullRomCurve3(points), n, r, 6, false), mat, V(0, 0, 0));
  const showLight = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide });
  showLight.onBeforeCompile = shader => {
    shader.uniforms.showClock = k.clock;
    shader.uniforms.showNight = k.nightLight;
    shader.vertexShader = 'varying float chaseDistance;\n' + shader.vertexShader.replace(
      '#include <project_vertex>', '#include <project_vertex>\nchaseDistance=dot(position,vec3(.27,.15,.19));');
    shader.fragmentShader = 'varying float chaseDistance;uniform float showClock,showNight;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb*=(.66+.52*showNight)*(.85+.38*pow(.5+.5*cos(chaseDistance-showClock*.53),3.));');
  };
  function litMesh(parent, pos, cols, indices) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos,3));
    g.setAttribute('color', new T.Float32BufferAttribute(cols,3));
    g.setIndex(indices); g.computeVertexNormals();
    return m(parent,g,showLight,V(0,0,0));
  }
  const wheelRadius = 25, hubHeight = wheelRadius + 3, wheelPeriod = 106;
  const yaw = -0.96,
    co = Math.cos(yaw),
    si = Math.sin(yaw),
    at = (x, y, z, out = V()) => out.set(53 + co * x + si * z, hubHeight + y, -19 - si * x + co * z),
    low = (x, y, z) => V(x, y - hubHeight, z),
    rim = (a, r, z) => V(Math.sin(a) * r, -Math.cos(a) * r, z);
  wheel.position.set(53, hubHeight, -19);
  wheel.rotation.y = yaw;
  group.add(wheel);
  wheel.add(spin);
  for (const side of [-1, 1]) {
    for (const f of [-1, 1]) {
      const x = 9.5 * f,
        z = 5.45 * side;
      box(wheel, low(x, 0.28, z), 2.5, 0.56, 2.5, B);
      rod(wheel, low(x, 0.5, z), V(f * 0.38, -0.2, side * 2.03), 0.43, K);
      rod(wheel, low(x + f * 0.26, 0.7, z + side * 0.17), V(f * 0.52, -0.3, side * 2.44), 0.2, N);
      rod(
        wheel,
        low(x + f * 0.31, 0.8, z + side * 0.3),
        V(f * 0.53, -0.35, side * 2.55),
        0.066,
        side > 0 ? C : L
      );
      const p = at(x, -hubHeight, z);
      colliders.push({ type: 'circle', x: p.x, z: p.z, r: 1.2, maxY: 2.5 });
    }
    rod(wheel, low(-7.35, 5.1, side * 4.6), low(7.35, 5.1, side * 4.6), 0.17, N);
    rod(wheel, V(0, 0, side * 0.46), V(0, 0, side * 2.8), 0.83, N);
    tor(wheel, V(0, 0, side * 2.85), 0.8, 0.09, G, 40);
  }
  box(wheel, low(0, 0.375, 3.32), 11.8, 0.75, 4.78, B);
  box(wheel, low(0, 0.77, 3.32), 11.9, 0.09, 4.83, snow);
  for (let j = 0; j < 12; j++) {
    const u = (j + 0.5) / 12;
    box(wheel, low(0, 0.405 * u, 9.55 - 3.9 * u), 4, 0.81 * u, 0.34, snow);
  }
  for (const s of [-1, 1]) {
    tor(spin, V(0, 0, s * 0.66), 17.96, 0.17, N, 144);
    tor(spin, V(0, 0, s * 0.63), 16.85, 0.12, K, 144);
    tor(spin, V(0, 0, s * 0.72), 16.82, 0.058, C, 144);
    tor(spin, V(0, 0, s * 0.88), 1.67, 0.13, F, 50);
  }
  for (let i = 0; i < 96; i++) {
    const a = (tau * i) / 96,
      b = a + tau / 96,
      accent = [C, F, L, G, L, C][Math.floor(i / 16)];
    rod(spin, rim(a, 18, 0.81), rim(b, 18, 0.81), 0.1, accent);
    if (i % 3 === 0) {
      rod(spin, rim(a + 0.18, 1.61, 0.87), rim(a, 16.86, 0.64), 0.055, N);
      rod(spin, rim(a - 0.21, 1.62, -0.84), rim(a + 0.09, 16.85, -0.64), 0.045, K);
    }
    if (i % 4 === 1) {
      rod(spin, rim(a+.029,12.7,.69),rim(a,16.80,.69),.058,[C,L,F][Math.floor(i/16)%3]);
    }
    if (!(i % 2)) {
      rod(spin, rim(a, 16.86, 0.66), rim(b + 0.059, 17.94, 0.66), 0.055, N);
      orb(spin, rim(a, 17.99, 0.83), 0.12, 0.12, 0.1, i % 4 ? F : G);
    }
  }
  // Four illuminated facets on each snow crystal give the rotating wheel a legible six-arm silhouette.
  function frostLeaf(a, b, width, tint) {
    const along=b.clone().sub(a), center=a.clone().lerp(b,.51);
    const cross=V(-along.y,along.x,0).normalize().multiplyScalar(width);
    const tip=center.clone(); tip.z+=.29;
    const verts=[a,center.clone().add(cross),b,center.clone().sub(cross),tip];
    const faces=[[0,1,4],[1,2,4],[2,3,4],[3,0,4]];
    const pos=[], colors=[], indices=[];
    for (let f=0; f<faces.length; f++) {
      const color=tint.clone().multiplyScalar([.42,1.6,.81,.28][f]);
      for (const j of faces[f]) { verts[j].toArray(pos,pos.length); color.toArray(colors,colors.length); indices.push(indices.length); }
    }
    litMesh(spin,pos,colors,indices);
  }
  for (let i = 0; i < 6; i++) {
    const a = (tau * i) / 6 + Math.PI / 6,
      p = (r, d = 0, z = 0.93) =>
        V(Math.sin(a) * r + Math.cos(a) * d, -Math.cos(a) * r + Math.sin(a) * d, z);
    const hue = new T.Color([0x64e9ff,0x91b3ff,0xdb9cfc,0x83e9ff,0xb69cf8,0x72d4ff][i]);
    frostLeaf(p(1.55,0,1.1),p(13.8,0,1.1),.54,hue);
    frostLeaf(p(12.1,0,1.04),p(15.5,0,1.04),.28,hue);
    for (const dir of [-1,1]) {
      frostLeaf(p(4.85,0,1.04),p(8.4,2.9*dir,1.04),.38,hue);
      frostLeaf(p(8.45,0,1.04),p(12.8,2.45*dir,1.04),.29,hue);
    }
    rod(spin, p(1.4), p(12.4), 0.19, I);
    rod(spin, p(1.6, 0, 1.08), p(12.4, 0, 1.08), 0.084, C);
    for (const s of [-1, 1])
      for (const [f, v, d] of [
        [4.7, 7.4, 2.3],
        [7.3, 10.1, 2.15],
        [9.6, 11.9, 1.5],
      ]) {
        rod(spin, p(f), p(v, s * d), 0.135, N);
        rod(spin, p(f, 0, 1.03), p(v, s * d, 1.04), 0.069, F);
      }
  }
  rod(spin, V(0, 0, -1.08), V(0, 0, 1.06), 1.5, P);
  const centerGem = m(spin,new T.IcosahedronGeometry(1,0),I,V(0,0,1.31),V(1.27,1.27,.62));
  centerGem.rotation.z=.34;
  lighting?.pool(53,-19,13,9,.55,[.13,.30,.83],.60);
  batch(T, spin);
  spin.scale.set(wheelRadius / 18, wheelRadius / 18, 1);
  spin.userData.dynamic = true;
  const cab = new T.Group();
  for (const s of [-1, 1])
    for (const f of [-1, 1]) rod(cab, V(0, -0.04, s * 0.62), V(f * 0.51, -0.74, s * 0.62), 0.065, N);
  orb(cab, V(0, -0.79, 0), 1.16, 0.21, 0.94, I);
  m(cab, new T.CylinderGeometry(1, 0.94, 0.98, 10, 1, true), glass, V(0, -1.36, 0), V(1.07, 1, 0.86));
  m(
    cab,
    new T.LatheGeometry(
      [
        [0.045, -2.32],
        [0.56, -2.28],
        [0.85, -2.14],
        [0.99, -1.92],
        [0.99, -1.77],
      ].map((v) => new T.Vector2(...v)),
      10
    ),
    K,
    V(0, 0, 0),
    V(1.07, 1, 0.86)
  );
  const belt = tor(cab, V(0, -1.78, 0), 1, 0.06, G, 28);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1.04, 0.84, 1);
  for (let i = 0; i < 6; i++) {
    const a = (tau * (i + 0.5)) / 6;
    rod(
      cab,
      V(1.02 * Math.sin(a), -1.82, 0.8 * Math.cos(a)),
      V(1.06 * Math.sin(a), -0.86, 0.84 * Math.cos(a)),
      0.036,
      N
    );
  }
  batch(T, cab);
  cab.updateMatrixWorld(true);
  cab.traverse((o) => {
    if (o.isMesh) {
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld),
        mesh = new T.InstancedMesh(g, o.material, 16);
      mesh.frustumCulled = false;
      mesh.userData.dynamic = true;
      wheel.add(mesh);
      pods.push(mesh);
    }
  });
  // Leave the back lip of the launch deck, then sweep west of the tower and south of the stair foot.
  const points = [
      [-52.5, 18.64, -18.36],
      [-52.65, 18.48, -21.35],
      [-54.8, 17.6, -25.9],
      [-59.9, 16.15, -28.5],
      [-65.0, 14.65, -26.1],
      [-66.45, 13.2, -20.55],
      [-64.25, 11.85, -15.25],
      [-60.85, 10.5, -10.5],
      [-60.6, 9.2, -5.6],
      [-63.55, 7.9, -0.65],
      [-64.15, 6.65, 4.4],
      [-60.7, 5.35, 8.7],
      [-55.35, 4.15, 11.65],
      [-52.15, 3.15, 15.5],
      [-51.15, 2.40, 18.85],
      [-48.7, 1.82, 21.4],
      [-45.2, 1.34, 21.75],
      [-41.0, 0.92, 20.7],
      [-35.95, 0.52, 18.27],
      [-30.25, 0.25, 16.95],
    ],
    curve = new T.CatmullRomCurve3(points.map((v) => V(...v)));
  curve.arcLengthDivisions = 460;
  const slidePoint = (u) => curve.getPointAt(Math.min(1, Math.max(0, u))),
    slideLength = curve.getLength(),
    sections = Math.ceil(slideLength / 0.65),
    frames = [],
    prof = Array.from({ length: 15 }, (_, i) => {
      const s = (i - 7) / 7;
      return [s, 0.98 * Math.abs(s) ** 2.75];
    });
  for (let i = 0; i <= sections; i++) {
    const f = i / sections,
      t = curve.getTangentAt(f);
    frames.push({
      v: slidePoint(f),
      n: V(-t.z, 0, t.x).normalize(),
      w: 2.03 + 0.38 * Math.max(0, (f - 0.82) / 0.18),
    });
  }
  const cross = (f, d, y) =>
    f.v
      .clone()
      .addScaledVector(f.n, f.w * d)
      .add(V(0, y, 0));
  function ribbon(profile, mat, reverse) {
    const pos = [],
      uv = [],
      ix = [],
      n = profile.length;
    for (let j = 0; j <= sections; j++)
      for (let i = 0; i < n; i++) {
        const [d, h] = profile[i],
          p = cross(frames[j], d, h);
        pos.push(p.x, p.y, p.z);
        uv.push((d + 1) / 2, j / 7);
        if (j < sections && i < n - 1) {
          const a = j * n + i,
            b = a + 1,
            c = a + n,
            e = c + 1;
          ix.push(...(reverse ? [a, c, b, b, c, e] : [a, b, c, b, e, c]));
        }
      }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(ix);
    g.computeVertexNormals();
    m(group, g, mat, V(0, 0, 0));
  }
  ribbon(prof, I, false);
  ribbon(
    [
      [-1, 0.98],
      [-1.06, 0.45],
      [-0.85, -0.45],
      [0, -0.66],
      [0.85, -0.45],
      [1.06, 0.45],
      [1, 0.98],
    ],
    B,
    true
  );
  for (const s of [-1, 1]) {
    tube(
      group,
      frames.map((f) => cross(f, s, 1)),
      0.15,
      s < 0 ? P : I,
      sections
    );
    tube(
      group,
      frames.map((f) => cross(f, s, 1.105)),
      0.068,
      s < 0 ? L : C,
      sections
    );
    tube(
      group,
      frames.map((f) => cross(f, s * 0.84, -0.43)),
      0.1,
      N,
      sections
    );
  }
  // The guide lights follow the banked outer faces, below the rim and outside the rider's envelope.
  const palette=[0x50d8f4,0x548af1,0x936bf1,0xe379bc,0xffb36b].map(x=>new T.Color(x));
  for (const side of [-1,1]) {
    const pos=[],cols=[],indices=[];
    for (let j=0;j<sections;j++) {
      const f=frames[j], next=frames[j+1], mix=(j+.5)/sections*(palette.length-1);
      const lo=Math.min(palette.length-2,Math.floor(mix));
      const hue=palette[lo].clone().lerp(palette[lo+1],mix-lo);
      for (const [height,level] of [[.56,.70],[.69,1.17],[.84,.45]]) {
        const distance=1.076-(height-.5)*.086;
        for (const row of [f,next]) {
          cross(row,side*distance,height).toArray(pos,pos.length);
          hue.clone().multiplyScalar(level*(j%8===0?.48:1)).toArray(cols,cols.length);
        }
      }
      const o=j*6; indices.push(o,o+2,o+1,o+1,o+2,o+3,o+2,o+4,o+3,o+3,o+4,o+5);
      if (side===1 && j%16===0) lighting?.pool(f.v.x,f.v.z,4.8,5.4,0,[hue.r,hue.g,hue.b],.31);
    }
    litMesh(group,pos,cols,indices);
  }
  const slideStructure = new T.Group();
  slideStructure.name = 'Slide supports and access tower';
  group.add(slideStructure);
  const supportSpacing = Math.round(7.4 * sections / slideLength);
  for (let i = supportSpacing; i < sections; i += supportSpacing) {
    const f = frames[i], p = f.v, postTop = p.y - 0.78;
    if (postTop < 0.2) continue;
    rod(slideStructure, V(p.x, 0, p.z), V(p.x, postTop, p.z), 0.36, K);
    for (const side of [-1, 1]) {
      const base = V(p.x, Math.max(0.12, postTop - 1.85), p.z);
      rod(slideStructure, base, cross(f, side * 0.78, -0.56), 0.12, N);
    }
    colliders.push({ type: 'circle', x: p.x, z: p.z, r: 0.36, maxY: postTop });
  }
  const X = -46.45,
    Z = 18.1,
    W = 3.68,
    run = 9.25,
    land = 1.55,
    h = 6.2,
    front = Z - run * 3 - land * 2 + 0.1,
    back = -18.28,
    left = -55.65,
    right = -43.4,
    top = 18.6,
    mx = (left + right) / 2,
    mz = (back + front) / 2;
  for (let i = 0; i < 3; i++) {
    const z = Z - i * (run + land),
      y = i * h;
    for (let j = 0; j < 26; j++) {
      const z1 = z - ((j + 0.5) * run) / 26,
        v = y + ((j + 1) * h) / 26;
      box(slideStructure, V(X, v - 0.14, z1), W, 0.29, run / 26 + 0.02, B);
      box(slideStructure, V(X, v - 0.019, z1), W + 0.035, 0.043, run / 26 + 0.016, snow);
    }
    if (i < 2) box(slideStructure, V(X, y + h - 0.15, z - run - land / 2), W + 0.08, 0.3, land + 0.035, I);
    for (const s of [-1, 1]) {
      const x = X + (s * W) / 2;
      for (const [dy, r, mat] of [
        [0.01, 0.13, K],
        [0.6, 0.049, N],
        [1.15, 0.077, N],
      ]) {
        rod(slideStructure, V(x, y + dy, z), V(x, y + h + dy, z - run), r, mat);
        if (i < 2) rod(slideStructure, V(x, y + h + dy, z - run), V(x, y + h + dy, z - run - land), r, mat);
      }
      for (let j = 0; j <= 4; j++) {
        const t = j / 4;
        rod(slideStructure, V(x, y + h * t, z - run * t), V(x, y + h * t + 1.15, z - run * t), 0.066, N);
      }
    }
  }
  box(slideStructure, V(mx, top - 0.37, mz), right - left, 0.75, front - back, I);
  box(slideStructure, V(mx, top - 0.043, mz), right - left + 0.1, 0.086, front - back + 0.08, snow);
  for (const x of [left + 0.63, right - 0.63])
    for (const z of [front - 0.53, back + 0.52]) {
      rod(slideStructure, V(x, 0, z), V(x, top - 0.38, z), 0.43, B);
      for (let j=0;j<6;j++) {
        const y=.42+j*2.89;
        m(slideStructure,new T.CylinderGeometry(.55,.60,.43,8),j%2?I:B,V(x,y,z));
        if (j%2===0) m(slideStructure,new T.CylinderGeometry(.57,.57,.064,8),j===2?L:C,V(x,y+.18,z));
      }
      colliders.push({ type: 'circle', x, z, r: 0.6, maxY: top - 0.65 });
    }
  for (let i = 0; i < 3; i++) {
    const h = 0.5 + i * 5.85;
    for (const x of [left + 0.63, right - 0.63]) {
      rod(slideStructure, V(x, h, front - 0.54), V(x, h + 5.76, back + 0.53), 0.15, N);
      rod(slideStructure, V(x, h, back + 0.53), V(x, h + 5.76, front - 0.54), 0.12, K);
    }
    for (const z of [front - 0.52, back + 0.52]) {
      rod(slideStructure, V(left + 0.64, h, z), V(mx, h + 5.73, z), 0.13, K);
      rod(slideStructure, V(right - 0.64, h, z), V(mx, h + 5.73, z), 0.13, K);
    }
  }
  const arch = [
    [-5.8, 0],
    [-5.53, 2.74],
    [-4.4, 3.98],
    [-2.45, 4.88],
    [0, 5.65],
    [2.45, 4.88],
    [4.4, 3.98],
    [5.53, 2.74],
    [5.8, 0],
  ];
  for (const z of [front - 0.26, back + 0.51]) {
    tube(
      slideStructure,
      arch.map(([x, h]) => V(mx + x, top + h, z)),
      0.24,
      I,
      32
    );
    tube(
      slideStructure,
      arch.map(([x, h]) => V(mx + x, top + h + 0.12, z + 0.14)),
      0.068,
      C,
      32
    );
  }
  // Raised pavilion crest leaves the complete launch arch open underneath.
  for (const [x,y] of arch.slice(2,-2)) {
    const h=1.08+1.85*(1-Math.abs(x)/5.8);
    const crest = new T.LatheGeometry([[.08,0],[.40,.20],[.35,h*.53],[.008,h]].map(v=>new T.Vector2(...v)),7);
    m(slideStructure,crest,Math.abs(x)<1?P:I,V(mx+x,top+y,front-.27));
    rod(slideStructure,V(mx+x,top+y+.28,front+.033),V(mx+x,top+y+h*.59,front+.035),.052,Math.abs(x)<1?L:C);
  }
  for (const [x, h] of arch.slice(2, -2))
    rod(slideStructure, V(mx + x, top + h, back + 0.49), V(mx + x, top + h, front - 0.23), 0.085, N);
  function stairsGround(x, z) {
    if (Math.abs(x - X) <= W / 2 + 0.05 && z <= Z + 0.16 && z >= front - 0.1) {
      const d = Math.max(0, Z - z),
        i = Math.min(2, Math.floor(d / (run + land)));
      return h * (i + Math.min(1, (d - i * (run + land)) / run));
    }
    if (x >= left && x <= right && z >= back && z <= front) return top;
    const dx = x - 53,
      dz = z + 19,
      lx = co * dx - si * dz,
      lz = si * dx + co * dz;
    if (Math.abs(lx) < 5.94 && lz >= 0.94 && lz <= 5.7) return 0.815;
    if (Math.abs(lx) < 2.02 && lz > 5.7 && lz <= 9.55) return (0.815 * (9.55 - lz)) / 3.85;
    return null;
  }
  const matrix = new T.Matrix4(),
    wheelAngle = (t) => ((t * tau) / wheelPeriod) % tau;
  let last = 0;
  function wheelSeat(i, out) {
    const a = wheelAngle(last) + (tau * i) / 16;
    return at(wheelRadius * Math.sin(a), -wheelRadius * Math.cos(a) - 1.16, 0.22, out);
  }
  function update(t) {
    last = t;
    const theta = wheelAngle(t);
    spin.rotation.z = theta;
    for (let i = 0; i < 16; i++) {
      const a = theta + (tau * i) / 16;
      matrix.makeRotationZ(0.012 * Math.sin(0.49 * t + i));
      matrix.setPosition(wheelRadius * Math.sin(a), -wheelRadius * Math.cos(a), 0);
      for (const o of pods) o.setMatrixAt(i, matrix);
    }
    for (const o of pods) o.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return {
    group,
    colliders,
    update,
    wheelSeat,
    wheelAngle,
    wheelPeriod,
    // Horizontal offsets share the wheel's local axes, keeping the outside camera clear of its spokes.
    windowOffset: V(si * 1.04, 0.05, co * 1.04),
    panoramaOffset: V(18 * co + 1.6 * si, 4.4, -18 * si + 1.6 * co),
    slideLength,
    slideMap: frames.filter((_, i) => i % 4 === 0 || i === sections).map(f => [f.v.x, f.v.z]),
    slidePoint,
    slideEntry: slidePoint(0),
    slideExit: slidePoint(1),
    stairFoot: V(X, 0, Z + 0.18),
    stairsGround,
    wheelEntry: at(0, 0.815 - hubHeight, 3.55),
  };
}
